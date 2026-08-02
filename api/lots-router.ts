import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { analyzeLot, fetchTerrainGrid3D } from "./lot-analysis";

/**
 * Live lot data from Groove's public v3 widget bundle.
 *
 * The same URL Groove's own embedded map fetches on every page load — no API
 * key or private feed required. The server re-pulls it and caches the result
 * for CACHE_TTL_MS so we never hammer their endpoint; the frontend keeps a
 * baked-in snapshot as fallback in case Groove's format changes upstream.
 */

const WIDGET_URL =
  "https://v3.api.letsgroov.com/widget/5fae8008-b422-47de-874a-f44d91227519";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type StadiumStatus = "Available" | "Under Contract" | "Sold" | "Coming Soon";

interface StadiumLotFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] } | null;
  properties: {
    name: string;
    status: StadiumStatus;
    grooveStatus: string;
    price: number | null;
    acreage: number | null;
    facing: string | null;
    phase: string;
    label: [number, number] | null;
    features: string[];
  };
}

interface GrooveGeoFeature {
  geometry: { type: string; coordinates: number[][][] } | null;
  properties: { lot_number?: string };
}

interface GroovePhase {
  name: string;
  geojson: { features: GrooveGeoFeature[] };
}

interface GrooveProperty {
  propertyName: string;
  status: string;
  price?: number | null;
  acreage?: number | null;
  facingDirection?: string | null;
  labelLatitude?: number | null;
  labelLongitude?: number | null;
  features?: string[];
  phaseName: string;
}

function mapStatus(grooveStatus: string): StadiumStatus {
  switch (grooveStatus) {
    case "For Sale":
      return "Available";
    case "Pending":
    case "Reserved":
      return "Under Contract";
    case "Sold":
      return "Sold";
    default:
      return "Coming Soon";
  }
}

function transformBundle(bundle: {
  phases: GroovePhase[];
  properties: GrooveProperty[];
}): StadiumLotFeature[] {
  const propsByPhaseAndLot = new Map<string, GrooveProperty>();
  for (const p of bundle.properties) {
    propsByPhaseAndLot.set(`${p.phaseName}::${p.propertyName}`, p);
  }

  const out: StadiumLotFeature[] = [];
  for (const phase of bundle.phases) {
    for (const f of phase.geojson.features) {
      const lotNumber = f.properties.lot_number;
      if (!lotNumber) continue;
      const prop = propsByPhaseAndLot.get(`${phase.name}::${lotNumber}`);
      if (!prop) continue; // polygon without a listed property — skip
      if (!f.geometry || f.geometry.type !== "Polygon") continue;

      out.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: f.geometry.coordinates },
        properties: {
          name: prop.propertyName,
          status: mapStatus(prop.status),
          grooveStatus: prop.status,
          price: prop.price ?? null,
          acreage: prop.acreage ?? null,
          facing: prop.facingDirection ?? null,
          phase: prop.phaseName,
          label:
            prop.labelLongitude != null && prop.labelLatitude != null
              ? [prop.labelLongitude, prop.labelLatitude]
              : null,
          features: prop.features ?? [],
        },
      });
    }
  }
  return out;
}

let cache: { data: StadiumLotFeature[]; fetchedAt: number } | null = null;
let inflight: Promise<StadiumLotFeature[]> | null = null;

// Persist the bundle so a server restart never leaves the site without lot
// data while Groove is slow; stale disk data is better than an error.
const LOTS_CACHE_FILE = path.join(process.cwd(), "data", "lots-bundle.json");

function readLotsFromDisk(): { data: StadiumLotFeature[]; fetchedAt: number } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(LOTS_CACHE_FILE, "utf8")) as {
      data: StadiumLotFeature[];
      fetchedAt: number;
    };
    if (!raw.data?.length) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeLotsToDisk(entry: { data: StadiumLotFeature[]; fetchedAt: number }): void {
  try {
    fs.mkdirSync(path.dirname(LOTS_CACHE_FILE), { recursive: true });
    fs.writeFileSync(LOTS_CACHE_FILE, JSON.stringify(entry));
  } catch {
    // best-effort
  }
}

async function fetchLiveLots(): Promise<StadiumLotFeature[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      // Groove's endpoint can take 20-30s to respond when it's regenerating
      // the bundle, so allow a generous window before declaring it dead.
      const res = await fetch(WIDGET_URL, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Groove widget fetch failed: ${res.status}`);
      const json = (await res.json()) as {
        data: { bundle: { phases: GroovePhase[]; properties: GrooveProperty[] } };
      };
      const features = transformBundle(json.data.bundle);
      if (features.length === 0)
        throw new Error("Groove bundle contained no matched lots");
      cache = { data: features, fetchedAt: Date.now() };
      writeLotsToDisk(cache);
      return features;
    } catch (err) {
      // fall back to whatever we have — memory (even if stale), then disk —
      // rather than taking the lot pages down with us
      if (cache) return cache.data;
      const disk = readLotsFromDisk();
      if (disk) {
        cache = disk;
        return disk.data;
      }
      throw err;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

// Seed the memory cache from disk at module load so cold starts are cheap.
if (!cache) {
  const disk = readLotsFromDisk();
  if (disk) cache = disk;
}

/**
 * Background cache warmer: after server boot, walk every lot (available
 * ones first) and fetch its terrain grid in the background, so by the time
 * a real visitor clicks a lot page the data is already hot. Sequential and
 * deliberately slow — the DEM API is free and rate-limited.
 */
export function warmLotCachesInBackground(): void {
  void (async () => {
    try {
      const features = await fetchLiveLots();
      const ordered = [...features].sort((a, b) => {
        const aOpen = a.properties.status === "Available" ? 0 : 1;
        const bOpen = b.properties.status === "Available" ? 0 : 1;
        return aOpen - bOpen;
      });
      for (const lot of ordered) {
        if (!lot.geometry) continue;
        try {
          await fetchTerrainGrid3D(lot.properties.name, lot.geometry.coordinates[0]);
        } catch {
          // skip this lot; a real visit will retry on demand
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch {
      // warming is best-effort
    }
  })();
}

export const lotsRouter = createRouter({
  /** Live lot polygons + statuses, refreshed from Groove every 6h. */
  live: publicQuery.query(async () => {
    const features = await fetchLiveLots();
    return { features, fetchedAt: cache?.fetchedAt ?? Date.now() };
  }),

  /**
   * Terrain + sun analysis for one lot. Uses the cached Groove polygon as
   * the lot boundary; results are cached server-side for 24h.
   */
  analysis: publicQuery
    .input(z.object({ lotName: z.string().min(1) }))
    .query(async ({ input }) => {
      const features = await fetchLiveLots();
      const lot = features.find((f) => f.properties.name === input.lotName);
      if (!lot?.geometry) throw new Error(`Lot ${input.lotName} not found`);
      return analyzeLot(input.lotName, lot.geometry.coordinates[0]);
    }),

  /**
   * Compact terrain for the 3D visualizer: origin + evenly-spaced elevation
   * grid (meters) over the lot and ~180 m around it. Uses a coarse grid so a
   * cold fetch completes in seconds; cached server-side for 24h.
   */
  terrain3d: publicQuery
    .input(z.object({ lotName: z.string().min(1) }))
    .query(async ({ input }) => {
      const features = await fetchLiveLots();
      const lot = features.find((f) => f.properties.name === input.lotName);
      if (!lot?.geometry) throw new Error(`Lot ${input.lotName} not found`);
      return fetchTerrainGrid3D(input.lotName, lot.geometry.coordinates[0]);
    }),
});
