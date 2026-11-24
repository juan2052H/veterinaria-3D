/**
 * Modelado orgánico por campos de distancia (SDF).
 *
 * Cada estructura se describe como una unión suave de primitivas (esferas, elipsoides,
 * conos redondeados aplanables) y, opcionalmente, sustracciones (forámenes, cisuras,
 * fosas). El campo se muestrea en una rejilla y se poligoniza con "surface nets", lo que
 * produce mallas indexadas continuas y suaves, sin las intersecciones visibles que
 * aparecen al superponer primitivas geométricas.
 *
 * La unión suave usa la suma exponencial  d = -k·ln(Σ e^(-dᵢ/k)),  que es conmutativa:
 * cada primitiva solo se evalúa dentro de su caja envolvente, por lo que el coste es
 * proporcional al volumen de cada primitiva y no al de la rejilla completa.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Vec = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface Prim {
  /** Distancia con signo (negativa dentro). */
  d(x: number, y: number, z: number): number;
  min: Vec;
  max: Vec;
  /** Eje principal (para orientar las fibras musculares). */
  axis?: Vec;
}

/* ================================ Primitivas ================================ */

export function sphere(c: Vec, r: number): Prim {
  return {
    d: (x, y, z) => Math.hypot(x - c.x, y - c.y, z - c.z) - r,
    min: v(c.x - r, c.y - r, c.z - r),
    max: v(c.x + r, c.y + r, c.z + r),
  };
}

/** Elipsoide con rotación opcional (Euler XYZ). Distancia aproximada (Íñigo Quílez). */
export function ellipsoid(c: Vec, r: Vec, rot?: [number, number, number]): Prim {
  const inv = new THREE.Matrix4();
  if (rot) inv.makeRotationFromEuler(new THREE.Euler(...rot)).invert();
  const e = inv.elements;
  const R = Math.max(r.x, r.y, r.z);
  let axis = r.x >= r.y && r.x >= r.z ? v(1, 0, 0) : r.y >= r.z ? v(0, 1, 0) : v(0, 0, 1);
  if (rot) axis = axis.applyEuler(new THREE.Euler(...rot));
  return {
    d: (x, y, z) => {
      const px = x - c.x, py = y - c.y, pz = z - c.z;
      const lx = e[0] * px + e[4] * py + e[8] * pz;
      const ly = e[1] * px + e[5] * py + e[9] * pz;
      const lz = e[2] * px + e[6] * py + e[10] * pz;
      const k0 = Math.hypot(lx / r.x, ly / r.y, lz / r.z);
      const k1 = Math.hypot(lx / (r.x * r.x), ly / (r.y * r.y), lz / (r.z * r.z));
      return k1 < 1e-9 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
    },
    min: v(c.x - R, c.y - R, c.z - R),
    max: v(c.x + R, c.y + R, c.z + R),
    axis,
  };
}

/**
 * Cono redondeado entre `a` (radio ra) y `b` (radio rb). Con `flat` se aplana en la
 * dirección `flat.n` (factor 0..1), útil para músculos planos, la escápula o el ilion.
 */
export function cone(a: Vec, b: Vec, ra: number, rb: number, flat?: { n: Vec; f: number }): Prim {
  const ba = b.clone().sub(a);
  const l2 = ba.lengthSq();
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / Math.max(l2, 1e-12);
  const n = flat ? flat.n.clone().normalize() : null;
  const f = flat ? Math.max(0.05, flat.f) : 1;
  const sc = n ? 1 / f - 1 : 0;
  const R = Math.max(ra, rb);
  const min = v(Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.min(a.z, b.z) - R);
  const max = v(Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, Math.max(a.z, b.z) + R);
  return {
    d: (x, y, z) => {
      let px = x - a.x, py = y - a.y, pz = z - a.z;
      if (n) {
        const t = (px * n.x + py * n.y + pz * n.z) * sc;
        px += n.x * t; py += n.y * t; pz += n.z * t;
      }
      // sdRoundCone (Íñigo Quílez), versión con extremos arbitrarios
      const yv = px * ba.x + py * ba.y + pz * ba.z;
      const zz = yv - l2;
      const qx = px * l2 - ba.x * yv, qy = py * l2 - ba.y * yv, qz = pz * l2 - ba.z * yv;
      const x2 = qx * qx + qy * qy + qz * qz;
      const y2 = yv * yv * l2;
      const z2 = zz * zz * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      let d: number;
      if (Math.sign(zz) * a2 * z2 > k) d = Math.sqrt(x2 + z2) * il2 - rb;
      else if (Math.sign(yv) * a2 * y2 < k) d = Math.sqrt(x2 + y2) * il2 - ra;
      else d = (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
      return d * (n ? f : 1);
    },
    min,
    max,
    axis: ba.clone().normalize(),
  };
}

/** Cadena de conos redondeados a lo largo de una curva, con radio r(t). */
export function chain(points: Vec[], radius: (t: number) => number, opts: { segs?: number; flat?: { n: Vec; f: number } | ((t: number) => { n: Vec; f: number } | undefined) } = {}): Prim[] {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const segs = opts.segs ?? Math.max(4, points.length * 4);
  const out: Prim[] = [];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const fl = typeof opts.flat === 'function' ? opts.flat((t0 + t1) / 2) : opts.flat;
    out.push(cone(curve.getPointAt(t0), curve.getPointAt(t1), radius(t0), radius(t1), fl));
  }
  return out;
}

/** Caja redondeada orientada (centro, semiejes, rotación Euler). */
export function roundBox(c: Vec, h: Vec, r: number, rot?: [number, number, number]): Prim {
  const inv = new THREE.Matrix4();
  if (rot) inv.makeRotationFromEuler(new THREE.Euler(...rot)).invert();
  const e = inv.elements;
  const R = h.length() + r;
  return {
    d: (x, y, z) => {
      const px = x - c.x, py = y - c.y, pz = z - c.z;
      const lx = Math.abs(e[0] * px + e[4] * py + e[8] * pz) - h.x;
      const ly = Math.abs(e[1] * px + e[5] * py + e[9] * pz) - h.y;
      const lz = Math.abs(e[2] * px + e[6] * py + e[10] * pz) - h.z;
      return Math.hypot(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, ly, lz), 0) - r;
    },
    min: v(c.x - R, c.y - R, c.z - R),
    max: v(c.x + R, c.y + R, c.z + R),
  };
}

/** Cilindro de bordes redondeados entre `a` y `b` (cuerpos vertebrales, discos, esternebras). */
export function cylinder(a: Vec, b: Vec, r: number, round = 0): Prim {
  const dir = b.clone().sub(a).normalize();
  const A = a.clone().addScaledVector(dir, round), B = b.clone().addScaledVector(dir, -round);
  const ba = B.clone().sub(A);
  const baba = ba.dot(ba);
  const rr = r - round;
  const R = r + round;
  return {
    d: (x, y, z) => {
      const pax = x - A.x, pay = y - A.y, paz = z - A.z;
      const paba = pax * ba.x + pay * ba.y + paz * ba.z;
      const qx = pax * baba - ba.x * paba, qy = pay * baba - ba.y * paba, qz = paz * baba - ba.z * paba;
      const X = Math.hypot(qx, qy, qz) - rr * baba;
      const Y = Math.abs(paba - baba * 0.5) - baba * 0.5;
      const x2 = X * X, y2 = Y * Y * baba;
      const d = Math.max(X, Y) < 0 ? -Math.min(x2, y2) : (X > 0 ? x2 : 0) + (Y > 0 ? y2 : 0);
      return (Math.sign(d) * Math.sqrt(Math.abs(d))) / baba - round;
    },
    min: v(Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.min(a.z, b.z) - R),
    max: v(Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, Math.max(a.z, b.z) + R),
    axis: dir,
  };
}

/** Base ortonormal a partir de un eje principal y una dirección de referencia. */
export function basis(main: Vec, ref: Vec): [Vec, Vec, Vec] {
  const ex = main.clone().normalize();
  const ez = ref.clone().sub(ex.clone().multiplyScalar(ref.dot(ex))).normalize();
  const ey = new THREE.Vector3().crossVectors(ez, ex).normalize();
  return [ex, ey, ez];
}

/** Elipsoide orientado según la base (ex, ey, ez) con semiejes r. */
export function ellipsoidB(c: Vec, [ex, ey, ez]: [Vec, Vec, Vec], r: Vec): Prim {
  const R = Math.max(r.x, r.y, r.z);
  return {
    d: (x, y, z) => {
      const px = x - c.x, py = y - c.y, pz = z - c.z;
      const lx = px * ex.x + py * ex.y + pz * ex.z;
      const ly = px * ey.x + py * ey.y + pz * ey.z;
      const lz = px * ez.x + py * ez.y + pz * ez.z;
      const k0 = Math.hypot(lx / r.x, ly / r.y, lz / r.z);
      const k1 = Math.hypot(lx / (r.x * r.x), ly / (r.y * r.y), lz / (r.z * r.z));
      return k1 < 1e-9 ? -Math.min(r.x, r.y, r.z) : (k0 * (k0 - 1)) / k1;
    },
    min: v(c.x - R, c.y - R, c.z - R),
    max: v(c.x + R, c.y + R, c.z + R),
    axis: r.x >= r.y && r.x >= r.z ? ex : r.y >= r.z ? ey : ez,
  };
}

/** Caja redondeada orientada según la base (ex, ey, ez) con semiejes h. */
export function boxB(c: Vec, [ex, ey, ez]: [Vec, Vec, Vec], h: Vec, r = 0): Prim {
  const R = h.length() + r;
  return {
    d: (x, y, z) => {
      const px = x - c.x, py = y - c.y, pz = z - c.z;
      const lx = Math.abs(px * ex.x + py * ex.y + pz * ex.z) - h.x;
      const ly = Math.abs(px * ey.x + py * ey.y + pz * ey.z) - h.y;
      const lz = Math.abs(px * ez.x + py * ez.y + pz * ez.z) - h.z;
      return Math.hypot(Math.max(lx, 0), Math.max(ly, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, ly, lz), 0) - r;
    },
    min: v(c.x - R, c.y - R, c.z - R),
    max: v(c.x + R, c.y + R, c.z + R),
    axis: h.x >= h.y && h.x >= h.z ? ex : h.y >= h.z ? ey : ez,
  };
}

/** Capa hueca de un sólido: |d| - espesor/2 (diafragma, paredes). */
export function shell(p: Prim, thickness: number): Prim {
  return { d: (x, y, z) => Math.abs(p.d(x, y, z)) - thickness / 2, min: p.min.clone().subScalar(thickness), max: p.max.clone().addScalar(thickness), axis: p.axis };
}

/** Semiespacio (para sustracciones): positivo en el lado hacia el que apunta `n`. */
export function halfSpace(p: Vec, n: Vec, min: Vec, max: Vec): Prim {
  const nn = n.clone().normalize();
  return { d: (x, y, z) => -((x - p.x) * nn.x + (y - p.y) * nn.y + (z - p.z) * nn.z), min, max };
}

/* ================================== Campo ================================== */

const BIG = 1e3;

export class Field {
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  readonly min: Vec;
  readonly h: number;
  private sum: Float32Array;
  private dist: Float32Array | null = null;
  readonly prims: Prim[] = [];
  private subs: { p: Prim; k: number }[] = [];
  private ints: { p: Prim; k: number }[] = [];
  /** Primitivas de un segundo tejido (tendón, cartílago…): se unen al sólido y marcan el atributo lt. */
  readonly altPrims = new Set<Prim>();
  /** Regiones que solo colorean (no añaden volumen). */
  readonly paints: { p: Prim; blend: number }[] = [];
  altBlend = 0.03;
  // Búferes reutilizables de axisAt (evitan reservar memoria por vértice)
  private _nd: number[] = [];
  private _na: Vec[] = [];
  private _acc = new THREE.Vector3();

  /** @param k radio de fusión entre primitivas (unidades del modelo) */
  constructor(min: Vec, max: Vec, readonly voxel: number, readonly k: number) {
    this.h = voxel;
    const pad = voxel * 2;
    this.min = min.clone().subScalar(pad);
    this.nx = Math.ceil((max.x - min.x + 2 * pad) / voxel) + 1;
    this.ny = Math.ceil((max.y - min.y + 2 * pad) / voxel) + 1;
    this.nz = Math.ceil((max.z - min.z + 2 * pad) / voxel) + 1;
    this.sum = new Float32Array(this.nx * this.ny * this.nz);
  }

  /** Crea un campo con la caja ajustada a las primitivas dadas. */
  static fit(prims: Prim[], voxel: number, k: number, margin = 0): Field {
    const min = v(Infinity, Infinity, Infinity), max = v(-Infinity, -Infinity, -Infinity);
    for (const p of prims) { min.min(p.min); max.max(p.max); }
    const f = new Field(min.subScalar(k * 2 + margin), max.addScalar(k * 2 + margin), voxel, k);
    for (const p of prims) f.add(p);
    return f;
  }

  addAlt(p: Prim | Prim[]) {
    for (const q of Array.isArray(p) ? p : [p]) { this.add(q); this.altPrims.add(q); }
    return this;
  }

  paint(p: Prim | Prim[], blend = 0.03) {
    for (const q of Array.isArray(p) ? p : [p]) this.paints.push({ p: q, blend });
    return this;
  }

  /** Valor del atributo `alt` (0 = tejido principal, 1 = secundario) en un punto. */
  altAt(x: number, y: number, z: number): number {
    let a = 0;
    if (this.altPrims.size) {
      let dm = Infinity, da = Infinity;
      for (const p of this.prims) {
        const isAlt = this.altPrims.has(p);
        const best = isAlt ? da : dm;
        if (boxDist(p, x, y, z) > best) continue;
        const d = p.d(x, y, z);
        if (isAlt) da = Math.min(da, d); else dm = Math.min(dm, d);
      }
      a = Math.min(1, Math.max(0, 0.5 + (dm - da) / (2 * this.altBlend)));
    }
    for (const { p, blend } of this.paints) {
      if (boxDist(p, x, y, z) > blend) continue;
      const d = p.d(x, y, z);
      a = Math.max(a, Math.min(1, Math.max(0, 1 - d / blend)));
    }
    return a;
  }

  add(p: Prim | Prim[]) {
    if (Array.isArray(p)) { p.forEach((q) => this.add(q)); return this; }
    this.prims.push(p);
    const m = this.k * 5; // e^-5: la contribución fuera de este margen es despreciable
    const [i0, j0, k0] = this.cell(p.min, -m);
    const [i1, j1, k1] = this.cell(p.max, m);
    const { nx, ny, h, k, sum } = this;
    const invk = 1 / k;
    const ox = this.min.x, oy = this.min.y, oz = this.min.z;
    for (let kk = k0; kk <= k1; kk++) {
      const z = oz + kk * h;
      for (let j = j0; j <= j1; j++) {
        const y = oy + j * h;
        let idx = (kk * ny + j) * nx + i0;
        for (let i = i0; i <= i1; i++, idx++) {
          const e = -p.d(ox + i * h, y, z) * invk;
          if (e > -6) sum[idx] += Math.exp(e < 80 ? e : 80);
        }
      }
    }
    return this;
  }

  /** Sustracción suave (k = radio del redondeo del borde). */
  subtract(p: Prim | Prim[], k = this.k * 0.5) {
    (Array.isArray(p) ? p : [p]).forEach((q) => this.subs.push({ p: q, k }));
    return this;
  }

  /** Intersección suave: recorta el campo con la primitiva. */
  intersect(p: Prim, k = this.k * 0.5) {
    this.ints.push({ p, k });
    return this;
  }

  private cell(p: Vec, margin: number): [number, number, number] {
    const c = (val: number, o: number, n: number) => Math.min(n - 1, Math.max(0, Math.round((val + margin - o) / this.h)));
    return [c(p.x, this.min.x, this.nx), c(p.y, this.min.y, this.ny), c(p.z, this.min.z, this.nz)];
  }

  /** Distancias finales (unión suave + sustracciones + intersecciones). */
  distances(): Float32Array {
    if (this.dist) return this.dist;
    const { sum, k } = this;
    const d = new Float32Array(sum.length);
    for (let i = 0; i < sum.length; i++) d[i] = sum[i] > 1e-30 ? -k * Math.log(sum[i]) : BIG;
    const { nx, ny, h } = this;
    // Más allá de esta distancia al exterior, ninguna operación puede crear superficie nueva
    const band = h * 4 + 0.6;
    const apply = (list: { p: Prim; k: number }[], sub: boolean) => {
      for (const { p, k: ks } of list) {
        const m = ks * 3;
        const [i0, j0, k0] = sub ? this.cell(p.min, -m) : [0, 0, 0];
        const [i1, j1, k1] = sub ? this.cell(p.max, m) : [this.nx - 1, this.ny - 1, this.nz - 1];
        const skip = h * 4 + ks;
        for (let kk = k0; kk <= k1; kk++) for (let j = j0; j <= j1; j++) {
          let idx = (kk * ny + j) * nx + i0;
          for (let i = i0; i <= i1; i++, idx++) {
            const a = d[idx];
            if (a > skip) continue; // ya es exterior: max(a, ·) no lo cambia cerca de la superficie
            const b = p.d(this.min.x + i * h, this.min.y + j * h, this.min.z + kk * h);
            const bb = sub ? -b : b;
            if (bb < a - ks) continue;
            const hh = Math.max(0, Math.min(1, 0.5 - (0.5 * (bb - a)) / ks));
            d[idx] = Math.min(band, bb + (a - bb) * hh + ks * hh * (1 - hh)); // smax(a, bb)
          }
        }
      }
    };
    apply(this.subs, true);
    apply(this.ints, false);
    this.dist = d;
    return d;
  }

  /** Eje de la primitiva más cercana a un punto (para las fibras musculares). */
  axisAt(x: number, y: number, z: number): Vec | null {
    // Media ponderada de los ejes de las primitivas cercanas: evita saltos de dirección
    // de las fibras en las uniones entre segmentos.
    const eps = Math.max(this.k, 0.015);
    const reach = eps * 3;
    let best = Infinity;
    let ref: Vec | null = null;
    const nd = this._nd, na = this._na;
    let n = 0;
    for (const p of this.prims) {
      if (!p.axis || boxDist(p, x, y, z) > best + reach) continue;
      const d = p.d(x, y, z);
      if (d >= best + reach) continue;
      nd[n] = d; na[n] = p.axis; n++;
      if (d < best) { best = d; ref = p.axis; }
    }
    if (!ref) return null;
    const acc = this._acc.set(0, 0, 0);
    for (let i = 0; i < n; i++) {
      if (nd[i] > best + reach) continue;
      const w = Math.exp(-(nd[i] - best) / eps);
      acc.addScaledVector(na[i], na[i].dot(ref) < 0 ? -w : w);
    }
    return acc.lengthSq() > 1e-12 ? acc.clone().normalize() : ref;
  }

  /**
   * Poligoniza la isosuperficie d = iso (iso > 0 → superficie desplazada hacia fuera,
   * p. ej. la piel sobre los músculos).
   */
  mesh(opts: { iso?: number; smooth?: number; fibers?: boolean } = {}): THREE.BufferGeometry {
    return surfaceNets(this, opts.iso ?? 0, opts.smooth ?? 2, !!opts.fibers);
  }
}

/** Distancia (cota inferior) de un punto a la caja envolvente de una primitiva. */
function boxDist(p: Prim, x: number, y: number, z: number) {
  const dx = Math.max(p.min.x - x, 0, x - p.max.x);
  const dy = Math.max(p.min.y - y, 0, y - p.max.y);
  const dz = Math.max(p.min.z - z, 0, z - p.max.z);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/* ============================== Surface nets ============================== */

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

function surfaceNets(f: Field, iso: number, smoothIters: number, fibers: boolean): THREE.BufferGeometry {
  const d = f.distances();
  const { nx, ny, nz, h } = f;
  const o = f.min;
  const sxy = nx * ny;
  const off = CORNERS.map(([a, b, c]) => a + b * nx + c * sxy);
  const cellIndex = new Int32Array(nx * ny * nz).fill(-1); // indexado como los puntos (celda = esquina mínima)
  const pos: number[] = [];
  const idx: number[] = [];
  const val = new Float64Array(8);
  // Si la esquina está más lejos, la celda no puede cortar la superficie. Margen amplio porque
  // algunas primitivas (tronco, pared) no son distancias exactas y su gradiente puede superar 1.
  const far = h * 6;

  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) {
    let base = k * sxy + j * nx;
    for (let i = 0; i < nx - 1; i++, base++) {
      const v0 = d[base] - iso;
      if (v0 > far || v0 < -far) continue;
      let mask = 0;
      for (let c = 0; c < 8; c++) {
        const q = d[base + off[c]] - iso;
        val[c] = q;
        if (q < 0) mask |= 1 << c;
      }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let e = 0; e < 12; e++) {
        const c0 = EDGES[e][0], c1 = EDGES[e][1];
        const a0 = val[c0], a1 = val[c1];
        if ((a0 < 0) === (a1 < 0)) continue;
        const t = a0 / (a0 - a1);
        const A = CORNERS[c0], B = CORNERS[c1];
        sx += A[0] + (B[0] - A[0]) * t;
        sy += A[1] + (B[1] - A[1]) * t;
        sz += A[2] + (B[2] - A[2]) * t;
        n++;
      }
      cellIndex[base] = pos.length / 3;
      pos.push(o.x + (i + sx / n) * h, o.y + (j + sy / n) * h, o.z + (k + sz / n) * h);
    }
  }

  // Un cuadrilátero por cada arista de la rejilla que cruza la superficie
  const quad = (a: number, b: number, c: number, e: number, flip: boolean) => {
    const A = cellIndex[a], B = cellIndex[b], C = cellIndex[c], D = cellIndex[e];
    if (A < 0 || B < 0 || C < 0 || D < 0) return;
    if (flip) idx.push(A, B, C, A, C, D);
    else idx.push(A, C, B, A, D, C);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) {
    let p = k * sxy + j * nx + 1;
    for (let i = 1; i < nx - 1; i++, p++) {
      const v0 = d[p] - iso;
      if (v0 > far || v0 < -far) continue;
      const inside = v0 < 0;
      if (inside !== d[p + 1] - iso < 0) quad(p - nx - sxy, p - sxy, p, p - nx, inside);
      if (inside !== d[p + nx] - iso < 0) quad(p - 1 - sxy, p - 1, p, p - sxy, inside);
      if (inside !== d[p + sxy] - iso < 0) quad(p - 1 - nx, p - nx, p, p - 1, inside);
    }
  }

  const P = new Float32Array(pos);
  if (smoothIters > 0) taubin(P, idx, smoothIters);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (fibers) {
    const F = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) {
      const ax = f.axisAt(P[i], P[i + 1], P[i + 2]);
      if (ax) { F[i] = ax.x; F[i + 1] = ax.y; F[i + 2] = ax.z; }
    }
    g.setAttribute('fiber', new THREE.BufferAttribute(F, 3));
  }
  if (f.altPrims.size || f.paints.length) {
    const A = new Float32Array(P.length / 3);
    for (let i = 0; i < A.length; i++) A[i] = f.altAt(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    g.setAttribute('alt', new THREE.BufferAttribute(A, 1));
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Suavizado de Taubin (λ/μ): elimina el escalonado de la rejilla sin encoger la malla. */
function taubin(P: Float32Array, idx: number[], iters: number) {
  const n = P.length / 3;
  const nb: number[][] = Array.from({ length: n }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    nb[a].push(b, c); nb[b].push(a, c); nb[c].push(a, b);
  }
  const tmp = new Float32Array(P.length);
  const step = (lambda: number) => {
    for (let i = 0; i < n; i++) {
      const list = nb[i];
      if (!list.length) { tmp[i * 3] = P[i * 3]; tmp[i * 3 + 1] = P[i * 3 + 1]; tmp[i * 3 + 2] = P[i * 3 + 2]; continue; }
      let x = 0, y = 0, z = 0;
      for (const q of list) { x += P[q * 3]; y += P[q * 3 + 1]; z += P[q * 3 + 2]; }
      const m = list.length;
      tmp[i * 3] = P[i * 3] + lambda * (x / m - P[i * 3]);
      tmp[i * 3 + 1] = P[i * 3 + 1] + lambda * (y / m - P[i * 3 + 1]);
      tmp[i * 3 + 2] = P[i * 3 + 2] + lambda * (z / m - P[i * 3 + 2]);
    }
    P.set(tmp);
  };
  for (let it = 0; it < iters; it++) { step(0.5); step(-0.53); }
}

/** Atajo: une primitivas, aplica sustracciones y devuelve la malla. */
export interface SolidOpts {
  voxel: number;
  k: number;
  subtract?: Prim[];
  subK?: number;
  intersect?: Prim[];
  intK?: number;
  /** Primitivas del tejido secundario (se unen al sólido). */
  alt?: Prim[];
  altBlend?: number;
  /** Regiones solo coloreadas con el tejido secundario. */
  paint?: Prim[];
  paintBlend?: number;
  fibers?: boolean;
  smooth?: number;
  iso?: number;
  margin?: number;
}

export function solid(prims: Prim[], opts: SolidOpts) {
  const f = Field.fit([...prims, ...(opts.alt ?? [])], opts.voxel, opts.k, opts.margin ?? Math.max(0, opts.iso ?? 0));
  if (opts.alt) opts.alt.forEach((p) => f.altPrims.add(p));
  if (opts.altBlend) f.altBlend = opts.altBlend;
  if (opts.paint) f.paint(opts.paint, opts.paintBlend);
  if (opts.subtract?.length) f.subtract(opts.subtract, opts.subK);
  opts.intersect?.forEach((p) => f.intersect(p, opts.intK));
  return f.mesh({ fibers: opts.fibers, smooth: opts.smooth, iso: opts.iso });
}

/** Une geometrías indexadas completando con ceros los atributos que falten en alguna. */
export function mergeGeoms(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const sizes: Record<string, number> = {};
  for (const g of gs) for (const [k, a] of Object.entries(g.attributes)) sizes[k] = a.itemSize;
  for (const g of gs) for (const [k, size] of Object.entries(sizes)) if (!g.attributes[k]) {
    g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * size), size));
  }
  const m = mergeGeometries(gs, false)!;
  m.computeBoundingBox();
  m.computeBoundingSphere();
  return m;
}