import * as fs from 'fs';
globalThis.window = { setTimeout: (fn, ms) => setTimeout(fn, ms) };
const gs3d = (await import('@mkkellogg/gaussian-splats-3d')).default;
const { PlyLoader, SplatBuffer } = gs3d;

const [,, inPath, outPath] = process.argv;
const data = fs.readFileSync(inPath);
const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

// Uncompressed ksplat (compressionLevel 0) so the runtime can skip the WASM
// decompression step entirely.
const splatBuffer = await PlyLoader.loadFromFileData(buf, 1, 0, true, 0);

// Extract center + half-extents of the real terrain for geo-alignment.
const n = splatBuffer.getSplatCount();
const c = [0, 0, 0];
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < n; i++) {
  splatBuffer.getSplatCenter(i, c);
  for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], c[k]); max[k] = Math.max(max[k], c[k]); }
}
const center = min.map((v, k) => (v + max[k]) / 2);
const half = max.map((v, k) => (v - min[k]) / 2);
console.log(JSON.stringify({ splats: n, center, half, unitsPerMeter: 1 / (half[0] / 2 + half[2] / 2) }));

fs.writeFileSync(outPath, Buffer.from(splatBuffer.bufferData));
console.log('wrote', outPath, (splatBuffer.bufferData.byteLength / 1e6).toFixed(1), 'MB');
