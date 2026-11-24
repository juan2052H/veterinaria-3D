/**
 * Puntos de referencia anatómicos compartidos por todos los módulos del modelo.
 *
 * Sistema de coordenadas: el perro mira hacia +X, +Y es dorsal, +Z es el lado derecho.
 * Unidades: 1 unidad ≈ 10 cm. Ejemplar de referencia: perro mesocéfalo de talla media
 * (≈ 25 kg, altura a la cruz ≈ 57 cm), en estación cuadrupedal.
 *
 * Las posiciones siguen la topografía descrita en Evans & de Lahunta (2020) y
 * Budras et al. (2013), pero son aproximaciones esquemáticas, no mediciones.
 */
import * as THREE from 'three';
import type { Tissue } from '../../../viewer/tissueMaterials';

export type V = THREE.Vector3;
export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const SIDES = [
  { s: 1, k: 'r' as const },
  { s: -1, k: 'l' as const },
];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => t * t * (3 - 2 * t);
/** Perfil de vientre fusiforme: 0 en los extremos, 1 en `peak`. */
export const belly = (t: number, peak = 0.5, p = 0.7) => {
  const u = t < peak ? (t / peak) * 0.5 : 0.5 + ((t - peak) / (1 - peak)) * 0.5;
  return Math.pow(Math.max(0, Math.sin(Math.PI * u)), p);
};

export interface Part {
  name: string;
  geometry: THREE.BufferGeometry;
  tissue: Tissue;
  /** Color secundario (tendones, cartílago articular, grasa coronaria…) donde la malla tenga atributo `alt`. */
  alt?: string;
  /** Opacidad propia (p. ej. fascias translúcidas). */
  baseOpacity?: number;
}

/* --------------------------- Miembros (por lado) --------------------------- */

export const fore = (s: number) => ({
  scTop: v(1.5, 5.2, s * 0.4), // borde dorsal de la escápula
  sh: v(2.28, 3.98, s * 0.64), // articulación del hombro
  el: v(1.72, 2.78, s * 0.62), // codo
  ca: v(1.86, 0.98, s * 0.6), // carpo
  mc: v(1.98, 0.3, s * 0.6), // articulaciones metacarpofalangianas
});

export const hind = (s: number) => ({
  hi: v(-2.45, 4.32, s * 0.48), // cadera (acetábulo)
  st: v(-1.86, 2.72, s * 0.52), // rodilla
  ta: v(-2.72, 1.3, s * 0.5), // tarso
  mt: v(-2.5, 0.3, s * 0.5), // articulaciones metatarsofalangianas
});

/* ------------------------------ Columna ------------------------------ */

const curve = (pts: V[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');
export const CERV = curve([v(3.62, 5.98, 0), v(3.1, 5.55, 0), v(2.35, 5.05, 0)]);
export const THOR = curve([v(2.35, 5.05, 0), v(0.9, 5.06, 0), v(-0.5, 4.95, 0)]);
export const LUMB = curve([v(-0.5, 4.95, 0), v(-1.35, 4.9, 0), v(-2.15, 4.78, 0)]);
export const SACR = curve([v(-2.15, 4.78, 0), v(-2.75, 4.72, 0)]);
export const CAUD = curve([v(-2.8, 4.72, 0), v(-3.45, 4.8, 0), v(-4.25, 4.66, 0), v(-5.05, 4.38, 0)]);

/** Radio del canal vertebral (la médula ocupa ~2/3). */
export const CANAL_R = 0.075;
/** Altura del canal sobre el eje de los cuerpos vertebrales. */
export const canalOffset = (bodyR: number) => bodyR + CANAL_R * 0.95;

/** Punto del eje de la columna a lo largo de toda su longitud (C1 → última caudal). */
export function spinePoint(region: 'C' | 'T' | 'L' | 'S' | 'Ca', t: number) {
  const c = { C: CERV, T: THOR, L: LUMB, S: SACR, Ca: CAUD }[region];
  return c.getPointAt(Math.min(1, Math.max(0, t)));
}

/** Marco local en un punto de una curva de la columna: t (craneal→caudal invertido), u (dorsal), w (derecha). */
export function frameAt(c: THREE.CatmullRomCurve3, t: number) {
  const p = c.getPointAt(t);
  const tan = c.getTangentAt(t).normalize(); // de craneal a caudal
  const w = v(0, 0, 1);
  const u = new THREE.Vector3().crossVectors(w, tan).normalize(); // dorsal
  if (u.y < 0) u.negate();
  return { p, t: tan, u, w };
}

/* --------------------------- Pared del tronco --------------------------- */
/**
 * Sección transversal aproximada de la pared torácica y abdominal (bajo la musculatura
 * superficial) en función de x: semiancho W, centro vertical yc y semialto hh.
 * Tórax profundo y comprimido lateralmente en su parte craneal, en "tonel" caudalmente,
 * y abdomen con el repliegue ventral (tuck-up) característico del perro.
 */
const TABLE: [number, number, number, number][] = [
  // x,     W,    yc,   hh
  [2.5, 0.48, 4.35, 0.7],
  [2.0, 0.62, 4.2, 0.95],
  [1.2, 0.8, 4.05, 1.07],
  [0.3, 0.9, 4.08, 1.08],
  [-0.5, 0.9, 4.18, 1.0],
  [-1.2, 0.84, 4.28, 0.86],
  [-2.0, 0.78, 4.38, 0.66],
  [-2.6, 0.64, 4.48, 0.5],
  [-3.0, 0.4, 4.55, 0.32],
];
export function wall(x: number) {
  if (x >= TABLE[0][0]) return { W: TABLE[0][1], yc: TABLE[0][2], hh: TABLE[0][3] };
  for (let i = 0; i < TABLE.length - 1; i++) {
    const [x0, W0, y0, h0] = TABLE[i];
    const [x1, W1, y1, h1] = TABLE[i + 1];
    if (x <= x0 && x >= x1) {
      const t = smooth((x0 - x) / (x0 - x1));
      return { W: lerp(W0, W1, t), yc: lerp(y0, y1, t), hh: lerp(h0, h1, t) };
    }
  }
  const L = TABLE[TABLE.length - 1];
  return { W: L[1], yc: L[2], hh: L[3] };
}
/** Semiancho de la pared a la altura y (sección elíptica algo aplanada dorsalmente). */
export function wallZ(x: number, y: number) {
  const { W, yc, hh } = wall(x);
  const q = Math.min(1, Math.abs((y - yc) / hh));
  return W * Math.pow(Math.max(0, 1 - Math.pow(q, 2.2)), 0.5);
}
/** Punto sobre la pared lateral (lado s) desplazado `off` hacia fuera. */
export const onWall = (x: number, y: number, s: number, off = 0) => v(x, y, s * (wallZ(x, y) + off));

/* ------------------------------ Diafragma ------------------------------ */
/** Cúpula diafragmática (elipsoide): centro y semiejes. La cúpula mira cranealmente. */
export const DOME = { c: v(-0.9, 4.0, 0), r: v(0.8, 1.12, 0.94) };
