/**
 * Tegumento: piel, tejido subcutáneo y fascia superficial.
 *
 * El contorno corporal es la unión suave de una silueta del tronco, cuello, cabeza y
 * cola con los propios músculos y huesos del modelo (que así se marcan bajo la piel:
 * escápula, olécranon, grupa, muslo, corvejón…). Las tres capas se extraen del mismo
 * campo a distintas distancias, por lo que son concéntricas y no se cruzan.
 */
import { basis, chain, cone, ellipsoid, ellipsoidB, Field, mergeGeoms, type Prim, solid, sphere } from '../sdf';
import { CAUD, fore, hind, lerp, type Part, SIDES, smooth, v } from './common';
import { digits, SKULL } from './skeleton';

/** Silueta del tronco: [x, línea dorsal, línea ventral, semiancho] (sin piel). */
const PROFILE: [number, number, number, number][] = [
  [2.75, 5.12, 3.7, 0.5],
  [2.2, 5.42, 3.18, 0.72],
  [1.6, 5.6, 2.9, 0.86],
  [0.8, 5.42, 2.84, 0.98],
  [0.0, 5.34, 2.9, 1.0],
  [-0.7, 5.3, 3.08, 0.97],
  [-1.4, 5.3, 3.38, 0.9],
  [-2.0, 5.24, 3.66, 0.86],
  [-2.6, 5.1, 3.94, 0.78],
  [-3.05, 4.94, 4.12, 0.56],
];

function profile(x: number) {
  if (x >= PROFILE[0][0]) return PROFILE[0];
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i], b = PROFILE[i + 1];
    if (x <= a[0] && x >= b[0]) {
      const t = smooth((a[0] - x) / (a[0] - b[0]));
      return [x, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)] as const;
    }
  }
  return PROFILE[PROFILE.length - 1];
}

/** Tronco de sección superelíptica (dorso algo plano, tórax profundo). */
const trunk: Prim = {
  d: (x, y, z) => {
    const [, top, bot, W] = profile(x);
    const yc = (top + bot) / 2, hh = (top - bot) / 2;
    const n = 2.4;
    const q = Math.pow(Math.pow(Math.abs(z) / W, n) + Math.pow(Math.abs(y - yc) / hh, n), 1 / n);
    const d = (q - 1) * Math.min(W, hh) * 0.85;
    return Math.max(d, x - 2.8, -3.1 - x);
  },
  min: v(-3.15, 2.75, -1.05), max: v(2.85, 5.7, 1.05),
};

function silhouette(): Prim[] {
  const p: Prim[] = [trunk];
  // Cuello (dorsal y ventral) y garganta
  p.push(...chain([v(2.45, 4.6, 0), v(3.05, 5.18, 0), v(3.55, 5.66, 0), v(3.85, 5.92, 0)], (t) => lerp(0.6, 0.4, t), { segs: 8, flat: { n: v(0, 0, 1), f: 0.82 } }));
  p.push(...chain([v(2.4, 3.72, 0), v(3.1, 4.5, 0), v(3.78, 5.38, 0)], (t) => lerp(0.42, 0.28, t), { segs: 6, flat: { n: v(0, 0, 1), f: 0.85 } }));
  // Cabeza: labios (belfos), trufa y mejillas
  p.push(...chain([v(4.45, 5.84, 0), v(5.1, 5.8, 0), v(5.62, 5.84, 0)], (t) => lerp(0.25, 0.14, t), { segs: 6, flat: { n: v(0, 1, 0), f: 0.72 } }));
  p.push(sphere(SKULL.nose.clone().add(v(0.02, 0.01, 0)), 0.11));
  for (const { s } of SIDES) {
    const F = fore(s);
    const H = hind(s);
    // Partes blandas de los miembros (tendones, fascias, almohadillado)
    p.push(...chain([F.el.clone().add(v(-0.05, 0.0, 0)), F.el.clone().lerp(F.ca, 0.5), F.ca.clone().add(v(-0.02, 0.05, 0))], (t) => lerp(0.17, 0.1, t), { segs: 6, flat: { n: v(0, 0, 1), f: 0.85 } }));
    p.push(...chain([F.ca, F.mc.clone().add(v(0.02, 0.05, 0))], () => 0.085, { segs: 3 }));
    p.push(ellipsoid(F.mc.clone().add(v(0.17, -0.15, 0)), v(0.2, 0.1, 0.16)));
    p.push(...chain([H.st.clone().add(v(-0.1, -0.05, 0)), H.st.clone().lerp(H.ta, 0.45).add(v(-0.1, 0, 0)), H.ta.clone().add(v(-0.1, 0.1, 0))], (t) => lerp(0.2, 0.085, t), { segs: 6, flat: { n: v(0, 0, 1), f: 0.8 } }));
    p.push(...chain([H.ta.clone().add(v(0.02, -0.1, 0)), H.mt.clone().add(v(0.02, 0.05, 0))], () => 0.082, { segs: 3 }));
    p.push(ellipsoid(H.mt.clone().add(v(0.17, -0.15, 0)), v(0.2, 0.1, 0.155)));
    // Pliegue de la babilla (une el muslo con el flanco)
    p.push(cone(v(-1.6, 3.55, s * 0.62), H.st.clone().add(v(0.05, 0.25, -s * 0.02)), 0.12, 0.1));
  }
  // Grupa, periné y cola
  p.push(ellipsoid(v(-2.92, 4.55, 0), v(0.3, 0.45, 0.6)));
  p.push(ellipsoid(v(-3.06, 4.02, 0), v(0.18, 0.36, 0.3)));
  const tail = [0, 0.15, 0.35, 0.55, 0.75, 1].map((t) => CAUD.getPointAt(t).add(v(0, 0.05, 0)));
  p.push(...chain(tail, (t) => lerp(0.2, 0.06, Math.pow(t, 0.8)), { segs: 14 }));
  return p;
}

export function buildIntegument(parts: Part[], skeletonHull: Prim[], muscleHull: Prim[]) {
  const all = [...silhouette(), ...skeletonHull, ...muscleHull];
  const f = Field.fit(all, 0.05, 0.075, 0.12);
  // Hendiduras palpebrales (dejan ver los ojos), narinas y ano
  for (const { s } of SIDES) {
    const o = SKULL.orbit(s);
    f.subtract(ellipsoidB(o.clone().add(v(0.11, 0.0, s * 0.08)), basis(v(1, 0, s * 0.6), v(0, 1, 0)), v(0.06, 0.045, 0.1)), 0.01);
    f.subtract(ellipsoid(SKULL.nose.clone().add(v(0.12, 0.02, s * 0.045)), v(0.03, 0.022, 0.02)), 0.008);
  }
  f.subtract(sphere(v(-3.32, 4.43, 0), 0.035), 0.01);

  f.paint(sphere(SKULL.nose.clone().add(v(0.07, 0.02, 0)), 0.12), 0.02); // trufa (plano nasal) sin pelo
  // Pabellones auriculares (orejas caídas): lámina fina modelada aparte para que no se
  // engrose al dilatar el contorno; base estrecha, tercio medio más ancho y punta redondeada.
  const ears: Prim[] = [];
  for (const { s } of SIDES) {
    ears.push(...chain([v(3.92, 6.7, s * 0.42), v(3.98, 6.56, s * 0.66), v(4.04, 6.26, s * 0.77), v(4.08, 6.0, s * 0.75)], (t) => 0.06 + 0.13 * Math.sin(Math.PI * Math.min(1, t * 0.8 + 0.15)), { segs: 12, flat: { n: v(0, 0.12, s), f: 0.13 } }));
    ears.push(ellipsoid(v(3.93, 6.68, s * 0.46), v(0.1, 0.08, 0.1))); // base (cartílago anular / inserción)
  }
  const earGeom = solid(ears, { voxel: 0.018, k: 0.05, smooth: 4 });
  parts.push({ name: 'cutis', tissue: 'fur', geometry: mergeGeoms([f.mesh({ iso: 0.06, smooth: 3 }), earGeom]) });
  f.paints.length = 0;
  parts.push({ name: 'tela_subcutanea', tissue: 'fat', geometry: f.mesh({ iso: 0.035, smooth: 3 }) });
  parts.push({ name: 'fascia_superficialis', tissue: 'fascia', baseOpacity: 0.25, geometry: f.mesh({ iso: 0.014, smooth: 3 }) });

  // Escroto y prepucio (piel del macho)
  const male: Prim[] = [];
  for (const { s } of SIDES) male.push(ellipsoid(v(-2.78, 2.96, s * 0.12), v(0.17, 0.2, 0.15), [0, 0, 0.5]));
  male.push(...chain([v(-2.4, 3.3, 0), v(-2.0, 3.1, 0), v(-1.42, 3.16, 0)], (t) => lerp(0.13, 0.085, t), { segs: 6 }));
  male.push(cone(v(-1.9, 3.42, 0), v(-1.9, 3.15, 0), 0.12, 0.12, { n: v(0, 0, 1), f: 0.6 }));
  parts.push({ name: 'cutis@male', tissue: 'fur', geometry: solid(male, { voxel: 0.02, k: 0.06, iso: 0.02, margin: 0.05 }) });

  // Almohadillas (digitales, metacarpiana/metatarsiana y carpiana) y uñas
  for (const { s, k } of SIDES) {
    const F = fore(s);
    const H = hind(s);
    const pads: Prim[] = [];
    const claws: Prim[] = [];
    const paw = (top: typeof F.ca, mcp: typeof F.mc) => {
      const ds = digits(top, mcp, s);
      for (const d of ds) {
        pads.push(ellipsoid(v(d.p2.x - 0.04, 0.045, d.p2.z), v(0.075, 0.05, 0.058)));
        claws.push(...chain([d.p2.clone().add(v(0.04, 0.0, 0)), d.p3.clone().add(v(0.02, 0.02, 0)), d.p3.clone().add(v(0.075, -0.04, 0))], (t) => lerp(0.032, 0.006, t), { segs: 5, flat: { n: v(0, 0, 1), f: 0.7 } }));
      }
      const zc = (ds[1].z + ds[2].z) / 2 + top.z;
      pads.push(ellipsoid(v(mcp.x + 0.02, 0.07, zc), v(0.1, 0.065, 0.13)), ...[1, -1].map((q) => ellipsoid(v(mcp.x + 0.06, 0.07, zc + q * 0.05), v(0.07, 0.06, 0.07))));
    };
    paw(F.ca, F.mc);
    paw(H.ta.clone().add(v(0.03, -0.16, 0)), H.mt);
    pads.push(ellipsoid(F.ca.clone().add(v(-0.15, -0.16, 0)), v(0.055, 0.05, 0.05))); // almohadilla carpiana
    parts.push({ name: `tori__${k}`, tissue: 'pad', geometry: solid(pads, { voxel: 0.012, k: 0.015, alt: claws, altBlend: 0.01 }) });
  }
}
