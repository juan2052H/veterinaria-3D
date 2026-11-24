import { buildDogSchematic } from '../src/species/dog/schematicModel';
import * as THREE from 'three';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 900, H = 520;
type View = { name: string; hide: (n: string) => boolean; proj: (p: THREE.Vector3) => [number, number, number] };
const group = buildDogSchematic();
const meshes: THREE.Mesh[] = [];
group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });

const skinLike = (n: string) => n === 'cutis' || n === 'tela_subcutanea';
const muscle = (n: string) => n.startsWith('m_') || n.startsWith('mm_') || n === 'diaphragma';
const female = (n: string) => /ovarium|uterus|vagina|@female/.test(n);
const lat = (p: THREE.Vector3): [number, number, number] => [(p.x + 6) * 70, (7.6 - p.y) * 70, p.z];
const dors = (p: THREE.Vector3): [number, number, number] => [(p.x + 6) * 70, (p.z + 3.5) * 70, p.y];
const views: View[] = [
  { name: 'piel_lateral', hide: (n) => n !== 'cutis', proj: lat },
  { name: 'musculos_lateral', hide: (n) => skinLike(n) || female(n), proj: lat },
  { name: 'visceras_lateral', hide: (n) => skinLike(n) || muscle(n) || female(n), proj: lat },
  { name: 'visceras_dorsal', hide: (n) => skinLike(n) || muscle(n) || female(n) || n.startsWith('vertebrae') || n.startsWith('costae') || n==='os_sacrum', proj: dors },
];
function png(w: number, h: number, rgb: Uint8Array) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1); }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b: Buffer) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const out = new Uint8Array(W * H * views.length * 3);
views.forEach((view, vi) => {
  const zb = new Float32Array(W * H).fill(-1e9);
  const off = vi * W * H * 3;
  for (let i = 0; i < W * H; i++) { out[off + i * 3] = 30; out[off + i * 3 + 1] = 34; out[off + i * 3 + 2] = 44; }
  const light = new THREE.Vector3(0.4, 0.7, 0.6).normalize();
  for (const m of meshes) {
    if (view.hide(m.name)) continue;
    const col = (m.material as THREE.MeshStandardMaterial).color;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const pos = g.attributes.position;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < pos.count; t += 3) {
      a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
      const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      const shade = 0.35 + 0.65 * Math.abs(n.dot(light));
      const P = [view.proj(a), view.proj(b), view.proj(c)];
      const minX = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const minY = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const w0 = ((P[1][0] - x) * (P[2][1] - y) - (P[2][0] - x) * (P[1][1] - y)) / area;
        const w1 = ((P[2][0] - x) * (P[0][1] - y) - (P[0][0] - x) * (P[2][1] - y)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * P[0][2] + w1 * P[1][2] + w2 * P[2][2];
        const k = y * W + x;
        if (z <= zb[k]) continue;
        zb[k] = z;
        out[off + k * 3] = col.r * 255 * shade; out[off + k * 3 + 1] = col.g * 255 * shade; out[off + k * 3 + 2] = col.b * 255 * shade;
      }
    }
  }
});
writeFileSync(process.argv[2], png(W, H * views.length, out));
console.log('ok', meshes.length, 'mallas');
