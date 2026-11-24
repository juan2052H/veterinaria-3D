/**
 * Vísceras, vasos y nervios del modelo esquemático.
 * Topografía según Evans & de Lahunta (2020) y König & Liebich (2020).
 */
import * as THREE from 'three';
import { basis, boxB, chain, cone, ellipsoid, ellipsoidB, mergeGeoms, type Prim, solid, sphere } from '../sdf';
import { DOME, fore, hind, type Part, SIDES, v, type V, wallZ } from './common';
import { canalPath, SKULL } from './skeleton';

const ORGAN = { voxel: 0.03, k: 0.02 };
const TUBE = { voxel: 0.014, k: 0.009, smooth: 4 };
const FINE = { voxel: 0.009, k: 0.005 };

/** Tubo hueco o macizo a lo largo de una curva. */
const tube = (pts: V[], r: number | ((t: number) => number), segs?: number) =>
  chain(pts, typeof r === 'number' ? () => r : r, { segs: segs ?? Math.max(4, pts.length * 3) });

const merge = mergeGeoms;

/* ============================== Corazón ============================== */

const HB = v(1.0, 4.2, 0.0); // centro de la base
const HA = v(0.38, 3.12, -0.16); // ápice (caudoventral e izquierdo)
const HAX = HA.clone().sub(HB);
const heartR = (t: number) => 0.05 + 0.42 * Math.pow(Math.max(0, 1 - Math.pow(t, 1.8)), 0.7);
const heartAt = (t: number) => HB.clone().addScaledVector(HAX, t);

function heart(): { main: Prim[]; fat: Prim[] } {
  const ax = HAX.clone().normalize();
  const B = basis(ax, v(0, 0, 1)); // ex: eje base→ápice, ez ≈ derecha
  const cran = new THREE.Vector3().crossVectors(B[2], ax).normalize(); // hacia craneal
  if (cran.x < 0) cran.negate();
  const right = B[2];
  const main: Prim[] = [
    ...chain([heartAt(0.06), heartAt(0.45), heartAt(0.8), heartAt(1)], (t) => heartR(0.06 + t * 0.94), { segs: 12, flat: { n: right, f: 0.88 } }), // ventrículo izquierdo / masa ventricular
    ellipsoidB(heartAt(0.38).addScaledVector(cran, 0.16).addScaledVector(right, 0.12), [ax, cran, right], v(0.34, 0.22, 0.24)), // ventrículo derecho (rodea craneal y a la derecha)
    ellipsoid(HB.clone().add(v(0.04, 0.13, 0.2)), v(0.22, 0.16, 0.17)), // atrio derecho
    ...chain([HB.clone().add(v(0.06, 0.14, 0.22)), HB.clone().add(v(0.3, 0.04, 0.2)), HB.clone().add(v(0.42, -0.02, 0.06))], (t) => 0.1 - 0.05 * t, { segs: 4, flat: { n: v(0, 1, 0.2), f: 0.5 } }), // orejuela derecha
    ellipsoid(HB.clone().add(v(-0.18, 0.15, -0.08)), v(0.2, 0.14, 0.2)), // atrio izquierdo
    ...chain([HB.clone().add(v(-0.1, 0.12, -0.24)), HB.clone().add(v(0.14, 0.04, -0.34)), HB.clone().add(v(0.3, -0.04, -0.3))], (t) => 0.09 - 0.045 * t, { segs: 4, flat: { n: v(0, 0.3, -1), f: 0.45 } }), // orejuela izquierda
  ];
  // Grasa del surco coronario y de los surcos interventriculares (con los vasos coronarios)
  const ring: V[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ring.push(heartAt(0.1).addScaledVector(cran, Math.cos(a) * 0.44).addScaledVector(right, Math.sin(a) * 0.4));
  }
  const groove = (dir: V, t1: number) => Array.from({ length: 6 }, (_, i) => { const t = 0.1 + ((t1 - 0.1) * i) / 5; return heartAt(t).addScaledVector(dir, heartR(t) * 0.98); });
  const fat = [
    ...chain(ring, () => 0.045, { segs: 16 }),
    ...chain(groove(cran.clone().multiplyScalar(0.55).addScaledVector(right, -0.84).normalize(), 0.88), (t) => 0.045 - 0.025 * t, { segs: 8 }), // surco paraconal (izquierdo)
    ...chain(groove(cran.clone().multiplyScalar(-0.6).addScaledVector(right, 0.8).normalize(), 0.8), (t) => 0.04 - 0.02 * t, { segs: 8 }), // surco subsinuoso (derecho)
  ];
  return { main, fat };
}

/* ============================ Grandes vasos ============================ */

const AORTA = [HB.clone().add(v(0.04, 0.16, -0.02)), v(1.12, 4.66, -0.05), v(0.85, 4.92, -0.12), v(0.25, 4.74, -0.1), v(-0.55, 4.64, -0.04), v(-1.5, 4.62, -0.03), v(-2.2, 4.56, -0.02)];
const BCT = v(1.82, 4.62, 0.02); // fin del tronco braquiocefálico
const TRACHEA = [v(3.72, 5.46, 0), v(3.0, 4.96, 0), v(2.25, 4.62, 0), v(1.6, 4.5, 0), v(1.04, 4.44, 0)];
const OESO = [v(3.74, 5.64, 0), v(3.05, 5.12, -0.12), v(2.25, 4.78, -0.08), v(1.2, 4.62, 0.04), v(0.2, 4.52, 0.0), v(-0.45, 4.38, -0.22), v(-0.75, 4.3, -0.32)];
const CVC = [HB.clone().add(v(-0.1, 0.06, 0.2)), v(0.4, 3.98, 0.16), v(-0.3, 3.98, 0.15), v(-0.72, 4.3, 0.15), v(-1.3, 4.46, 0.12), v(-2.2, 4.46, 0.08)];
const KIDNEY = (s: number) => v(s > 0 ? -0.95 : -1.25, 4.5, s * 0.4);

function vessels(parts: Part[]) {
  const ao: Prim[] = [...tube(AORTA, (t) => 0.078 - 0.02 * t, 30)];
  ao.push(...tube([v(1.06, 4.8, -0.05), v(1.45, 4.74, 0.0), BCT], 0.045)); // tronco braquiocefálico
  ao.push(...tube([v(0.9, 4.88, -0.1), v(1.6, 4.7, -0.16), v(2.15, 4.3, -0.4), fore(-1).sh.clone().add(v(-0.2, -0.3, 0.2))], 0.035)); // a. subclavia izquierda
  ao.push(...tube([BCT, v(2.15, 4.32, 0.38), fore(1).sh.clone().add(v(-0.2, -0.3, -0.2))], 0.035)); // a. subclavia derecha
  for (const { s } of SIDES) {
    const kk = KIDNEY(s);
    ao.push(...tube([v(kk.x + 0.05, 4.6, s * 0.03), kk.clone().add(v(0.02, 0.0, -s * 0.14))], 0.022)); // aa. renales
    ao.push(...tube([v(-2.2, 4.56, 0), v(-2.32, 4.42, s * 0.14), v(-2.3, 4.12, s * 0.3), v(-2.2, 3.98, s * 0.33)], 0.035)); // a. ilíaca externa
  }
  ao.push(...tube([v(-0.75, 4.62, -0.02), v(-0.85, 4.35, 0.0), v(-0.8, 4.1, 0.05)], 0.025)); // a. celíaca
  ao.push(...tube([v(-0.95, 4.62, -0.02), v(-1.15, 4.3, 0.0), v(-1.3, 4.05, 0.0)], 0.028)); // a. mesentérica craneal
  parts.push({ name: 'aorta', tissue: 'artery', geometry: solid(ao, { ...TUBE, fibers: true }) });

  const pt = [heartAt(0.28).add(v(0.3, 0.12, -0.1)), HB.clone().add(v(0.22, 0.3, -0.12)), v(1.0, 4.52, -0.06)];
  parts.push({
    name: 'truncus_pulmonalis', tissue: 'artery',
    geometry: solid([...tube(pt, 0.07), ...tube([v(1.0, 4.52, -0.06), v(0.86, 4.42, 0.12), v(0.7, 4.36, 0.32)], 0.045), ...tube([v(1.0, 4.52, -0.06), v(0.85, 4.46, -0.2), v(0.72, 4.4, -0.32)], 0.045)], { ...TUBE, fibers: true }),
  });

  const cc = [HB.clone().add(v(0.12, 0.22, 0.2)), v(1.5, 4.36, 0.16), v(2.2, 4.3, 0.1)];
  parts.push({
    name: 'v_cava_cranialis', tissue: 'vein',
    geometry: solid([...tube(cc, 0.068), ...SIDES.flatMap(({ s }) => tube([v(2.2, 4.3, 0.1), v(2.3, 4.24, s * 0.22), v(2.3, 4.24, s * 0.3)], 0.05))], { ...TUBE, fibers: true }),
  });
  const cvc: Prim[] = [...tube(CVC, 0.07, 30)];
  for (const { s } of SIDES) {
    const kk = KIDNEY(s);
    cvc.push(...tube([v(kk.x, 4.46, 0.1), kk.clone().add(v(-0.02, -0.02, -s * 0.14))], 0.03)); // vv. renales
    cvc.push(...tube([v(-2.2, 4.46, 0.08), v(-2.3, 4.36, s * 0.16), v(-2.28, 4.1, s * 0.3)], 0.04)); // v. ilíaca
  }
  cvc.push(...tube([v(-0.72, 4.3, 0.15), v(-0.6, 4.0, 0.12), v(-0.55, 3.75, 0.05)], 0.035)); // vv. hepáticas
  parts.push({ name: 'v_cava_caudalis', tissue: 'vein', geometry: solid(cvc, { ...TUBE, fibers: true }) });

  for (const { s, k } of SIDES) {
    const F = fore(s);
    const H = hind(s);
    parts.push({ name: `v_jugularis_externa__${k}`, tissue: 'vein', geometry: solid(tube([v(4.05, 5.74, s * 0.36), v(3.3, 5.1, s * 0.44), v(2.6, 4.45, s * 0.4), v(2.3, 4.26, s * 0.3)], 0.045), { ...TUBE, fibers: true }) });
    parts.push({ name: `a_carotis_communis__${k}`, tissue: 'artery', geometry: solid(tube([s > 0 ? BCT : v(1.75, 4.64, -0.05), v(2.3, 4.72, s * 0.1), v(3.0, 5.06, s * 0.11), v(3.7, 5.6, s * 0.12), v(3.95, 5.78, s * 0.16)], 0.03), { ...TUBE, fibers: true }) });
    parts.push({ name: `v_cephalica__${k}`, tissue: 'vein', geometry: solid(tube([F.ca.clone().add(v(0.1, 0.12, -s * 0.02)), F.el.clone().add(v(0.19, -0.3, s * 0.0)), F.el.clone().add(v(0.24, 0.2, s * 0.08)), F.sh.clone().add(v(0.28, -0.25, s * 0.12)), v(2.6, 4.45, s * 0.42)], 0.028), { ...TUBE, fibers: true }) });
    parts.push({ name: `v_saphena_lateralis__${k}`, tissue: 'vein', geometry: solid(tube([H.ta.clone().add(v(-0.06, 0.05, s * 0.11)), H.ta.clone().add(v(-0.2, 0.5, s * 0.12)), H.st.clone().add(v(-0.33, -0.42, s * 0.14)), H.st.clone().add(v(-0.4, -0.05, s * 0.08))], 0.026), { ...TUBE, fibers: true }) });
    parts.push({ name: `a_femoralis__${k}`, tissue: 'artery', geometry: solid(tube([v(-2.2, 3.98, s * 0.33), v(-2.08, 3.45, s * 0.36), v(-2.0, 2.98, s * 0.4), H.st.clone().add(v(-0.14, 0.05, -s * 0.02))], 0.035), { ...TUBE, fibers: true }) });
  }
}

/* ============================ Respiratorio ============================ */

/** Cavidad torácica disponible para los pulmones (aproximación por la pared). */
const thoraxCavity: Prim = {
  d: (x, y, z) => Math.max(Math.abs(z) - (wallZ(x, y) - 0.07), y - 4.88),
  min: v(-1.7, 2.9, -1.0), max: v(2.35, 5.0, 1.0),
};

function lungs(parts: Part[]) {
  const dome = ellipsoidB(DOME.c, [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)], DOME.r.clone().addScalar(0.05));
  const heartSpace = ellipsoidB(v(0.72, 3.7, -0.04), basis(HAX, v(0, 0, 1)), v(0.72, 0.55, 0.5));
  const mediastinum = [...tube([...TRACHEA.slice(2), v(0.6, 4.4, 0)], 0.15), ...tube(AORTA.slice(1, 5), 0.12), ...tube(OESO.slice(3), 0.1), ...tube(CVC.slice(1, 3), 0.1), ellipsoid(v(1.65, 3.85, 0), v(0.35, 0.3, 0.16))];
  const slab = (c: V, n: V, halfLen: number, along: V) => boxB(c, basis(n, along), v(0.024, halfLen, 1.2), 0.0);
  for (const { s, k } of SIDES) {
    const side: Prim = { d: (_x, _y, z) => 0.07 - s * z, min: v(-2, 2.8, -1.1), max: v(2.5, 5.1, 1.1) };
    const fissures = [slab(v(0.56, 3.78, 0), v(0.92, -0.39, 0), 0.62, v(0, 0, 1))]; // cisura entre lóbulo caudal y los craneales/medio
    fissures.push(s > 0 ? slab(v(1.34, 3.55, 0), v(1, 0.12, 0), 0.62, v(0, 0, 1)) : slab(v(1.3, 3.38, 0), v(1, 0.1, 0), 0.4, v(0, 0, 1))); // craneal|medio (der.) — partes del lóbulo craneal (izq.)
    // Envolvente del pulmón: elipsoide con ápice craneal, recortado por la pared costal (cara costal convexa)
    const envelope = ellipsoidB(v(0.74, 4.12, s * 0.42), [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)], v(1.58, 0.88, 0.52));
    let g = solid([envelope], { voxel: 0.03, k: 0.03, intersect: [thoraxCavity, side], intK: 0.06, subtract: [dome, heartSpace, ...mediastinum, ...fissures], subK: 0.04, smooth: 3 });
    if (s > 0) {
      // lóbulo accesorio: en el receso del mediastino, alrededor de la vena cava caudal
      const acc = solid([ellipsoid(v(-0.1, 3.86, 0.04), v(0.32, 0.3, 0.2))], { voxel: 0.03, k: 0.02, subtract: [dome, heartSpace, ...tube(CVC.slice(1, 3), 0.08)], subK: 0.03 });
      g = merge([g, acc]);
    }
    parts.push({ name: `pulmo__${k}`, tissue: 'lung', geometry: g });
  }

  // Árbol bronquial: bronquios principales → lobulares → segmentarios
  const bif = TRACHEA[TRACHEA.length - 1];
  const br: Prim[] = [];
  const lobar: Record<string, V[]> = {
    r: [v(1.55, 4.2, 0.45), v(1.0, 3.62, 0.55), v(0.0, 4.18, 0.5), v(-0.05, 3.9, 0.12)],
    l: [v(1.6, 4.12, -0.42), v(1.08, 3.55, -0.5), v(0.0, 4.18, -0.5)],
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (const { s, k } of SIDES) {
    const hilus = v(0.76, 4.32, s * 0.28);
    br.push(...tube([bif, bif.clone().lerp(hilus, 0.5).add(v(0, 0.02, 0)), hilus], 0.055));
    for (const target of lobar[k]) {
      const mid = hilus.clone().lerp(target, 0.55);
      br.push(...tube([hilus, mid], 0.036));
      for (let j = 0; j < 3; j++) {
        const tip = target.clone().add(v(rnd() * 0.5, rnd() * 0.45, rnd() * 0.25));
        tip.z = s * Math.min(Math.abs(tip.z), wallZ(tip.x, tip.y) - 0.15);
        const m2 = mid.clone().lerp(tip, 0.5);
        br.push(...tube([mid, m2], 0.024), ...tube([m2, tip], 0.014));
        br.push(...tube([m2, m2.clone().add(v(rnd() * 0.3, rnd() * 0.3, s * Math.abs(rnd()) * 0.15))], 0.012));
      }
    }
  }
  parts.push({ name: 'bronchi_principales', tissue: 'airway', geometry: solid(br, { ...TUBE, fibers: true }) });
  parts.push({ name: 'trachea', tissue: 'airway', geometry: solid(tube(TRACHEA, 0.085, 24), { ...TUBE, fibers: true, subtract: tube([TRACHEA[0].clone().add(v(0.05, 0.04, 0)), ...TRACHEA.slice(1, -1), bif.clone().add(v(-0.06, 0, 0))], 0.062, 24), subK: 0.006 }) });

  // Laringe: epiglotis, tiroides, cricoides y aritenoides
  parts.push({
    name: 'larynx', tissue: 'cartilage',
    geometry: solid([
      ellipsoidB(v(3.9, 5.52, 0), basis(v(1, 0.6, 0), v(0, 0, 1)), v(0.16, 0.12, 0.13)), // cartílago tiroides
      cylinder2(v(3.76, 5.48, 0), v(3.7, 5.46, 0), 0.1), // cricoides
      ...chain([v(4.0, 5.66, 0), v(4.12, 5.76, 0), v(4.18, 5.82, 0)], (t) => 0.08 - 0.03 * t, { flat: { n: v(-0.6, 1, 0), f: 0.25 } }), // epiglotis
      ...[1, -1].map((s) => sphere(v(3.84, 5.62, s * 0.05), 0.04)), // aritenoides
    ], { voxel: 0.012, k: 0.012, subtract: tube([v(4.05, 5.62, 0), v(3.6, 5.44, 0)], 0.055), subK: 0.006 }),
  });
  // Cavidad nasal: meatos y cornetes (relieve de pliegues de la mucosa)
  const conchae: Prim[] = [];
  for (let i = 0; i < 5; i++) {
    for (const s of [1, -1]) conchae.push(...chain([v(4.7, 6.08 + i * 0.03, s * 0.06), v(5.2, 6.0 + i * 0.02, s * (0.1 + (i % 2) * 0.03)), v(5.6, 5.95 + i * 0.01, s * 0.06)], () => 0.04, { segs: 6, flat: { n: v(0, 1, 0), f: 0.5 } }));
  }
  parts.push({
    name: 'cavum_nasi', tissue: 'mucosa',
    geometry: solid([...chain([v(4.62, 6.12, 0), v(5.2, 6.04, 0), v(5.66, 5.97, 0)], (t) => 0.17 - 0.08 * t, { segs: 6, flat: { n: v(0, 0, 1), f: 0.75 } }), ...conchae], { voxel: 0.014, k: 0.015 }),
  });
}

/** Cilindro corto auxiliar (anillo cricoides). */
function cylinder2(a: V, b: V, r: number): Prim {
  return cone(a, b, r, r);
}

/* ============================== Digestivo ============================== */

function digestive(parts: Part[]) {
  parts.push({ name: 'lingua', tissue: 'tongue', geometry: solid(chain([v(4.2, 5.8, 0), v(4.6, 5.78, 0), v(5.1, 5.77, 0), v(5.48, 5.75, 0)], (t) => 0.15 - 0.07 * t, { segs: 8, flat: { n: v(0, 1, 0), f: 0.42 } }), { voxel: 0.014, k: 0.012, subtract: [boxB(v(4.9, 5.84, 0), basis(v(1, 0, 0), v(0, 0, 1)), v(0.6, 0.003, 0.004), 0.008)], subK: 0.01 }) });
  parts.push({ name: 'pharynx', tissue: 'gut', geometry: solid(tube([v(4.42, 5.98, 0), v(4.12, 5.86, 0), v(3.92, 5.76, 0), v(3.74, 5.66, 0)], (t) => 0.1 - 0.03 * t), { ...TUBE, fibers: true }) });
  parts.push({ name: 'oesophagus', tissue: 'gut', geometry: solid(tube(OESO, 0.055, 40), { ...TUBE, fibers: true }) });

  const stomR = [0.12, 0.3, 0.34, 0.3, 0.2, 0.1];
  const stomPts = [OESO[OESO.length - 1], v(-0.86, 4.48, -0.55), v(-1.1, 3.98, -0.62), v(-1.18, 3.55, -0.28), v(-1.0, 3.56, 0.18), v(-0.8, 3.8, 0.36)];
  parts.push({
    name: 'ventriculus', tissue: 'stomach',
    geometry: solid([...chain(stomPts, (t) => { const f = t * 5; const i = Math.floor(f); return stomR[i] + (stomR[Math.min(i + 1, 5)] - stomR[i]) * (f - i); }, { segs: 20 }), ellipsoid(v(-0.82, 4.42, -0.5), v(0.22, 0.26, 0.24))], { ...ORGAN, k: 0.05 }),
  });

  // Hígado: lámina gruesa adaptada a la cara abdominal del diafragma, dividida en lóbulos
  const c = DOME.c, r = DOME.r;
  const inner = (d: number) => ellipsoidB(c, [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)], r.clone().subScalar(d));
  const dIn = inner(0.05), dOut = inner(0.42);
  const liverShape: Prim = {
    d: (x, y, z) => Math.max(dIn.d(x, y, z), -dOut.d(x, y, z), c.x - 0.02 - x, y - (4.3 + (z > 0.2 ? 0.28 * Math.min(1, (z - 0.2) / 0.3) : 0))),
    min: v(c.x, 2.9, -1.0), max: v(c.x + r.x, 4.7, 1.0),
  };
  // Cisuras interlobulares radiales desde el hilio hepático (a = 0: ventral; a > 0: hacia la derecha)
  const hilus = v(-0.72, 4.0, 0.05);
  const lobeSlab = (a: number) => { const d = v(0, -Math.cos(a), Math.sin(a)); return boxB(hilus.clone().addScaledVector(d, 0.68), basis(v(0, Math.sin(a), Math.cos(a)), v(1, 0, 0)), v(0.022, 0.42, 0.75)); };
  parts.push({
    name: 'hepar', tissue: 'liver',
    geometry: solid([liverShape, ellipsoid(v(-0.68, 4.44, 0.38), v(0.2, 0.15, 0.15))], { voxel: 0.028, k: 0.03, subtract: [lobeSlab(-1.05), lobeSlab(-0.4), lobeSlab(0.25), lobeSlab(0.9), ellipsoid(KIDNEY(1), v(0.32, 0.19, 0.16)), ...tube(CVC.slice(2, 5), 0.08)], subK: 0.02, smooth: 3 }),
  });
  parts.push({ name: 'vesica_fellea', tissue: 'gallbladder', geometry: solid([ellipsoid(v(-0.62, 3.6, 0.2), v(0.1, 0.15, 0.09), [0, 0, 0.4]), ...tube([v(-0.6, 3.73, 0.2), v(-0.7, 3.88, 0.25), v(-0.82, 3.9, 0.35)], 0.016)], { voxel: 0.014, k: 0.012 }) });
  parts.push({
    name: 'pancreas', tissue: 'gland',
    geometry: solid([...tube([v(-0.86, 3.86, 0.42), v(-1.2, 3.96, 0.6), v(-1.75, 4.0, 0.6)], 0.06), ...tube([v(-0.86, 3.8, 0.28), v(-1.08, 3.9, -0.05), v(-1.24, 4.08, -0.42)], 0.055)], { voxel: 0.016, k: 0.02 }),
  });

  // Intestino delgado: duodeno, asas yeyunales e íleon
  const pts: V[] = [v(-0.8, 3.8, 0.36), v(-0.88, 3.96, 0.62), v(-1.5, 4.08, 0.66), v(-2.02, 4.04, 0.52), v(-1.88, 4.14, 0.1), v(-1.5, 4.14, -0.12)];
  let seed = 3;
  const rnd = () => ((seed = (seed * 48271) % 2147483647) / 2147483647) - 0.5;
  let dirZ = -1;
  for (let layer = 0; layer < 3; layer++) {
    const y = 3.88 - layer * 0.18;
    for (let row = 0; row < 6; row++) {
      const x = -1.05 - row * 0.19 - (layer % 2) * 0.09;
      const zEnd = 0.55 - Math.max(0, -x - 1.8) * 0.4;
      pts.push(v(x + rnd() * 0.06, y + rnd() * 0.05, dirZ * zEnd), v(x - 0.05 + rnd() * 0.08, y - 0.05 + rnd() * 0.06, dirZ * 0.2), v(x + rnd() * 0.06, y + rnd() * 0.06, -dirZ * 0.2), v(x + 0.03, y, -dirZ * zEnd));
      dirZ *= -1;
    }
  }
  pts.push(v(-1.75, 3.86, 0.34), v(-1.48, 3.98, 0.32));
  parts.push({ name: 'intestinum_tenue', tissue: 'gut', geometry: solid(chain(pts, (t) => (t < 0.06 ? 0.072 : 0.062), { segs: 420 }), { voxel: 0.024, k: 0.01 }) });
  parts.push({ name: 'caecum', tissue: 'colon', geometry: solid(tube([v(-1.5, 4.04, 0.32), v(-1.58, 3.92, 0.46), v(-1.7, 3.98, 0.52), v(-1.66, 4.1, 0.44), v(-1.58, 4.06, 0.38)], (t) => 0.075 - 0.035 * t), TUBE) });
  parts.push({ name: 'colon', tissue: 'colon', geometry: solid(tube([v(-1.5, 4.1, 0.3), v(-1.08, 4.28, 0.28), v(-0.98, 4.34, 0.0), v(-1.08, 4.32, -0.3), v(-1.6, 4.36, -0.36), v(-2.3, 4.42, -0.14), v(-2.6, 4.45, 0)], 0.1, 40), { ...ORGAN, k: 0.015 }) });
  parts.push({ name: 'rectum', tissue: 'colon', geometry: solid([...tube([v(-2.6, 4.45, 0), v(-3.0, 4.45, 0), v(-3.22, 4.43, 0)], (t) => 0.1 - 0.03 * t), ...[1, -1].map((s) => sphere(v(-3.16, 4.36, s * 0.09), 0.045))], TUBE) }); // con los sacos anales
}

/* ============================ Urogenital ============================ */

function urogenital(parts: Part[]) {
  for (const { s, k } of SIDES) {
    const kk = KIDNEY(s);
    parts.push({ name: `ren__${k}`, tissue: 'kidney', geometry: solid([ellipsoid(kk, v(0.3, 0.17, 0.13), [0, 0, 0.08])], { ...ORGAN, voxel: 0.018, subtract: [sphere(kk.clone().add(v(0, -0.02, -s * 0.17)), 0.08)], subK: 0.03 }) });
    parts.push({ name: `glandula_adrenalis__${k}`, tissue: 'adrenal', geometry: solid([ellipsoid(kk.clone().add(v(0.3, 0.06, -s * 0.2)), v(0.07, 0.03, 0.025)), sphere(kk.clone().add(v(0.24, 0.07, -s * 0.21)), 0.03)], FINE) });
    parts.push({ name: `ureter__${k}`, tissue: 'ureter', geometry: solid(tube([kk.clone().add(v(0, -0.02, -s * 0.14)), v(-1.8, 4.46, s * 0.25), v(-2.2, 4.1, s * 0.14), v(-2.3, 3.86, s * 0.06)], 0.02, 20), { ...FINE, fibers: true }) });

    const tc = v(-2.78, 2.96, s * 0.12);
    parts.push({ name: `testis__${k}`, tissue: 'gonad', geometry: solid([ellipsoid(tc, v(0.12, 0.155, 0.1), [0, 0, 0.5])], { ...ORGAN, voxel: 0.014 }) });
    parts.push({ name: `epididymis__${k}`, tissue: 'gland', geometry: solid([...tube([tc.clone().add(v(0.1, -0.08, s * 0.06)), tc.clone().add(v(0.02, 0.06, s * 0.08)), tc.clone().add(v(-0.1, 0.12, s * 0.06))], (t) => 0.04 + 0.012 * Math.cos(Math.PI * t * 2)), sphere(tc.clone().add(v(-0.11, 0.12, s * 0.05)), 0.05)], FINE) });
    parts.push({ name: `ductus_deferens__${k}`, tissue: 'ureter', geometry: solid(tube([tc.clone().add(v(-0.12, 0.14, s * 0.03)), v(-2.6, 3.24, s * 0.14), v(-2.35, 3.48, s * 0.26), v(-2.18, 3.7, s * 0.3), v(-2.12, 3.98, s * 0.16), v(-2.32, 3.96, s * 0.05), v(-2.55, 3.9, s * 0.02)], 0.014, 30), FINE) });

    const ov = v(s > 0 ? -1.33 : -1.62, 4.38, s * 0.42);
    parts.push({ name: `ovarium__${k}`, tissue: 'gonad', geometry: solid([ellipsoid(ov, v(0.075, 0.05, 0.05))], FINE) });
    const coil: V[] = [];
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 1.7; coil.push(ov.clone().add(v(Math.cos(a) * 0.08, Math.sin(a) * 0.065, s * 0.035 * Math.sin(a * 0.5)))); }
    parts.push({ name: `tuba_uterina__${k}`, tissue: 'uterus', geometry: solid(tube(coil, 0.012, 30), FINE) });
  }
  parts.push({ name: 'vesica_urinaria', tissue: 'bladder', geometry: solid(chain([v(-2.38, 3.84, 0), v(-2.15, 3.74, 0), v(-1.92, 3.62, 0), v(-1.72, 3.56, 0)], (t) => 0.06 + 0.24 * Math.pow(Math.sin(Math.PI * (0.15 + 0.75 * t)), 0.8), { segs: 10 }), ORGAN) });
  parts.push({ name: 'urethra@male', tissue: 'ureter', geometry: solid(tube([v(-2.38, 3.84, 0), v(-2.62, 3.88, 0), v(-3.0, 3.92, 0), v(-3.2, 3.72, 0), v(-3.06, 3.22, 0), v(-2.6, 3.06, 0), v(-1.5, 3.14, 0)], 0.024, 40), { ...FINE, fibers: true }) });
  parts.push({ name: 'urethra@female', tissue: 'ureter', geometry: solid(tube([v(-2.38, 3.84, 0), v(-2.68, 3.86, 0), v(-2.98, 3.83, 0)], 0.026), { ...FINE, fibers: true }) });
  parts.push({ name: 'prostata', tissue: 'gland', geometry: solid([sphere(v(-2.62, 3.88, 0.06), 0.11), sphere(v(-2.62, 3.88, -0.06), 0.11)], { voxel: 0.014, k: 0.03, subtract: [boxB(v(-2.62, 4.0, 0), basis(v(0, 0, 1), v(1, 0, 0)), v(0.012, 0.05, 0.2))], subK: 0.02 }) });
  parts.push({ name: 'penis', tissue: 'gonad', geometry: solid([...chain([v(-3.12, 3.58, 0), v(-2.75, 3.12, 0), v(-2.2, 3.05, 0), v(-1.45, 3.15, 0)], (t) => 0.075 - 0.025 * t, { segs: 12 }), ellipsoid(v(-1.98, 3.07, 0), v(0.12, 0.1, 0.1)), ...[1, -1].map((s) => cone(v(-3.12, 3.62, s * 0.05), v(-3.05, 3.85, s * 0.28), 0.05, 0.035))], { ...ORGAN, voxel: 0.014, k: 0.02 }) });

  const horn = (s: number) => { const ov = v(s > 0 ? -1.33 : -1.62, 4.38, s * 0.42); return [ov.clone().add(v(-0.1, -0.03, -s * 0.03)), v(-1.75, 4.14, s * 0.34), v(-2.05, 3.98, s * 0.14), v(-2.22, 3.95, 0)]; };
  parts.push({
    name: 'uterus', tissue: 'uterus',
    geometry: solid([...tube(horn(1), 0.052, 16), ...tube(horn(-1), 0.052, 16), ...tube([v(-2.22, 3.95, 0), v(-2.42, 3.95, 0)], 0.085)], {
      ...TUBE, fibers: true, alt: tube([v(-2.44, 3.95, 0), v(-2.54, 3.95, 0)], 0.075), altBlend: 0.02, // cérvix
    }),
  });
  parts.push({ name: 'vagina', tissue: 'uterus', geometry: solid(tube([v(-2.55, 3.95, 0), v(-3.0, 3.93, 0), v(-3.2, 3.82, 0)], 0.072), TUBE) });
  parts.push({ name: 'vulva', tissue: 'mucosa', geometry: solid([...[1, -1].map((s) => ellipsoid(v(-3.27, 3.78, s * 0.045), v(0.06, 0.13, 0.05), [0, 0, -0.2]))], { voxel: 0.012, k: 0.02 }) });
}

/* ============================ Nervioso ============================ */

function nervous(parts: Part[]) {
  parts.push({
    name: 'encephalon', tissue: 'brain',
    geometry: solid([
      ...[1, -1].map((s) => ellipsoid(v(4.22, 6.4, s * 0.15), v(0.42, 0.26, 0.17))), // hemisferios cerebrales
      ...[1, -1].map((s) => ellipsoid(v(4.6, 6.36, s * 0.1), v(0.12, 0.13, 0.1))), // lóbulos frontales
      ...[1, -1].map((s) => ellipsoid(v(4.74, 6.36, s * 0.045), v(0.07, 0.06, 0.04))), // bulbos olfatorios
    ], { voxel: 0.014, k: 0.025, subtract: [boxB(v(4.22, 6.62, 0), basis(v(0, 0, 1), v(1, 0, 0)), v(0.006, 0.2, 0.5), 0.004)], subK: 0.015 }), // cisura longitudinal
  });
  parts.push({ name: 'cerebellum', tissue: 'cerebellum', geometry: solid([ellipsoid(v(3.83, 6.34, 0), v(0.13, 0.16, 0.08)), ...[1, -1].map((s) => ellipsoid(v(3.84, 6.3, s * 0.12), v(0.12, 0.14, 0.1)))], { voxel: 0.012, k: 0.02 }) });
  parts.push({ name: 'truncus_encephali', tissue: 'cord', geometry: solid([...tube([v(4.14, 6.26, 0), v(3.94, 6.18, 0), v(3.66, 6.15, 0)], (t) => 0.085 - 0.03 * t), sphere(v(3.96, 6.14, 0), 0.085)], { voxel: 0.012, k: 0.02, fibers: true }) });

  const canal = canalPath();
  const cordPts = [v(3.66, 6.15, 0), ...canal.filter((p) => p.x > -2.12)];
  const cordR = (t: number) => {
    const x = new THREE.CatmullRomCurve3(cordPts).getPointAt(t).x;
    const cerv = Math.exp(-Math.pow((x - 2.35) / 0.25, 2)) * 0.012; // intumescencia cervical (C6–T2)
    const lumb = Math.exp(-Math.pow((x + 1.75) / 0.2, 2)) * 0.012; // intumescencia lumbar (L4–L7)
    const conus = x < -1.95 ? Math.max(0, (x + 2.12) / 0.17) : 1; // cono medular
    return Math.max(0.012, (0.042 + cerv + lumb) * conus);
  };
  parts.push({ name: 'medulla_spinalis', tissue: 'cord', geometry: solid([...chain(cordPts, cordR, { segs: 90 }), ...chain(canal.filter((p) => p.x <= -2.05), () => 0.014, { segs: 6 })], { voxel: 0.012, k: 0.006, fibers: true }) }); // con la cola de caballo

  for (const { s, k } of SIDES) {
    const F = fore(s);
    const H = hind(s);
    const axilla = F.sh.clone().add(v(-0.22, -0.34, -s * 0.2));
    const roots = [0.68, 0.82, 0.95].map((t) => { const p = new THREE.CatmullRomCurve3(canal.slice(0, 8)).getPointAt(t); return p.add(v(0, -0.06, s * 0.12)); });
    roots.push(v(2.2, 4.98, s * 0.12), v(2.05, 4.96, s * 0.12));
    parts.push({ name: `plexus_brachialis__${k}`, tissue: 'nerve', geometry: solid(roots.flatMap((r) => tube([r, r.clone().lerp(axilla, 0.5).add(v(0, -0.05, s * 0.12)), axilla], 0.018)), { voxel: 0.012, k: 0.012, fibers: true }) });
    parts.push({ name: `n_radialis__${k}`, tissue: 'nerve', geometry: solid(tube([axilla, F.sh.clone().add(v(-0.25, -0.6, s * 0.0)), F.el.clone().add(v(0.02, 0.32, s * 0.1)), F.el.clone().add(v(0.12, -0.15, s * 0.08)), F.ca.clone().add(v(0.06, 0.3, s * 0.05))], 0.024, 30), { voxel: 0.012, k: 0.008, fibers: true }) });
    parts.push({ name: `n_femoralis__${k}`, tissue: 'nerve', geometry: solid([...tube([v(-1.65, 4.68, s * 0.12), v(-2.05, 4.36, s * 0.24), v(-2.18, 3.96, s * 0.36), v(-2.06, 3.62, s * 0.44)], 0.022), ...[0.1, -0.05].map((dx) => tube([v(-2.06, 3.62, s * 0.44), v(-2.0 + dx, 3.35, s * 0.5)], 0.012)).flat()], { voxel: 0.012, k: 0.008, fibers: true }) });
    const sciaticEnd = v(-2.38, 2.98, s * 0.58);
    parts.push({
      name: `n_ischiadicus__${k}`, tissue: 'nerve',
      geometry: solid([
        ...tube([v(-2.2, 4.62, s * 0.18), v(-2.55, 4.5, s * 0.4), v(-2.8, 4.18, s * 0.55), v(-2.66, 3.4, s * 0.6), sciaticEnd], (t) => 0.036 - 0.008 * t, 30),
        ...tube([sciaticEnd, H.st.clone().add(v(-0.22, -0.4, s * 0.0)), H.ta.clone().add(v(-0.14, 0.32, -s * 0.02))], 0.022), // n. tibial
        ...tube([sciaticEnd, H.st.clone().add(v(-0.06, -0.18, s * 0.13)), H.st.clone().add(v(0.06, -0.6, s * 0.08))], 0.018), // n. fibular común
      ], { voxel: 0.012, k: 0.01, fibers: true }),
    });
    parts.push({ name: `n_vagus__${k}`, tissue: 'nerve', geometry: solid(tube([v(3.78, 5.92, s * 0.16), v(3.02, 5.08, s * 0.15), v(2.25, 4.72, s * 0.13), v(1.4, 4.6, s * 0.11), v(0.6, 4.58, s * 0.08), v(-0.2, 4.48, -0.12 + s * 0.06), v(-0.55, 4.36, -0.24 + s * 0.05)], 0.015, 40), { voxel: 0.01, k: 0.006, fibers: true }) });
    const eye = SKULL.orbit(s).add(v(0.04, 0.0, s * 0.02));
    parts.push({ name: `bulbus_oculi__${k}`, tissue: 'eye', geometry: solid([sphere(eye, 0.105), sphere(eye.clone().add(v(0.06, 0.0, s * 0.045)), 0.07)], { voxel: 0.01, k: 0.01 }) });
  }
}

/* ============================ Linfático ============================ */

function lymphatic(parts: Part[]) {
  for (const { s, k } of SIDES) {
    const F = fore(s);
    const H = hind(s);
    parts.push({ name: `ln_mandibulares__${k}`, tissue: 'lymph', geometry: solid([ellipsoid(v(3.98, 5.52, s * 0.3), v(0.07, 0.05, 0.05)), ellipsoid(v(4.1, 5.5, s * 0.26), v(0.06, 0.045, 0.045))], FINE) });
    parts.push({ name: `ln_cervicales_superficiales__${k}`, tissue: 'lymph', geometry: solid([ellipsoid(F.sh.clone().add(v(0.34, 0.45, -s * 0.08)), v(0.12, 0.06, 0.05), [0, 0, 0.5])], FINE) });
    parts.push({ name: `ln_poplitei__${k}`, tissue: 'lymph', geometry: solid([ellipsoid(H.st.clone().add(v(-0.42, 0.05, 0)), v(0.08, 0.055, 0.045))], FINE) });
  }
  parts.push({ name: 'lien', tissue: 'spleen', geometry: solid(chain([v(-0.95, 4.42, -0.72), v(-1.22, 3.94, -0.76), v(-1.36, 3.48, -0.56)], (t) => 0.12 + 0.03 * Math.sin(Math.PI * t), { segs: 8, flat: { n: v(0, 0, 1), f: 0.35 } }), ORGAN) });
  parts.push({ name: 'thymus', tissue: 'gland', geometry: solid([ellipsoid(v(1.68, 3.88, 0.06), v(0.26, 0.15, 0.08), [0, 0, 0.25]), ellipsoid(v(1.6, 3.84, -0.07), v(0.24, 0.14, 0.08), [0, 0, 0.2])], { voxel: 0.016, k: 0.02 }) });
}

/* ============================ Ensamblado ============================ */

export function buildViscera(parts: Part[]) {
  const h = heart();
  parts.push({ name: 'cor', tissue: 'heart', geometry: solid(h.main, { voxel: 0.02, k: 0.05, alt: h.fat, altBlend: 0.03 }) });
  vessels(parts);
  lungs(parts);
  digestive(parts);
  urogenital(parts);
  nervous(parts);
  lymphatic(parts);
}
