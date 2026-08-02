/**
 * Lot terrain + sun analysis engine.
 *
 * For each lot we compute, server-side:
 *  - A terrain elevation grid clipped to the lot polygon + a surrounding ring
 *    (OpenTopoData, free/open DEM — USGS 3DEP where available, SRTM/ASTER
 *    fallback).
 *  - A slope / grading-cost indicator derived from the in-lot terrain.
 *  - Sun positions (azimuth/altitude) over the course of the summer solstice,
 *    winter solstice, and the equinox at the lot centroid.
 *  - A horizon profile: for each azimuth, the highest terrain elevation angle
 *    seen from the lot, so "sun hours" account for surrounding relief.
 *
 * Everything here is deterministic math given (polygon, grid, day); the
 * expensive part (fetching + caching the DEM) happens once per lot.
 */

export interface SunSample {
  time: string; // "HH:MM" local
  altitude: number; // degrees above horizon
  azimuth: number; // degrees, 0 = N, 90 = E
  up: boolean; // above the terrain horizon
}

export interface DaySun {
  label: string;
  date: string; // ISO
  sunrise: string | null;
  sunset: string | null;
  daylightHours: number;
  visibleHours: number; // accounting for the horizon
  path: SunSample[]; // every 15 min while sun is up, plus rise/set
}

export interface SlopeProfile {
  avgPct: number;
  maxPct: number;
  reliefM: number; // max - min elevation inside the lot
  cutFillM3: number; // rough earthwork volume to flatten to a pad
  rating: "gentle" | "moderate" | "steep";
  summary: string;
}

export interface LotAnalysis {
  elevation: {
    minM: number;
    maxM: number;
    centroidM: number;
    grid: {
      lats: number[];
      lngs: number[];
      z: number[][]; // [row][col], meters
      polygonMask: boolean[][];
    };
  };
  slope: SlopeProfile;
  sun: {
    summer: DaySun;
    equinox: DaySun;
    winter: DaySun;
    sunsetBearingSummer: number;
    sunsetBearingWinter: number;
  };
  horizon: { azimuth: number; elevationAngle: number }[]; // every 10°
}

/* ------------------------------------------------------------------ */
/* Solar position (NOAA-style approximation, <0.01° error for our use) */
/* ------------------------------------------------------------------ */

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function sunPosition(dateUtc: Date, lat: number, lng: number) {
  const start = Date.UTC(dateUtc.getUTCFullYear(), 0, 0);
  const doy = Math.floor((dateUtc.getTime() - start) / 86400000);
  const hour =
    dateUtc.getUTCHours() +
    dateUtc.getUTCMinutes() / 60 +
    dateUtc.getUTCSeconds() / 3600;

  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (hour - 12) / 24);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  const timeOffset = eqTime + 4 * lng; // minutes; UTC-based
  const tst = hour * 60 + timeOffset; // true solar time
  const ha = ((tst / 4 - 180) * D2R) % (2 * Math.PI);

  const latR = lat * D2R;
  const cosAlt =
    Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha);
  const altitude = Math.asin(Math.min(1, Math.max(-1, cosAlt))) * R2D;

  const azRad = Math.atan2(
    Math.sin(ha),
    Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)
  );
  const azimuth = (azRad * R2D + 180 + 360) % 360;

  return { altitude, azimuth };
}

/* ------------------------------------------------------------------ */
/* Elevation grid fetch (OpenTopoData)                                  */
/* ------------------------------------------------------------------ */

interface GridSpec {
  lats: number[];
  lngs: number[];
  polygonMask: boolean[][];
}

function pointInPolygon(lat: number, lng: number, ring: number[][]): boolean {
  // ray casting; ring is [ [lng,lat], ... ]
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

export function buildGridSpec(
  ring: number[][],
  stepM = 10,
  marginM = 300
): GridSpec {
  const lats = ring.map((c) => c[1]);
  const lngs = ring.map((c) => c[0]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;

  const latPerM = 1 / 111320;
  const lngPerM = 1 / (111320 * Math.cos(midLat * D2R));

  const latMargin = marginM * latPerM;
  const lngMargin = marginM * lngPerM;
  const latStep = stepM * latPerM;
  const lngStep = stepM * lngPerM;

  const latArr: number[] = [];
  for (let lat = minLat - latMargin; lat <= maxLat + latMargin; lat += latStep)
    latArr.push(Number(lat.toFixed(7)));
  const lngArr: number[] = [];
  for (let lng = minLng - lngMargin; lng <= maxLng + lngMargin; lng += lngStep)
    lngArr.push(Number(lng.toFixed(7)));

  const mask = latArr.map((lat) =>
    lngArr.map((lng) => pointInPolygon(lat, lng, ring))
  );

  return { lats: latArr, lngs: lngArr, polygonMask: mask };
}

async function fetchElevations(
  points: { lat: number; lng: number }[]
): Promise<number[]> {
  const DATASETS = ["mapzen", "aster30m", "srtm30m"];
  const CHUNK = 90;

  for (const ds of DATASETS) {
    try {
      const out: number[] = [];
      for (let i = 0; i < points.length; i += CHUNK) {
        const chunk = points.slice(i, i + CHUNK);
        const loc = chunk.map((p) => `${p.lat},${p.lng}`).join("|");
        const res = await fetch(
          `https://api.opentopodata.org/v1/${ds}?locations=${loc}`,
          { signal: AbortSignal.timeout(30_000) }
        );
        if (!res.ok) throw new Error(`opentopodata ${ds}: ${res.status}`);
        const json = (await res.json()) as {
          status: string;
          results: { elevation: number | null }[];
        };
        if (json.status !== "OK") throw new Error(`opentopodata ${ds} not OK`);
        for (const r of json.results) {
          if (r.elevation == null) throw new Error(`${ds} null elevation`);
          out.push(r.elevation);
        }
        // be polite to the free API between chunks
        if (i + CHUNK < points.length)
          await new Promise((r) => setTimeout(r, 1200));
      }
      return out;
    } catch {
      // try next dataset
    }
  }
  throw new Error("All elevation datasets failed");
}

/* ------------------------------------------------------------------ */
/* Slope + earthwork                                                    */
/* ------------------------------------------------------------------ */

function computeSlope(spec: GridSpec, z: number[][]): SlopeProfile {
  const rows = spec.lats.length;
  const cols = spec.lngs.length;
  const midLat = spec.lats[Math.floor(rows / 2)];
  const dyM = 111320 * Math.abs(spec.lats[1] - spec.lats[0]);
  const dxM = 111320 * Math.cos(midLat * D2R) * Math.abs(spec.lngs[1] - spec.lngs[0]);

  let inMin = Infinity;
  let inMax = -Infinity;
  const grads: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!spec.polygonMask[r][c]) continue;
      const v = z[r][c];
      inMin = Math.min(inMin, v);
      inMax = Math.max(inMax, v);

      // gradient via neighbors
      const dzdx =
        c > 0 && c < cols - 1 ? (z[r][c + 1] - z[r][c - 1]) / (2 * dxM) : 0;
      const dzdy =
        r > 0 && r < rows - 1 ? (z[r + 1][c] - z[r - 1][c]) / (2 * dyM) : 0;
      grads.push(Math.hypot(dzdx, dzdy) * 100);
    }
  }

  if (!grads.length) {
    return {
      avgPct: 0,
      maxPct: 0,
      reliefM: 0,
      cutFillM3: 0,
      rating: "gentle",
      summary: "Flat lot — minimal site work expected.",
    };
  }

  const avg = grads.reduce((a, b) => a + b, 0) / grads.length;
  const max = Math.max(...grads);
  const relief = inMax - inMin;

  // rough earthwork: cut/fill to the mean elevation inside the lot
  let sum = 0;
  let n = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (spec.polygonMask[r][c]) {
        sum += z[r][c];
        n++;
      }
  const mean = sum / n;

  let vol = 0;
  const cellArea = dxM * dyM;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (spec.polygonMask[r][c]) vol += Math.abs(z[r][c] - mean) * cellArea;

  const rating: SlopeProfile["rating"] =
    avg < 3 && relief < 2 ? "gentle" : avg < 8 && relief < 6 ? "moderate" : "steep";

  const reliefFt = relief * 3.28084;
  const volYd3 = vol * 1.30795;
  const summary =
    rating === "gentle"
      ? `Nearly flat (${reliefFt.toFixed(1)} ft of rise across the lot). Standard building pad; minimal site-work cost.`
      : rating === "moderate"
        ? `Moderate slope — about ${reliefFt.toFixed(1)} ft of rise across the lot, averaging ${avg.toFixed(1)}% grade. Expect some cut/fill (roughly ${Math.round(volYd3).toLocaleString()} yd³) for a level pad.`
        : `Notable slope — ${reliefFt.toFixed(1)} ft of rise across the lot, averaging ${avg.toFixed(1)}% grade. Budget for significant grading (roughly ${Math.round(volYd3).toLocaleString()} yd³) or a daylight-basement design.`;

  return { avgPct: avg, maxPct: max, reliefM: relief, cutFillM3: vol, rating, summary };
}

/* ------------------------------------------------------------------ */
/* Horizon + sun path                                                   */
/* ------------------------------------------------------------------ */

function computeHorizon(
  spec: GridSpec,
  z: number[][],
  centroidIdx: { r: number; c: number }
): { azimuth: number; elevationAngle: number }[] {
  const rows = spec.lats.length;
  const cols = spec.lngs.length;
  const midLat = spec.lats[centroidIdx.r];
  const dyM = 111320 * Math.abs(spec.lats[1] - spec.lats[0]);
  const dxM = 111320 * Math.cos(midLat * D2R) * Math.abs(spec.lngs[1] - spec.lngs[0]);
  const z0 = z[centroidIdx.r][centroidIdx.c];

  const out: { azimuth: number; elevationAngle: number }[] = [];
  for (let az = 0; az < 360; az += 10) {
    let maxAngle = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = (c - centroidIdx.c) * dxM;
        const dy = (r - centroidIdx.r) * dyM;
        const dist = Math.hypot(dx, dy);
        if (dist < 15) continue;
        // bearing from centroid to cell
        const bearing = (Math.atan2(dx, dy) * R2D + 360) % 360;
        let diff = Math.abs(bearing - az);
        if (diff > 180) diff = 360 - diff;
        if (diff > 4) continue; // only cells near this azimuth
        const angle = Math.atan2(z[r][c] - z0, dist) * R2D;
        if (angle > maxAngle) maxAngle = angle;
      }
    }
    out.push({ azimuth: az, elevationAngle: Number(maxAngle.toFixed(2)) });
  }
  return out;
}

function horizonAngleAt(
  horizon: { azimuth: number; elevationAngle: number }[],
  az: number
): number {
  // linear interpolation on the 10° samples
  const a = ((az % 360) + 360) % 360;
  const i = Math.floor(a / 10) % 36;
  const j = (i + 1) % 36;
  const t = (a - i * 10) / 10;
  return horizon[i].elevationAngle * (1 - t) + horizon[j].elevationAngle * t;
}

function computeDaySun(
  dateLocal: Date,
  label: string,
  lat: number,
  lng: number,
  tzOffsetHours: number,
  horizon: { azimuth: number; elevationAngle: number }[]
): DaySun {
  const path: SunSample[] = [];
  let visibleMin = 0;

  // timezone-independent: anchor the lot-local day at UTC midnight of the
  // calendar date, then step through lot-local minutes via the fixed offset
  const utcMidnight = Date.UTC(
    dateLocal.getFullYear(),
    dateLocal.getMonth(),
    dateLocal.getDate()
  );

  // scan 15-min steps across the lot-local day
  for (let m = 0; m < 24 * 60; m += 15) {
    const utcMs = utcMidnight + (m - tzOffsetHours * 60) * 60000;
    const utc = new Date(utcMs);
    const { altitude, azimuth } = sunPosition(utc, lat, lng);
    if (altitude <= 0) continue;

    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");

    const hAng = horizonAngleAt(horizon, azimuth);
    const up = altitude > hAng;
    if (up) visibleMin += 15;
    path.push({
      time: `${hh}:${mm}`,
      altitude: Number(altitude.toFixed(1)),
      azimuth: Number(azimuth.toFixed(1)),
      up,
    });
  }

  // Split into contiguous daytime intervals (sun can be up across midnight
  // in two separate runs: yesterday's tail and today's). Keep the interval
  // that contains today's culmination (max altitude).
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const intervals: SunSample[][] = [];
  let cur: SunSample[] = [];
  for (let i = 0; i < path.length; i++) {
    if (cur.length && mins(path[i].time) - mins(cur[cur.length - 1].time) > 15) {
      intervals.push(cur);
      cur = [];
    }
    cur.push(path[i]);
  }
  if (cur.length) intervals.push(cur);

  let main = intervals[0] ?? [];
  for (const iv of intervals) {
    const ivMax = Math.max(...iv.map((p) => p.altitude));
    const mainMax = main.length ? Math.max(...main.map((p) => p.altitude)) : -1;
    if (ivMax > mainMax) main = iv;
  }
  path.length = 0;
  path.push(...main);

  const sunrise = path.length ? path[0].time : null;
  const sunset = path.length ? path[path.length - 1].time : null;
  const daylight = path.length * 15;

  return {
    label,
    date: dateLocal.toISOString().slice(0, 10),
    sunrise,
    sunset,
    daylightHours: Number((daylight / 60).toFixed(1)),
    visibleHours: Number((visibleMin / 60).toFixed(1)),
    path,
  };
}

/* ------------------------------------------------------------------ */
/* Top-level orchestration, with in-memory cache                        */
/* ------------------------------------------------------------------ */

const analysisCache = new Map<string, { at: number; data: LotAnalysis }>();
const CACHE_TTL = 24 * 3600 * 1000;

export async function analyzeLot(
  lotName: string,
  ring: number[][]
): Promise<LotAnalysis> {
  const hit = analysisCache.get(lotName);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.data;

  const spec = buildGridSpec(ring, 10, 250);
  const rows = spec.lats.length;
  const cols = spec.lngs.length;

  const pts: { lat: number; lng: number }[] = [];
  for (const lat of spec.lats) for (const lng of spec.lngs) pts.push({ lat, lng });
  const zFlat = await fetchElevations(pts);
  const z: number[][] = [];
  for (let r = 0; r < rows; r++) z.push(zFlat.slice(r * cols, (r + 1) * cols));

  // centroid (prefer inside polygon)
  let cr = Math.floor(rows / 2);
  let cc = Math.floor(cols / 2);
  if (!spec.polygonMask[cr][cc]) {
    outer: for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (spec.polygonMask[r][c]) {
          cr = r;
          cc = c;
          break outer;
        }
  }
  const centroidLat = spec.lats[cr];
  const centroidLng = spec.lngs[cc];

  const slope = computeSlope(spec, z);
  const horizon = computeHorizon(spec, z, { r: cr, c: cc });

  const year = new Date().getFullYear();
  // Mountain Time: UTC-7 in June, UTC-7 in March (MDT), UTC-7? (MST in Dec = UTC-7)
  const summer = computeDaySun(new Date(year, 5, 21), "Summer solstice", centroidLat, centroidLng, -6, horizon);
  const equinox = computeDaySun(new Date(year, 2, 20), "Equinox", centroidLat, centroidLng, -6, horizon);
  const winter = computeDaySun(new Date(year, 11, 21), "Winter solstice", centroidLat, centroidLng, -7, horizon);

  const sunsetBearing = (d: DaySun) =>
    d.path.length ? d.path[d.path.length - 1].azimuth : 270;

  // in-lot elevation stats
  let min = Infinity;
  let max = -Infinity;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (spec.polygonMask[r][c]) {
        min = Math.min(min, z[r][c]);
        max = Math.max(max, z[r][c]);
      }

  const data: LotAnalysis = {
    elevation: {
      minM: Number(min.toFixed(1)),
      maxM: Number(max.toFixed(1)),
      centroidM: Number(z[cr][cc].toFixed(1)),
      grid: { lats: spec.lats, lngs: spec.lngs, z, polygonMask: spec.polygonMask },
    },
    slope,
    sun: {
      summer,
      equinox,
      winter,
      sunsetBearingSummer: sunsetBearing(summer),
      sunsetBearingWinter: sunsetBearing(winter),
    },
    horizon,
  };

  analysisCache.set(lotName, { at: Date.now(), data });
  return data;
}
