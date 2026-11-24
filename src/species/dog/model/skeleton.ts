/**
 * Sistema óseo y articular del modelo esquemático.
 * Cada hueso se modela como unión suave de primitivas SDF con sus accidentes principales
 * (cabezas, cóndilos, tubérculos, apófisis, forámenes), según Evans & de Lahunta (2020).
 */
import * as THREE from 'three';
import { basis, boxB, chain, cone, cylinder, ellipsoid, ellipsoidB, type Prim, solid, sphere } from '../sdf';
import {
  CANAL_R, canalOffset, CAUD, CERV, fore, frameAt, hind, LUMB, type Part, SACR, SIDES, THOR, v, type V,
} from './common';

const BONE = { voxel: 0.019, k: 0.012 };
const FINE = { voxel: 0.012, k: 0.007 };

/* ================================ Cráneo ================================ */

export const SKULL = {
  brain: { c: v(4.18, 6.36, 0), r: v(0.5, 0.36, 0.34) },
  orbit: (s: number) => v(4.66, 6.3, s * 0.3),
  nose: v(5.72, 5.96, 0),
  tmj: (s: number) => v(4.0, 5.98, s * 0.34), // articulación temporomandibular
};

function cranium(): Prim[] {
  const b = SKULL.brain;
  const p: Prim[] = [
    ellipsoid(b.c, v(b.r.x + 0.06, b.r.y + 0.06, b.r.z + 0.06)), // neurocráneo
    cone(v(3.78, 6.6, 0), v(4.5, 6.76, 0), 0.04, 0.03, { n: v(0, 0, 1), f: 0.35 }), // cresta sagital externa
    cone(v(3.72, 6.2, -0.28), v(3.72, 6.2, 0.28), 0.06, 0.06, { n: v(1, 0, 0), f: 0.5 }), // cresta nucal
    // región facial: huesos nasales (dorsal) y maxilares (lateral) hasta la abertura nasal
    cone(v(4.62, 6.26, 0), v(5.7, 6.02, 0), 0.26, 0.14, { n: v(0, 1, 0), f: 0.9 }),
    cone(v(4.6, 6.02, 0), v(5.62, 5.88, 0), 0.31, 0.17, { n: v(0, 1, 0), f: 0.82 }),
    ellipsoid(v(4.7, 6.42, 0), v(0.2, 0.12, 0.2)), // senos frontales / stop
  ];
  for (const { s } of [{ s: 1 }, { s: -1 }]) {
    p.push(...chain([v(3.96, 6.03, s * 0.36), v(4.3, 6.0, s * 0.5), v(4.62, 6.1, s * 0.42), v(4.8, 6.22, s * 0.3)], () => 0.05, { segs: 8, flat: { n: v(0, 0, 1), f: 0.55 } })); // arco cigomático
    p.push(ellipsoid(v(3.92, 5.92, s * 0.2), v(0.11, 0.1, 0.09))); // bula timpánica
    p.push(sphere(v(3.66, 6.08, s * 0.08), 0.06)); // cóndilo occipital
    p.push(cone(v(4.62, 6.52, s * 0.28), v(4.75, 6.48, s * 0.4), 0.04, 0.02)); // apófisis cigomática del frontal
  }
  return p;
}

function craniumHoles(): Prim[] {
  const b = SKULL.brain;
  return [
    ellipsoid(b.c, b.r), // cavidad craneal
    sphere(v(3.6, 6.15, 0), 0.085), // foramen magno
    cone(v(4.8, 6.08, 0), v(5.8, 5.96, 0), 0.2, 0.1, { n: v(0, 1, 0), f: 0.85 }), // cavidad nasal
    ...[1, -1].map((s) => sphere(SKULL.orbit(s), 0.17)), // órbitas
    ...[1, -1].map((s) => ellipsoid(v(4.2, 6.32, s * 0.47), v(0.3, 0.22, 0.12))), // fosas temporales
  ];
}

function mandible(): Prim[] {
  const p: Prim[] = [];
  for (const { s } of SIDES) {
    p.push(...chain([v(3.92, 5.74, s * 0.34), v(4.3, 5.66, s * 0.31), v(4.9, 5.64, s * 0.22), v(5.55, 5.7, s * 0.05)], (t) => 0.09 - 0.025 * t, { segs: 10, flat: { n: v(0, 0, 1), f: 0.4 } }));
    p.push(cone(v(3.98, 5.75, s * 0.34), SKULL.tmj(s), 0.07, 0.045, { n: v(0, 0, 1), f: 0.45 })); // rama → apófisis condilar
    p.push(cone(v(4.1, 5.8, s * 0.33), v(4.08, 6.3, s * 0.35), 0.09, 0.04, { n: v(0, 0, 1), f: 0.28 })); // apófisis coronoides
    p.push(sphere(v(3.86, 5.7, s * 0.33), 0.04)); // apófisis angular
    p.push(ellipsoid(SKULL.tmj(s), v(0.05, 0.035, 0.07))); // cóndilo
  }
  return p;
}

/** Arcadas dentarias del perro: superior I3 C1 P4 M2, inferior I3 C1 P4 M3 (42 dientes). */
function teeth(): Prim[] {
  const p: Prim[] = [];
  for (const { s } of SIDES) {
    const upper = new THREE.CatmullRomCurve3([v(5.66, 5.84, s * 0.04), v(5.55, 5.82, s * 0.13), v(5.1, 5.8, s * 0.22), v(4.52, 5.82, s * 0.31)]);
    const lower = new THREE.CatmullRomCurve3([v(5.62, 5.74, s * 0.04), v(5.5, 5.75, s * 0.12), v(5.05, 5.74, s * 0.19), v(4.38, 5.73, s * 0.28)]);
    // [posición en la arcada, altura, radio] — el carnicero es el P4 superior y el M1 inferior
    const up: [number, number, number][] = [[0.0, 0.06, 0.016], [0.04, 0.065, 0.017], [0.08, 0.07, 0.019], [0.17, 0.17, 0.035], [0.3, 0.045, 0.02], [0.42, 0.06, 0.026], [0.55, 0.07, 0.03], [0.7, 0.1, 0.045], [0.84, 0.06, 0.045], [0.95, 0.04, 0.035]];
    const lo: [number, number, number][] = [[0.0, 0.055, 0.015], [0.04, 0.06, 0.016], [0.08, 0.065, 0.018], [0.15, 0.15, 0.032], [0.26, 0.04, 0.018], [0.36, 0.055, 0.024], [0.47, 0.065, 0.027], [0.58, 0.07, 0.03], [0.73, 0.09, 0.045], [0.88, 0.06, 0.034], [0.97, 0.035, 0.022]];
    for (const [t, h, r] of up) {
      const a = upper.getPointAt(t);
      p.push(cone(a.clone().add(v(0, 0.03, 0)), a.clone().add(v(t > 0.1 && t < 0.2 ? -0.02 : 0, -h, 0)), r, r * 0.35, { n: v(0, 0, 1), f: t > 0.25 ? 0.6 : 1 }));
    }
    for (const [t, h, r] of lo) {
      const a = lower.getPointAt(t);
      p.push(cone(a.clone().add(v(0, -0.03, 0)), a.clone().add(v(t > 0.1 && t < 0.2 ? 0.02 : 0, h, 0)), r, r * 0.35, { n: v(0, 0, 1), f: t > 0.25 ? 0.6 : 1 }));
    }
  }
  return p;
}

/* =============================== Columna =============================== */

interface VSpec { r: number; spineH: number; spineLean: number; transLen: number; transDrop: number; transLean: number; flatSpine?: number }

function vertebraPrims(c: THREE.CatmullRomCurve3, t0: number, t1: number, sp: VSpec, kind?: 'atlas' | 'axis'): Prim[] {
  const a = c.getPointAt(t0), b = c.getPointAt(t1);
  const f = frameAt(c, (t0 + t1) / 2);
  const L = a.distanceTo(b);
  const out: Prim[] = [];
  const r = sp.r;
  const gap = 0.016;
  const a2 = a.clone().addScaledVector(f.t, gap), b2 = b.clone().addScaledVector(f.t, -gap);
  if (kind !== 'atlas') out.push(cylinder(a2, b2, r, r * 0.25));
  else out.push(cylinder(a2.clone().addScaledVector(f.t, L * 0.25), b2, r * 0.5, 0.01));
  // arco vertebral: anillo alrededor del canal (el canal se sustrae después)
  const cc = f.p.clone().addScaledVector(f.u, canalOffset(r));
  const B = basis(f.t, f.w);
  out.push(boxB(cc, B, v(L * 0.32, CANAL_R + 0.03, CANAL_R + 0.035), 0.02));
  // apófisis articulares
  for (const s of [1, -1]) {
    out.push(sphere(cc.clone().addScaledVector(f.u, CANAL_R * 0.6).addScaledVector(f.w, s * (CANAL_R + 0.02)).addScaledVector(f.t, -L * 0.42), 0.03));
    out.push(sphere(cc.clone().addScaledVector(f.u, CANAL_R * 0.6).addScaledVector(f.w, s * (CANAL_R + 0.02)).addScaledVector(f.t, L * 0.42), 0.028));
  }
  // apófisis espinosa (lámina aplanada lateralmente)
  if (sp.spineH > 0) {
    const base = cc.clone().addScaledVector(f.u, CANAL_R + 0.02);
    const tip = base.clone().addScaledVector(f.u, sp.spineH).addScaledVector(f.t, sp.spineLean);
    out.push(cone(base, tip, Math.min(L * 0.38, 0.075), 0.028, { n: v(0, 0, 1), f: sp.flatSpine ?? 0.35 }));
  }
  // apófisis transversas
  if (sp.transLen > 0) {
    for (const s of [1, -1]) {
      const root = f.p.clone().addScaledVector(f.u, r * 0.4).addScaledVector(f.w, s * r * 0.8);
      const tip = root.clone().addScaledVector(f.w, s * sp.transLen).addScaledVector(f.u, -sp.transDrop).addScaledVector(f.t, sp.transLean);
      out.push(cone(root, tip, 0.04, 0.025, { n: f.u, f: 0.45 }));
    }
  }
  if (kind === 'atlas') {
    for (const s of [1, -1]) out.push(ellipsoidB(f.p.clone().addScaledVector(f.w, s * 0.16).addScaledVector(f.u, 0.06), B, v(0.1, 0.025, 0.1))); // alas del atlas
  }
  if (kind === 'axis') {
    out.push(cone(a2, a2.clone().addScaledVector(f.t, -0.12), 0.045, 0.03)); // diente del axis
    out.push(cone(cc.clone().addScaledVector(f.u, CANAL_R + 0.06).addScaledVector(f.t, L * 0.3), cc.clone().addScaledVector(f.u, CANAL_R + 0.12).addScaledVector(f.t, -L * 0.75), 0.07, 0.05, { n: v(0, 0, 1), f: 0.3 }));
  }
  return out;
}

function region(c: THREE.CatmullRomCurve3, n: number, spec: (i: number) => VSpec, kinds: Record<number, 'atlas' | 'axis'> = {}) {
  const prims: Prim[] = [];
  const discs: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const sp = spec(i);
    prims.push(...vertebraPrims(c, i / n, (i + 1) / n, sp, kinds[i]));
    if (i > 0 && !(kinds[i] === 'axis')) {
      const p = c.getPointAt(i / n);
      const f = frameAt(c, i / n);
      discs.push(cylinder(p.clone().addScaledVector(f.t, -0.016), p.clone().addScaledVector(f.t, 0.016), sp.r * 0.95, 0.008));
    }
  }
  return { prims, discs };
}

/** Canal vertebral continuo (se sustrae de los arcos para que la médula quede alojada). */
export function canalPath(): V[] {
  const pts: V[] = [];
  const add = (c: THREE.CatmullRomCurve3, r0: number, r1: number, n: number) => {
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const f = frameAt(c, Math.min(t, 0.999));
      pts.push(f.p.clone().addScaledVector(f.u, canalOffset(r0 + (r1 - r0) * t)));
    }
  };
  add(CERV, 0.1, 0.095, 6);
  add(THOR, 0.085, 0.09, 8);
  add(LUMB, 0.1, 0.1, 5);
  add(SACR, 0.09, 0.07, 2);
  return pts;
}

function canal(): Prim[] {
  return chain(canalPath(), () => CANAL_R, { segs: 60 });
}

/* =============================== Costillas =============================== */

const RIB_W = [0.56, 0.66, 0.74, 0.8, 0.85, 0.88, 0.9, 0.91, 0.91, 0.9, 0.87, 0.83, 0.78];
export const STERNUM = new THREE.CatmullRomCurve3([v(2.32, 3.4, 0), v(1.6, 3.1, 0), v(0.6, 2.98, 0), v(-0.25, 3.05, 0), v(-0.62, 3.16, 0)]);

function ribs(s: number) {
  const bone: Prim[] = [];
  const cart: Prim[] = [];
  let prevEnd: V | null = null;
  for (let i = 0; i < 13; i++) {
    const head = frameAt(THOR, i / 13 + 0.01);
    const tub = frameAt(THOR, (i + 0.45) / 13);
    const W = RIB_W[i];
    const h = head.p;
    const ccY = i < 9 ? 3.32 + Math.max(0, i - 4) * 0.05 : 3.55 + (i - 9) * 0.18;
    const cc = v(h.x - 0.45 - i * 0.025, ccY, s * W * 0.86);
    const pts = [
      h.clone().add(v(0, -0.02, s * 0.06)),
      tub.p.clone().add(v(-0.02, 0.06, s * 0.15)),
      v(h.x - 0.1, h.y - 0.12, s * W * 0.62),
      v(h.x - 0.22, h.y - 0.55, s * W * 0.95),
      v(h.x - 0.34, h.y - 1.05, s * W),
      cc,
    ];
    if (i === 12) pts.splice(4, 2, v(h.x - 0.36, 3.95, s * W * 0.98));
    bone.push(...chain(pts, (t) => 0.034 - 0.008 * t, { segs: 12, flat: { n: v(1, 0, 0), f: 0.75 } }));
    if (i < 9) {
      const st = STERNUM.getPointAt(i === 0 ? 0.04 : Math.min(0.98, i / 8.7));
      cart.push(...chain([cc, v((cc.x + st.x) / 2 + 0.02, st.y + 0.04, s * W * 0.5), st.clone().add(v(0, 0.02, s * 0.06))], () => 0.026, { segs: 6 }));
      prevEnd = v((cc.x + st.x) / 2, st.y + 0.08, s * W * 0.5);
    } else if (i < 12 && prevEnd) {
      // costillas asternales: sus cartílagos se unen al anterior y forman el arco costal
      const end = v(prevEnd.x - 0.02, prevEnd.y + 0.12, s * RIB_W[i] * 0.66);
      cart.push(...chain([cc, v((cc.x + end.x) / 2 - 0.06, (cc.y + end.y) / 2 - 0.05, s * W * 0.76), end], () => 0.022, { segs: 6 }));
      prevEnd = end;
    } else if (i === 12) {
      const tip = pts[pts.length - 1];
      cart.push(cone(tip, tip.clone().add(v(-0.1, -0.1, -s * 0.02)), 0.02, 0.012)); // costilla flotante
    }
  }
  return { bone, cart };
}

function sternum() {
  const bone: Prim[] = [];
  const cart: Prim[] = [];
  for (let i = 0; i < 8; i++) {
    const a = STERNUM.getPointAt(i / 8 + 0.012), b = STERNUM.getPointAt((i + 1) / 8 - 0.012);
    bone.push(cylinder(a, b, i === 0 ? 0.06 : i === 7 ? 0.045 : 0.055, 0.02));
    if (i < 7) cart.push(sphere(STERNUM.getPointAt((i + 1) / 8), 0.045)); // cartílagos intraesternebrales
  }
  cart.push(...chain([v(-0.62, 3.16, 0), v(-0.82, 3.2, 0), v(-0.92, 3.26, 0)], (t) => 0.05 - 0.03 * t, { flat: { n: v(0, 1, 0), f: 0.3 } })); // cartílago xifoides
  cart.push(cone(v(2.32, 3.4, 0), v(2.45, 3.5, 0), 0.04, 0.03)); // cartílago del manubrio
  return { bone, cart };
}

/* ============================ Miembro torácico ============================ */

export const humeralHead = (s: number) => fore(s).sh.clone().add(v(-0.04, -0.04, -s * 0.02));

function scapula(s: number): Prim[] {
  const F = fore(s);
  const axis = F.scTop.clone().sub(F.sh).normalize();
  const B = basis(axis, v(0, 0, s)); // ex: eje largo, ey: craneal/caudal, ez: lateral
  const ey = B[1].x > 0 ? B[1] : B[1].clone().negate();
  const n = B[2];
  const G = F.sh.clone().addScaledVector(axis, 0.1).addScaledVector(n, -0.02);
  return [
    cone(G, G.clone().addScaledVector(axis, 0.28), 0.085, 0.06, { n, f: 0.55 }), // cuello y cavidad glenoidea
    ellipsoidB(F.sh.clone().addScaledVector(axis, 0.74).addScaledVector(ey, -0.02), [axis, ey, n], v(0.56, 0.32, 0.022)), // lámina
    cone(G.clone().addScaledVector(axis, 0.12).addScaledVector(n, 0.03), F.sh.clone().addScaledVector(axis, 1.22).addScaledVector(n, 0.02), 0.075, 0.025, { n: ey, f: 0.28 }), // espina
    sphere(G.clone().addScaledVector(axis, 0.12).addScaledVector(n, 0.06), 0.045), // acromion
    sphere(G.clone().addScaledVector(ey, 0.08).addScaledVector(axis, 0.04), 0.04), // tubérculo supraglenoideo
  ];
}

function humerus(s: number): Prim[] {
  const F = fore(s);
  const top = F.sh.clone().add(v(0.02, -0.12, s * 0.01));
  const bot = F.el.clone().add(v(0.01, 0.12, 0));
  const mid = top.clone().lerp(bot, 0.45).add(v(0.04, 0, 0));
  return [
    sphere(humeralHead(s), 0.12), // cabeza
    ellipsoid(F.sh.clone().add(v(0.13, 0.0, s * 0.04)), v(0.065, 0.1, 0.06)), // tubérculo mayor
    ellipsoid(F.sh.clone().add(v(0.07, -0.06, -s * 0.07)), v(0.04, 0.05, 0.035)), // tubérculo menor
    ...chain([top, mid, bot], (t) => 0.07 - 0.02 * Math.sin(Math.PI * t), { segs: 6 }),
    ellipsoid(top.clone().lerp(bot, 0.3).add(v(0.03, 0, s * 0.05)), v(0.03, 0.09, 0.025)), // tuberosidad deltoidea
    sphere(F.el.clone().add(v(0.02, -0.01, s * 0.055)), 0.072), // capítulo
    sphere(F.el.clone().add(v(0.02, -0.01, -s * 0.05)), 0.075), // tróclea
    sphere(F.el.clone().add(v(-0.04, 0.04, s * 0.11)), 0.045), // epicóndilo lateral
    sphere(F.el.clone().add(v(-0.04, 0.04, -s * 0.11)), 0.05), // epicóndilo medial
  ];
}
const humerusHoles = (s: number) => [cone(fore(s).el.clone().add(v(-0.12, 0.1, 0)), fore(s).el.clone().add(v(0.12, 0.1, 0)), 0.024, 0.024)]; // foramen supratroclear

function radius(s: number): Prim[] {
  const F = fore(s);
  const a = F.el.clone().add(v(0.05, -0.07, 0));
  const b = F.ca.clone().add(v(0.03, 0.06, 0));
  return [
    ellipsoid(a, v(0.05, 0.035, 0.08)), // cabeza (fóvea)
    ...chain([a, a.clone().lerp(b, 0.5).add(v(0.035, 0, 0)), b], (t) => 0.045 + 0.02 * t, { segs: 6, flat: { n: v(1, 0, 0), f: 0.7 } }),
    ellipsoid(b.clone().add(v(0, -0.02, 0)), v(0.05, 0.04, 0.09)), // tróclea distal
    sphere(b.clone().add(v(0, -0.05, -s * 0.08)), 0.03), // apófisis estiloides medial
  ];
}

function ulna(s: number): Prim[] {
  const F = fore(s);
  const tuber = F.el.clone().add(v(-0.22, 0.26, s * 0.0));
  return [
    ...chain([tuber, F.el.clone().add(v(-0.1, 0.02, s * 0.01)), F.el.clone().add(v(-0.06, -0.35, s * 0.04)), F.ca.clone().add(v(-0.06, 0.08, s * 0.06))], (t) => (t < 0.25 ? 0.07 : 0.05 - 0.02 * t), { segs: 10, flat: { n: v(0, 0, 1), f: 0.6 } }),
    sphere(tuber, 0.06), // tuberosidad del olécranon
    sphere(F.el.clone().add(v(-0.06, 0.1, 0)), 0.04), // apófisis ancónea
    sphere(F.ca.clone().add(v(-0.06, 0.0, s * 0.07)), 0.03), // apófisis estiloides lateral
  ];
}
const ulnaHoles = (s: number) => [sphere(fore(s).el.clone().add(v(0.02, -0.01, 0)), 0.085)]; // escotadura troclear

/** Puntos de los dedos II–V: cabeza del metapodio y extremos de las tres falanges. */
export function digits(top: V, mcp: V, s: number) {
  const zs = [-0.105, -0.036, 0.036, 0.105].map((z) => z * s); // dedos II–V (de medial a lateral)
  return zs.map((z, j) => {
    const central = j === 1 || j === 2;
    const head = v(mcp.x + (central ? 0.03 : 0), mcp.y + 0.03, top.z + z * 1.25);
    const len = central ? 1 : 0.85;
    const p1 = head.clone().add(v(0.17 * len, -0.1, 0));
    const p2 = p1.clone().add(v(0.1 * len, -0.025, 0));
    const p3 = p2.clone().add(v(0.09 * len, -0.06, 0));
    return { z, head, p1, p2, p3, base: top.clone().add(v(0.02, -0.16, z)) };
  });
}

/** Mano o pie: carpo/tarso, metacarpianos/metatarsianos y falanges. */
function autopod(top: V, mcp: V, s: number, hind: boolean): Prim[] {
  const out: Prim[] = [];
  const zMed = -s * 0.15;
  // huesos del carpo/tarso (dos filas)
  for (const [dx, dy, z, r] of [[0.0, 0.0, 0.06, 0.055], [0.0, 0.0, -0.06, 0.06], [-0.01, -0.09, 0.08, 0.04], [0.0, -0.09, 0.0, 0.045], [0.01, -0.09, -0.08, 0.04]] as const) {
    out.push(sphere(top.clone().add(v(dx, dy, s * z)), r));
  }
  if (!hind) out.push(cone(top.clone().add(v(-0.04, 0.0, s * 0.06)), top.clone().add(v(-0.16, -0.01, s * 0.07)), 0.045, 0.04)); // hueso carpiano accesorio
  digits(top, mcp, s).forEach(({ head, base, p1, p2, p3 }) => {
    out.push(...chain([base, base.clone().lerp(head, 0.5).add(v(0.01, 0, 0)), head], (t) => 0.026 - 0.006 * Math.sin(Math.PI * t), { segs: 4 })); // metapodio
    out.push(sphere(head, 0.035));
    out.push(sphere(head.clone().add(v(-0.045, -0.02, 0.018)), 0.016), sphere(head.clone().add(v(-0.045, -0.02, -0.018)), 0.016)); // sesamoideos
    out.push(cone(head, p1, 0.028, 0.024), cone(p1, p2, 0.024, 0.02), cone(p2, p3, 0.02, 0.008)); // falanges
    out.push(sphere(p2.clone().add(v(0.01, 0.0, 0)), 0.022)); // cresta ungueal
  });
  if (!hind) {
    // dedo I (espolón): metacarpiano corto y dos falanges
    const b1 = top.clone().add(v(0.03, -0.14, zMed));
    const h1 = b1.clone().add(v(0.03, -0.2, -s * 0.01));
    out.push(cone(b1, h1, 0.02, 0.022), cone(h1, h1.clone().add(v(0.06, -0.06, 0)), 0.02, 0.016), cone(h1.clone().add(v(0.06, -0.06, 0)), h1.clone().add(v(0.11, -0.1, 0)), 0.016, 0.006));
  }
  return out;
}

/* ============================ Miembro pélvico ============================ */

function osCoxae(s: number): Prim[] {
  const H = hind(s);
  const wingAxis = v(1, 0.85, 0).normalize();
  const B = basis(wingAxis, v(0.15, -0.1, s));
  return [
    sphere(H.hi.clone().add(v(0, 0, -s * 0.06)), 0.14), // cuerpo y acetábulo
    ...chain([H.hi.clone().add(v(0.06, 0.1, -s * 0.06)), v(-2.15, 4.62, s * 0.4), v(-1.98, 4.8, s * 0.34)], () => 0.07, { segs: 4, flat: { n: v(0, 0, 1), f: 0.6 } }), // cuerpo del ilion
    ellipsoidB(v(-1.92, 4.88, s * 0.32), B, v(0.34, 0.2, 0.028)), // ala del ilion
    ...chain([H.hi.clone().add(v(0.05, -0.08, -s * 0.08)), v(-2.48, 3.98, s * 0.25), v(-2.55, 3.94, s * 0.04)], () => 0.045, { segs: 5, flat: { n: v(0, 1, 0), f: 0.55 } }), // pubis
    ...chain([H.hi.clone().add(v(-0.1, -0.02, -s * 0.04)), v(-2.85, 4.2, s * 0.4), v(-3.12, 4.22, s * 0.38)], (t) => 0.065 - 0.015 * t, { segs: 5 }), // isquion
    ellipsoid(v(-3.13, 4.2, s * 0.38), v(0.065, 0.075, 0.06)), // tuberosidad isquiática
    ...chain([v(-3.08, 4.12, s * 0.34), v(-2.96, 4.0, s * 0.16), v(-2.92, 3.97, s * 0.02)], () => 0.07, { segs: 4, flat: { n: v(0, 1, 0), f: 0.35 } }), // tabla del isquion
    cone(v(-2.55, 3.94, s * 0.02), v(-2.92, 3.97, s * 0.02), 0.045, 0.045, { n: v(0, 0, 1), f: 0.5 }), // sínfisis
  ];
}
export const femoralHead = (s: number) => hind(s).hi.clone();
const coxaeHoles = (s: number) => [sphere(femoralHead(s), 0.108)];

function femur(s: number): Prim[] {
  const H = hind(s);
  const P0 = H.hi.clone().add(v(-0.02, -0.08, s * 0.13));
  const bot = H.st.clone().add(v(0, 0.16, 0));
  return [
    sphere(femoralHead(s), 0.1),
    cone(H.hi, P0, 0.065, 0.075), // cuello
    ellipsoid(P0.clone().add(v(-0.05, 0.09, s * 0.04)), v(0.07, 0.08, 0.05)), // trocánter mayor
    sphere(P0.clone().add(v(-0.07, -0.15, -s * 0.03)), 0.035), // trocánter menor
    ...chain([P0, P0.clone().lerp(bot, 0.5).add(v(0.03, 0, 0)), bot], (t) => 0.068 - 0.012 * Math.sin(Math.PI * t), { segs: 6 }),
    sphere(H.st.clone().add(v(-0.04, 0.02, s * 0.065)), 0.075), // cóndilo lateral
    sphere(H.st.clone().add(v(-0.04, 0.02, -s * 0.065)), 0.075), // cóndilo medial
    ellipsoid(H.st.clone().add(v(0.07, 0.09, s * 0.045)), v(0.04, 0.08, 0.03)), // labios de la tróclea
    ellipsoid(H.st.clone().add(v(0.07, 0.09, -s * 0.045)), v(0.04, 0.08, 0.03)),
  ];
}

function tibia(s: number): Prim[] {
  const H = hind(s);
  const top = H.st.clone().add(v(0, -0.12, 0));
  const bot = H.ta.clone().add(v(0.03, 0.1, 0));
  return [
    ellipsoid(H.st.clone().add(v(-0.02, -0.09, s * 0.06)), v(0.085, 0.045, 0.06)), // cóndilos tibiales
    ellipsoid(H.st.clone().add(v(-0.02, -0.09, -s * 0.06)), v(0.085, 0.045, 0.06)),
    sphere(H.st.clone().add(v(0.1, -0.13, 0)), 0.05), // tuberosidad tibial
    cone(H.st.clone().add(v(0.1, -0.13, 0)), H.st.clone().add(v(0.05, -0.5, 0)), 0.04, 0.02, { n: v(0, 0, 1), f: 0.5 }), // borde craneal
    ...chain([top, top.clone().lerp(bot, 0.5), bot], (t) => 0.06 - 0.015 * Math.sin(Math.PI * t), { segs: 6 }),
    sphere(H.ta.clone().add(v(0.03, 0.03, 0)), 0.06), // cóclea
    sphere(H.ta.clone().add(v(0.02, 0.01, -s * 0.075)), 0.035), // maléolo medial
  ];
}

function fibula(s: number): Prim[] {
  const H = hind(s);
  return [
    sphere(H.st.clone().add(v(-0.07, -0.13, s * 0.1)), 0.04),
    cone(H.st.clone().add(v(-0.07, -0.13, s * 0.1)), H.ta.clone().add(v(0, 0.1, s * 0.08)), 0.024, 0.02),
    sphere(H.ta.clone().add(v(0, 0.02, s * 0.08)), 0.034), // maléolo lateral
  ];
}

function pesExtra(s: number): Prim[] {
  const H = hind(s);
  return [
    ellipsoid(H.ta.clone().add(v(0.02, -0.06, 0)), v(0.06, 0.07, 0.06)), // talus
    cone(H.ta.clone().add(v(0.0, -0.12, s * 0.03)), H.ta.clone().add(v(-0.3, 0.06, s * 0.02)), 0.045, 0.05), // calcáneo y tuberosidad calcánea
  ];
}

/* =============================== Ensamblado =============================== */

/** Devuelve las primitivas que condicionan el contorno de la piel (cabeza y porción distal de los miembros). */
export function buildSkeleton(parts: Part[]): Prim[] {
  const hull: Prim[] = [...cranium(), ...mandible()];
  parts.push({ name: 'cranium', tissue: 'bone', geometry: solid(cranium(), { ...BONE, subtract: craniumHoles(), subK: 0.02 }) });
  parts.push({ name: 'mandibula', tissue: 'bone', geometry: solid(mandible(), BONE) });
  parts.push({ name: 'dentes', tissue: 'tooth', geometry: solid(teeth(), FINE) });

  const thoracicSpine = (i: number): VSpec => {
    const anticlinal = 10; // T11
    const lean = i < anticlinal ? 0.1 + 0.03 * (anticlinal - i) / anticlinal : i === anticlinal ? 0 : -0.05;
    return { r: 0.085, spineH: Math.max(0.13, 0.36 - i * 0.022), spineLean: lean, transLen: 0.06, transDrop: -0.04, transLean: 0 };
  };
  const cerv = region(CERV, 7, (i) => ({ r: 0.1, spineH: i === 6 ? 0.12 : i > 1 ? 0.03 : 0, spineLean: 0, transLen: i > 1 ? 0.09 : 0, transDrop: 0.06, transLean: 0.02 }), { 0: 'atlas', 1: 'axis' });
  const thor = region(THOR, 13, thoracicSpine);
  const lumb = region(LUMB, 7, () => ({ r: 0.1, spineH: 0.16, spineLean: -0.06, transLen: 0.24, transDrop: 0.06, transLean: -0.08, flatSpine: 0.45 }));
  const caud = region(CAUD, 20, (i) => ({ r: 0.075 - i * 0.0026, spineH: i < 4 ? 0.06 : 0, spineLean: 0.02, transLen: i < 6 ? 0.07 - i * 0.01 : 0, transDrop: 0, transLean: 0.02 }));
  const holes = canal();
  parts.push({ name: 'vertebrae_cervicales', tissue: 'bone', geometry: solid(cerv.prims, { ...BONE, subtract: holes, subK: 0.01 }) });
  parts.push({ name: 'vertebrae_thoracicae', tissue: 'bone', geometry: solid(thor.prims, { ...BONE, subtract: holes, subK: 0.01 }) });
  parts.push({ name: 'vertebrae_lumbales', tissue: 'bone', geometry: solid(lumb.prims, { ...BONE, subtract: holes, subK: 0.01 }) });
  parts.push({ name: 'vertebrae_caudales', tissue: 'bone', geometry: solid(caud.prims, BONE) });
  // Sacro: tres vértebras fusionadas con alas que articulan con el ilion
  const sf = frameAt(SACR, 0.4);
  parts.push({
    name: 'os_sacrum', tissue: 'bone',
    geometry: solid([
      ...chain([SACR.getPointAt(0), SACR.getPointAt(1)], (t) => 0.1 - 0.03 * t, { segs: 4, flat: { n: v(0, 1, 0), f: 0.7 } }),
      boxB(sf.p.clone().addScaledVector(sf.u, canalOffset(0.09)), basis(sf.t, sf.w), v(0.28, CANAL_R + 0.03, CANAL_R + 0.03), 0.02),
      ...[1, -1].map((s) => ellipsoidB(SACR.getPointAt(0.25).add(v(0, 0.02, s * 0.2)), basis(v(1, 0, 0), v(0, 0, 1)), v(0.14, 0.09, 0.1))),
      cone(SACR.getPointAt(0.5).add(v(0, 0.25, 0)), SACR.getPointAt(0.5).add(v(-0.05, 0.38, 0)), 0.1, 0.03, { n: v(0, 0, 1), f: 0.3 }), // cresta sacra media
    ], { ...BONE, subtract: holes, subK: 0.01 }),
  });
  parts.push({ name: 'disci_intervertebrales', tissue: 'disc', geometry: solid([...cerv.discs, ...thor.discs, ...lumb.discs], { voxel: 0.012, k: 0.006 }) });

  const st = sternum();
  parts.push({ name: 'sternum', tissue: 'bone', geometry: solid(st.bone, { ...BONE, alt: st.cart }) });

  for (const { s, k } of SIDES) {
    const r = ribs(s);
    parts.push({ name: `costae__${k}`, tissue: 'bone', geometry: solid(r.bone, { ...BONE, voxel: 0.022, alt: r.cart, altBlend: 0.02 }) });
    parts.push({ name: `scapula__${k}`, tissue: 'bone', geometry: solid(scapula(s), { ...BONE, subtract: [sphere(humeralHead(s), 0.13)] }) });
    const F = fore(s);
    const H = hind(s);
    // Cartílago articular: zonas de las superficies articulares pintadas con el color secundario
    parts.push({ name: `humerus__${k}`, tissue: 'bone', geometry: solid(humerus(s), { ...BONE, subtract: humerusHoles(s), paint: [sphere(humeralHead(s).add(v(-0.04, 0.06, 0)), 0.09)], paintBlend: 0.03 }) });
    parts.push({ name: `radius__${k}`, tissue: 'bone', geometry: solid(radius(s), BONE) });
    parts.push({ name: `ulna__${k}`, tissue: 'bone', geometry: solid(ulna(s), { ...BONE, subtract: ulnaHoles(s) }) });
    const manus = autopod(F.ca, F.mc, s, false);
    parts.push({ name: `ossa_manus__${k}`, tissue: 'bone', geometry: solid(manus, FINE) });
    parts.push({ name: `os_coxae__${k}`, tissue: 'bone', geometry: solid(osCoxae(s), { ...BONE, subtract: coxaeHoles(s), paint: [sphere(femoralHead(s), 0.13)], paintBlend: 0.02 }) });
    parts.push({ name: `femur__${k}`, tissue: 'bone', geometry: solid(femur(s), { ...BONE, paint: [sphere(femoralHead(s).add(v(0.0, 0.03, -s * 0.03)), 0.09)], paintBlend: 0.03 }) });
    parts.push({ name: `patella__${k}`, tissue: 'bone', geometry: solid([ellipsoid(H.st.clone().add(v(0.15, 0.13, 0)), v(0.045, 0.085, 0.045), [0, 0, -0.35])], FINE) });
    parts.push({ name: `tibia__${k}`, tissue: 'bone', geometry: solid(tibia(s), BONE) });
    parts.push({ name: `fibula__${k}`, tissue: 'bone', geometry: solid(fibula(s), FINE) });
    const pes = [...pesExtra(s), ...autopod(H.ta.clone().add(v(0.03, -0.16, 0)), H.mt, s, true)];
    parts.push({ name: `ossa_pedis__${k}`, tissue: 'bone', geometry: solid(pes, FINE) });
    hull.push(...manus, ...pes, ...radius(s), ...ulna(s), ...tibia(s), ...fibula(s));

    // Cápsulas articulares (translúcidas para ver las superficies óseas)
    const capsule = (c: V, r: V, rot?: [number, number, number]) => solid([ellipsoid(c, r, rot)], { voxel: 0.02, k: 0.01 });
    parts.push({ name: `art_humeri__${k}`, tissue: 'cartilage', baseOpacity: 0.45, geometry: capsule(F.sh.clone().add(v(-0.02, -0.02, 0)), v(0.19, 0.17, 0.15)) });
    parts.push({ name: `art_cubiti__${k}`, tissue: 'cartilage', baseOpacity: 0.45, geometry: capsule(F.el.clone().add(v(-0.04, 0.0, 0)), v(0.17, 0.15, 0.16)) });
    parts.push({ name: `art_coxae__${k}`, tissue: 'cartilage', baseOpacity: 0.45, geometry: capsule(H.hi, v(0.16, 0.16, 0.15)) });
    parts.push({ name: `art_genus__${k}`, tissue: 'cartilage', baseOpacity: 0.45, geometry: capsule(H.st.clone().add(v(0.02, 0.0, 0)), v(0.19, 0.18, 0.16)) });
    parts.push({
      name: `lig_cruciatum_craniale__${k}`, tissue: 'ligament',
      geometry: solid([cone(H.st.clone().add(v(-0.05, 0.03, s * 0.025)), H.st.clone().add(v(0.05, -0.08, -s * 0.01)), 0.02, 0.018)], { voxel: 0.008, k: 0.004, fibers: true }),
    });
  }
  return hull;
}