/**
 * Sistema muscular. Cada músculo se modela por separado con:
 *  - vientre muscular (cadena de conos con perfil fusiforme o abanico de fascículos),
 *  - dirección de las fibras (atributo `fiber`, usado por el material),
 *  - tendones / aponeurosis / intersecciones tendinosas (atributo `alt`, color blanquecino),
 *  - origen e inserción en los accidentes óseos del esqueleto del modelo.
 * Topografía según Evans & de Lahunta (2020, cap. 6) y Budras et al. (2013).
 */
import * as THREE from 'three';
import { basis, chain, cone, ellipsoidB, type Prim, shell, solid } from '../sdf';
import { belly, DOME, fore, hind, lerp, onWall, type Part, SIDES, v, type V, wallZ } from './common';
import type { Tissue } from '../../../viewer/tissueMaterials';
import { digits, ribPoints } from './skeleton';

const SHEETS = new Set(['m_latissimus_dorsi', 'm_obliquus_externus_abdominis', 'm_trapezius', 'm_serratus_ventralis', 'm_rectus_abdominis', 'mm_intercostales_externi', 'm_iliocostalis', 'm_longissimus', 'm_iliopsoas']);
const MUSCLE = { voxel: 0.026, k: 0.03, fibers: true, altBlend: 0.035, smooth: 3 };

interface M { main: Prim[]; alt: Prim[] }
const M = (): M => ({ main: [], alt: [] });

/** Vientre fusiforme a lo largo de una curva. */
function bellyAlong(pts: V[], r: number, opts: { peak?: number; p?: number; min?: number; flat?: { n: V; f: number }; segs?: number } = {}): Prim[] {
  return chain(pts, (t) => Math.max(opts.min ?? r * 0.18, r * belly(t, opts.peak ?? 0.5, opts.p ?? 0.7)), { segs: opts.segs ?? 10, flat: opts.flat });
}

/** Tendón (cilindro fino) a lo largo de una curva. */
function tendon(pts: V[], r: number): Prim[] {
  return chain(pts, (t) => r * (1 - 0.25 * t), { segs: Math.max(2, pts.length * 2) });
}

/**
 * Abanico de fascículos desde varios orígenes a una inserción común (músculos planos
 * triangulares: trapecio, dorsal ancho, deltoides, serrato). `via` permite curvar cada
 * fascículo sobre la pared corporal.
 */
function fan(origins0: V[], insertion: V, r: number, flat: { n: V; f: number }, via?: (o: V, i: number) => V[]): Prim[] {
  const out: Prim[] = [];
  // Densificar los orígenes para que los fascículos formen una lámina continua
  const origins: V[] = [];
  origins0.forEach((o, i) => {
    origins.push(o);
    const nxt = origins0[i + 1];
    if (!nxt) return;
    const n = Math.floor(o.distanceTo(nxt) / (r * 1.6));
    for (let j = 1; j <= n; j++) origins.push(o.clone().lerp(nxt, j / (n + 1)));
  });
  origins.forEach((o, i) => {
    const pts = [o, ...(via ? via(o, i) : []), insertion];
    out.push(...chain(pts, (t) => r * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (1 - 0.45 * t), { segs: 6 + pts.length * 2, flat }));
  });
  return out;
}

/** Puntos intermedios proyectados sobre la pared del tronco (para músculos del tronco). */
const wallPath = (a: V, b: V, s: number, off: number, n = 3): V[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / (n + 1);
    const x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t);
    return onWall(x, y, s, off);
  });

function scapulaFrame(s: number) {
  const F = fore(s);
  const axis = F.scTop.clone().sub(F.sh).normalize();
  const B = basis(axis, v(0, 0, s));
  const ey = B[1].x > 0 ? B[1] : B[1].clone().negate();
  return { F, axis, ey, n: B[2], at: (t: number, c = 0, o = 0) => F.sh.clone().addScaledVector(axis, t).addScaledVector(ey, c).addScaledVector(B[2], o) };
}

/** Construye los músculos y devuelve sus primitivas (la piel se ajusta a sus relieves). */
export function buildMuscles(parts: Part[]): Prim[] {
  const hull: Prim[] = [];
  for (const { s, k } of SIDES) {
    const F = fore(s);
    const H = hind(s);
    const sc = scapulaFrame(s);
    const lat = v(0, 0, s);
    const add = (name: string, m: M, tissue: Tissue = 'muscle', extra: Partial<Parameters<typeof solid>[1]> = {}) => {
      // Los músculos laminares del tronco no condicionan la piel (sus fascículos marcarían surcos)
      if (!SHEETS.has(name)) hull.push(...m.main, ...m.alt);
      parts.push({ name: `${name}__${k}`, tissue, geometry: solid(m.main, { ...MUSCLE, alt: m.alt.length ? m.alt : undefined, ...extra }) });
    };

    /* ------------------------------ Cabeza ------------------------------ */
    let m = M();
    m.main = bellyAlong([v(3.86, 6.64, s * 0.18), v(4.12, 6.6, s * 0.32), v(4.3, 6.4, s * 0.4)], 0.2, { flat: { n: v(0, 0.5, s), f: 0.5 } });
    m.alt = tendon([v(4.28, 6.36, s * 0.38), v(4.1, 6.26, s * 0.37)], 0.04);
    add('m_temporalis', m, 'muscleDark');

    m = M();
    m.main = bellyAlong([v(4.58, 6.0, s * 0.42), v(4.28, 5.86, s * 0.43), v(3.94, 5.74, s * 0.39)], 0.17, { peak: 0.55, flat: { n: lat, f: 0.42 } });
    m.alt = tendon([v(4.62, 6.04, s * 0.43), v(4.42, 5.96, s * 0.44)], 0.03);
    add('m_masseter', m);

    /* ------------------------------- Cuello ------------------------------- */
    m = M();
    m.main = bellyAlong([v(3.76, 6.08, s * 0.28), v(3.25, 5.5, s * 0.52), v(2.68, 4.62, s * 0.68), F.sh.clone().add(v(0.18, -0.22, s * 0.08)), F.el.clone().add(v(0.17, 0.48, s * 0.03))], 0.21, { peak: 0.45, p: 0.5, flat: { n: v(0.3, 0.5, s), f: 0.5 }, segs: 14 });
    m.alt = tendon([F.el.clone().add(v(0.17, 0.48, s * 0.03)), F.el.clone().add(v(0.13, 0.3, s * 0.02))], 0.025);
    add('m_brachiocephalicus', m);

    m = M();
    m.main = bellyAlong([v(2.4, 3.46, s * 0.08), v(2.86, 4.15, s * 0.24), v(3.36, 5.1, s * 0.33), v(3.72, 5.86, s * 0.3)], 0.1, { peak: 0.5, p: 0.4, flat: { n: v(0.6, -0.4, s * 0.7), f: 0.55 } });
    m.alt = tendon([v(3.72, 5.86, s * 0.3), v(3.8, 6.02, s * 0.26)], 0.025);
    add('m_sternocephalicus', m, 'muscleDark');

    /* ----------------------------- Cintura escapular ----------------------------- */
    // Trapecio: porción cervical y torácica, ambas a la espina de la escápula
    m = M();
    const spineMid = sc.at(0.85, 0, 0.07);
    m.main = [
      ...fan([v(3.0, 5.85, s * 0.06), v(2.75, 5.72, s * 0.07), v(2.5, 5.62, s * 0.07)], spineMid, 0.07, { n: v(0, 0.6, s), f: 0.3 }),
      ...fan([v(1.95, 5.6, s * 0.06), v(1.55, 5.58, s * 0.06), v(1.15, 5.52, s * 0.06), v(0.8, 5.48, s * 0.06)], sc.at(0.95, -0.02, 0.07), 0.07, { n: v(0, 0.6, s), f: 0.3 }),
    ];
    add('m_trapezius', m, 'muscleDark');

    // Supraespinoso e infraespinoso (profundos, en las fosas de la escápula)
    m = M();
    m.main = bellyAlong([sc.at(1.12, 0.16, 0.03), sc.at(0.7, 0.2, 0.05), sc.at(0.25, 0.16, 0.06)], 0.17, { peak: 0.4, flat: { n: sc.n, f: 0.55 } });
    m.alt = tendon([sc.at(0.25, 0.16, 0.06), F.sh.clone().add(v(0.15, 0.02, s * 0.06))], 0.035);
    add('m_supraspinatus', m);

    m = M();
    m.main = bellyAlong([sc.at(1.12, -0.18, 0.03), sc.at(0.7, -0.18, 0.05), sc.at(0.3, -0.08, 0.07)], 0.16, { peak: 0.45, flat: { n: sc.n, f: 0.5 } });
    m.alt = tendon([sc.at(0.3, -0.08, 0.07), F.sh.clone().add(v(0.02, -0.02, s * 0.13))], 0.03);
    add('m_infraspinatus', m, 'muscleDark');

    // Deltoides: porción escapular (desde la espina) y acromial (desde el acromion)
    m = M();
    const delt = F.sh.clone().lerp(F.el, 0.3).add(v(0.04, 0, s * 0.1));
    m.main = fan([sc.at(1.05, 0, 0.1), sc.at(0.85, -0.02, 0.11), sc.at(0.62, -0.03, 0.12), sc.at(0.4, -0.02, 0.13), sc.at(0.18, 0.0, 0.14)], delt, 0.08, { n: sc.n, f: 0.38 }, (o) => [o.clone().lerp(delt, 0.5).addScaledVector(sc.n, 0.06)]);
    add('m_deltoideus', m);

    // Serrato ventral (profundo): de las costillas y vértebras cervicales a la cara medial de la escápula
    m = M();
    const serr = sc.at(0.95, 0, -0.08);
    const ribOrigins = [1.9, 1.6, 1.3, 1.0, 0.7, 0.45].map((x, i) => onWall(x, 3.55 + i * 0.04, s, 0.03));
    m.main = [
      ...fan(ribOrigins, serr, 0.07, { n: lat, f: 0.3 }, (o) => wallPath(o, serr, s, 0.04, 2)),
      ...fan([v(3.2, 5.45, s * 0.2), v(2.95, 5.28, s * 0.22), v(2.7, 5.15, s * 0.25)], serr, 0.07, { n: v(0, 0.3, s), f: 0.35 }),
    ];
    add('m_serratus_ventralis', m, 'muscleDark');

    // Dorsal ancho: de la fascia toracolumbar al húmero (tuberosidad redonda mayor)
    m = M();
    const teres = F.sh.clone().add(v(-0.06, -0.38, -s * 0.02));
    const latO = [0.75, 0.4, 0.05, -0.3, -0.65, -1.0].map((x) => v(x, 5.32 - Math.max(0, -x) * 0.05, s * 0.14));
    m.main = fan(latO, teres, 0.08, { n: lat, f: 0.25 }, (o) => wallPath(o, teres, s, 0.1, 3));
    m.alt = latO.map((o) => cone(o, onWall(o.x - 0.05, o.y - 0.32, s, 0.09), 0.05, 0.05, { n: lat, f: 0.3 })); // fascia toracolumbar
    add('m_latissimus_dorsi', m);

    // Pectorales superficial y profundo
    m = M();
    const crest = F.sh.clone().add(v(0.12, -0.42, s * 0.02));
    m.main = [
      ...fan([v(2.32, 3.36, s * 0.05), v(2.12, 3.24, s * 0.05), v(1.92, 3.14, s * 0.05)], crest, 0.09, { n: v(0, -0.5, s), f: 0.45 }),
      ...fan([v(1.6, 3.02, s * 0.05), v(1.1, 2.96, s * 0.05), v(0.6, 2.95, s * 0.05), v(0.15, 2.98, s * 0.06)], F.sh.clone().add(v(0.08, -0.12, -s * 0.06)), 0.1, { n: v(0, -1, s * 0.4), f: 0.4 }, (o) => [onWall(lerp(o.x, F.sh.x, 0.45), 3.08, s, 0.02)]),
    ];
    add('mm_pectorales', m, 'muscleDark');

    /* ------------------------------- Brazo ------------------------------- */
    m = M();
    const tuber = F.el.clone().add(v(-0.22, 0.28, 0));
    m.main = [
      ...bellyAlong([sc.at(0.5, -0.27, 0.0), F.sh.clone().lerp(F.el, 0.45).add(v(-0.33, 0.05, s * 0.03)), tuber.clone().add(v(0.02, 0.1, 0))], 0.24, { peak: 0.45, flat: { n: lat, f: 0.62 } }), // cabeza larga
      ...bellyAlong([F.sh.clone().add(v(-0.06, -0.22, s * 0.1)), F.el.clone().add(v(-0.16, 0.3, s * 0.12))], 0.13, { flat: { n: lat, f: 0.6 } }), // cabeza lateral
    ];
    m.alt = tendon([tuber.clone().add(v(0.02, 0.1, 0)), tuber], 0.05);
    add('m_triceps_brachii', m);

    m = M();
    m.main = bellyAlong([F.sh.clone().add(v(0.17, -0.18, -s * 0.01)), F.sh.clone().lerp(F.el, 0.5).add(v(0.17, 0, -s * 0.03)), F.el.clone().add(v(0.15, 0.2, -s * 0.03))], 0.075);
    m.alt = [...tendon([F.sh.clone().add(v(0.12, 0.06, 0)), F.sh.clone().add(v(0.17, -0.18, -s * 0.01))], 0.022), ...tendon([F.el.clone().add(v(0.15, 0.2, -s * 0.03)), F.el.clone().add(v(0.05, -0.1, -s * 0.05))], 0.02)];
    add('m_biceps_brachii', m, 'muscleDark');

    /* ------------------------------ Antebrazo ------------------------------ */
    m = M();
    m.main = bellyAlong([F.el.clone().add(v(0.0, 0.16, s * 0.09)), F.el.clone().add(v(0.12, -0.16, s * 0.04)), F.el.clone().add(v(0.11, -0.78, s * 0.0))], 0.075, { peak: 0.35 });
    m.alt = tendon([F.el.clone().add(v(0.1, -0.78, 0)), F.ca.clone().add(v(0.085, 0.06, -s * 0.01)), F.ca.clone().add(v(0.07, -0.16, -s * 0.02))], 0.017);
    add('m_extensor_carpi_radialis', m);

    m = M();
    m.main = bellyAlong([F.el.clone().add(v(-0.14, 0.02, -s * 0.05)), F.el.clone().add(v(-0.15, -0.45, s * 0.0)), F.ca.clone().add(v(-0.12, 0.28, s * 0.03))], 0.065, { peak: 0.4 });
    m.alt = tendon([F.ca.clone().add(v(-0.12, 0.28, s * 0.03)), F.ca.clone().add(v(-0.16, 0.0, s * 0.07))], 0.022);
    add('m_flexor_carpi_ulnaris', m, 'muscleDark');

    /* -------------------------------- Tronco -------------------------------- */
    // Oblicuo externo del abdomen: fibras caudoventrales; la aponeurosis llega a la línea alba
    m = M();
    for (let i = 0; i < 13; i++) {
      const x0 = 0.95 - i * 0.21;
      const top = onWall(x0, 4.55 - Math.max(0, x0 + 0.85) * 0, s, 0.06);
      const bot = onWall(x0 - 0.55, 3.55 + Math.max(0, -x0) * 0.12, s, 0.06);
      const pts = [top, ...wallPath(top, bot, s, 0.06, 2), bot];
      m.main.push(...chain(pts, () => 0.09, { segs: 6, flat: { n: lat, f: 0.28 } }));
      const ap = onWall(x0 - 0.8, 3.12 + Math.max(0, -x0 + 0.5) * 0.2, s, 0.04);
      const mid = wallPath(bot, ap, s, 0.05, 1);
      m.alt.push(...chain([bot, ...mid, v(ap.x, ap.y, s * 0.06)], () => 0.05, { segs: 4, flat: { n: v(0, -1, s * 0.4), f: 0.3 } }));
    }
    add('m_obliquus_externus_abdominis', m, 'muscle', { altBlend: 0.06 });

    // Recto del abdomen con intersecciones tendinosas
    m = M();
    const rect = [v(1.7, 3.06, s * 0.16), v(0.9, 2.98, s * 0.17), v(0.0, 3.04, s * 0.17), v(-0.9, 3.3, s * 0.16), v(-1.75, 3.62, s * 0.13), v(-2.45, 3.88, s * 0.06)];
    m.main = chain(rect, (t) => 0.1 * (1 - 0.45 * t), { segs: 16, flat: { n: v(0, -1, 0), f: 0.32 } });
    const rc = new THREE.CatmullRomCurve3(rect);
    m.alt = [0.12, 0.27, 0.42, 0.57].map((t) => { const p = rc.getPointAt(t); const tg = rc.getTangentAt(t); return cone(p.clone().addScaledVector(tg, -0.012), p.clone().addScaledVector(tg, 0.012), 0.1, 0.1, { n: v(0, -1, 0), f: 0.36 }); });
    add('m_rectus_abdominis', m, 'muscleDark');

    /* ------------------------------ Grupa y muslo ------------------------------ */
    m = M();
    m.main = bellyAlong([v(-1.72, 5.02, s * 0.36), v(-2.02, 4.94, s * 0.46), v(-2.32, 4.66, s * 0.56)], 0.19, { peak: 0.4, flat: { n: v(0, 0.4, s), f: 0.55 } });
    m.alt = tendon([v(-2.32, 4.66, s * 0.56), H.hi.clone().add(v(-0.07, 0.03, s * 0.2))], 0.04);
    add('m_gluteus_medius', m);

    m = M();
    m.main = bellyAlong([v(-2.35, 4.98, s * 0.2), v(-2.52, 4.74, s * 0.48), v(-2.5, 4.3, s * 0.62)], 0.12, { flat: { n: v(0, 0.2, s), f: 0.45 } });
    m.alt = tendon([v(-2.5, 4.3, s * 0.62), H.hi.clone().add(v(-0.04, -0.22, s * 0.2))], 0.03);
    add('m_gluteus_superficialis', m, 'muscleDark');

    m = M();
    m.main = bellyAlong([v(-3.1, 4.32, s * 0.48), v(-2.9, 3.72, s * 0.66), v(-2.4, 3.05, s * 0.67), H.st.clone().add(v(-0.1, -0.22, s * 0.15))], 0.27, { peak: 0.4, p: 0.55, flat: { n: lat, f: 0.42 }, segs: 14 });
    m.alt = [...tendon([H.st.clone().add(v(-0.1, -0.22, s * 0.15)), H.st.clone().add(v(0.06, -0.2, s * 0.08))], 0.03), ...tendon([v(-2.6, 2.7, s * 0.55), H.ta.clone().add(v(-0.27, 0.12, s * 0.04))], 0.02)];
    add('m_biceps_femoris', m);

    m = M();
    m.main = bellyAlong([v(-3.2, 4.16, s * 0.38), v(-3.14, 3.5, s * 0.42), v(-2.7, 2.86, s * 0.36), H.st.clone().add(v(-0.24, -0.38, -s * 0.06))], 0.13, { peak: 0.4 });
    m.alt = tendon([H.st.clone().add(v(-0.24, -0.38, -s * 0.06)), H.st.clone().add(v(0.02, -0.32, -s * 0.07))], 0.02);
    add('m_semitendinosus', m, 'muscleDark');

    m = M();
    m.main = bellyAlong([v(-3.1, 4.08, s * 0.28), v(-2.92, 3.5, s * 0.24), v(-2.4, 2.98, s * 0.3), H.st.clone().add(v(-0.1, 0.02, -s * 0.07))], 0.16, { peak: 0.45 });
    add('m_semimembranosus', m);

    m = M();
    m.main = bellyAlong([v(-1.72, 4.85, s * 0.42), v(-1.68, 4.15, s * 0.46), v(-1.68, 3.38, s * 0.38), H.st.clone().add(v(0.08, 0.12, -s * 0.03))], 0.09, { p: 0.35, flat: { n: v(1, 0, s * 0.4), f: 0.4 } });
    m.alt = tendon([H.st.clone().add(v(0.08, 0.12, -s * 0.03)), H.st.clone().add(v(0.06, -0.12, -s * 0.07))], 0.02);
    add('m_sartorius', m, 'muscleDark');

    m = M();
    m.main = bellyAlong([H.hi.clone().add(v(0.16, -0.02, s * 0.08)), H.hi.clone().lerp(H.st, 0.5).add(v(0.2, 0, s * 0.05)), H.st.clone().add(v(0.17, 0.28, 0))], 0.21, { peak: 0.55 });
    m.alt = [...tendon([H.st.clone().add(v(0.17, 0.28, 0)), H.st.clone().add(v(0.15, 0.13, 0))], 0.04), ...tendon([H.st.clone().add(v(0.15, 0.09, 0)), H.st.clone().add(v(0.1, -0.13, 0))], 0.025)]; // tendón y ligamento rotuliano
    add('m_quadriceps_femoris', m);

    /* -------------------------------- Pierna -------------------------------- */
    m = M();
    const achilles = H.ta.clone().add(v(-0.22, 0.45, 0));
    m.main = [
      ...bellyAlong([H.st.clone().add(v(-0.13, 0.1, s * 0.06)), H.st.clone().add(v(-0.24, -0.3, s * 0.03)), achilles], 0.11, { peak: 0.35 }),
      ...bellyAlong([H.st.clone().add(v(-0.13, 0.1, -s * 0.06)), H.st.clone().add(v(-0.24, -0.3, -s * 0.03)), achilles], 0.1, { peak: 0.35 }),
    ];
    m.alt = tendon([achilles, H.ta.clone().add(v(-0.3, 0.07, s * 0.02))], 0.032);
    add('m_gastrocnemius', m);

    m = M();
    m.main = bellyAlong([H.st.clone().add(v(0.08, -0.16, s * 0.06)), H.st.clone().add(v(0.07, -0.5, s * 0.05)), H.st.clone().add(v(0.03, -0.85, s * 0.02))], 0.07, { peak: 0.35 });
    m.alt = tendon([H.st.clone().add(v(0.03, -0.85, s * 0.02)), H.ta.clone().add(v(0.09, 0.04, -s * 0.03)), H.ta.clone().add(v(0.07, -0.24, -s * 0.06))], 0.016);
    add('m_tibialis_cranialis', m, 'muscleDark');

    /* ------------------- Ampliación (v2.2): músculos que faltaban ------------------- */
    // Epaxiales: longísimo (medial, a lo largo de las apófisis transversas) e iliocostal (lateral, sobre los ángulos costales)
    m = M();
    m.main = chain([v(-1.95, 5.0, s * 0.2), v(-1.3, 5.12, s * 0.21), v(-0.5, 5.17, s * 0.21), v(0.6, 5.26, s * 0.2), v(1.6, 5.3, s * 0.19), v(2.3, 5.32, s * 0.17), v(2.95, 5.62, s * 0.15)],
      (t) => 0.06 + 0.1 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.2 + t * 1.1)), 0.6) * (1 - 0.5 * t), { segs: 24, flat: { n: lat, f: 0.72 } });
    m.alt = chain([v(-1.95, 5.08, s * 0.16), v(-0.8, 5.28, s * 0.16)], () => 0.05, { segs: 4, flat: { n: v(0, 1, 0), f: 0.3 } }); // fascia toracolumbar (aponeurosis)
    add('m_longissimus', m, 'muscleDark', { altBlend: 0.05 });

    m = M();
    m.main = chain([v(-1.85, 4.9, s * 0.36), v(-1.0, 5.0, s * 0.43), v(0.0, 5.0, s * 0.5), v(1.0, 5.0, s * 0.48), v(1.9, 5.0, s * 0.42)], (t) => 0.075 - 0.03 * t, { segs: 18, flat: { n: v(0, 0.5, s), f: 0.45 } });
    add('m_iliocostalis', m);

    m = M();
    m.main = bellyAlong([v(1.95, 5.55, s * 0.12), v(2.55, 5.62, s * 0.2), v(3.15, 5.82, s * 0.22), v(3.72, 6.22, s * 0.22)], 0.12, { peak: 0.45, flat: { n: lat, f: 0.5 } });
    add('m_splenius', m);

    // Intercostales externos: lámina entre costillas consecutivas (fibras caudoventrales)
    m = M();
    for (let i = 0; i < 12; i++) {
      const a = ribPoints(i, s), b = ribPoints(i + 1, s);
      const n = Math.min(a.length, b.length);
      const mid = Array.from({ length: n - 2 }, (_, j) => a[j + 2].clone().lerp(b[j + 2], 0.5));
      const gap = a[3].distanceTo(b[3]);
      m.main.push(...chain(mid, () => Math.max(0.03, gap * 0.48), { segs: 8, flat: { n: v(0, 0.15, s), f: 0.22 } }));
    }
    add('mm_intercostales_externi', m, 'muscleDark', { k: 0.02, voxel: 0.03 });

    // Antebrazo: extensores digital común y ulnar del carpo, flexor digital superficial
    const manusDigits = digits(F.ca, F.mc, s);
    m = M();
    m.main = bellyAlong([F.el.clone().add(v(-0.01, 0.05, s * 0.12)), F.el.clone().add(v(0.06, -0.35, s * 0.1)), F.el.clone().add(v(0.06, -0.8, s * 0.06))], 0.07, { peak: 0.35 });
    m.alt = [...tendon([F.el.clone().add(v(0.06, -0.8, s * 0.06)), F.ca.clone().add(v(0.07, 0.04, s * 0.03))], 0.018),
      ...manusDigits.flatMap((d) => tendon([F.ca.clone().add(v(0.07, 0.04, s * 0.03)), d.head.clone().add(v(0.03, 0.04, 0)), d.p2.clone().add(v(0.0, 0.03, 0))], 0.009))];
    add('m_extensor_digitorum_communis', m, 'muscle', { voxel: 0.016, k: 0.015 });

    m = M();
    m.main = bellyAlong([F.el.clone().add(v(-0.06, 0.02, s * 0.14)), F.el.clone().add(v(-0.08, -0.4, s * 0.12)), F.ca.clone().add(v(-0.05, 0.28, s * 0.09))], 0.06, { peak: 0.4 });
    m.alt = tendon([F.ca.clone().add(v(-0.05, 0.28, s * 0.09)), F.ca.clone().add(v(-0.03, -0.14, s * 0.11))], 0.016);
    add('m_extensor_carpi_ulnaris', m, 'muscleDark', { voxel: 0.018, k: 0.015 });

    m = M();
    m.main = bellyAlong([F.el.clone().add(v(-0.07, 0.0, -s * 0.11)), F.el.clone().add(v(-0.18, -0.45, -s * 0.03)), F.ca.clone().add(v(-0.17, 0.3, -s * 0.0))], 0.065, { peak: 0.4 });
    m.alt = [...tendon([F.ca.clone().add(v(-0.17, 0.3, 0)), F.ca.clone().add(v(-0.13, -0.12, 0))], 0.02),
      ...manusDigits.flatMap((d) => tendon([F.ca.clone().add(v(-0.13, -0.12, 0)), d.head.clone().add(v(-0.06, -0.05, 0)), d.p1.clone().add(v(0.0, -0.04, 0))], 0.009))];
    add('m_flexor_digitorum_superficialis', m, 'muscle', { voxel: 0.016, k: 0.015 });

    // Muslo: tensor de la fascia lata (con la fascia lata como aponeurosis) e iliopsoas (sublumbar, profundo)
    m = M();
    m.main = bellyAlong([v(-1.72, 4.62, s * 0.5), v(-1.76, 4.35, s * 0.6), v(-1.82, 4.05, s * 0.66)], 0.1, { flat: { n: lat, f: 0.45 } });
    m.alt = chain([v(-1.82, 4.05, s * 0.66), H.hi.clone().lerp(H.st, 0.55).add(v(0.12, 0, s * 0.2)), H.st.clone().add(v(0.06, 0.35, s * 0.16))], () => 0.08, { segs: 6, flat: { n: lat, f: 0.25 } });
    add('m_tensor_fasciae_latae', m, 'muscleDark', { altBlend: 0.05 });

    m = M();
    m.main = bellyAlong([v(-0.75, 4.8, s * 0.2), v(-1.55, 4.66, s * 0.22), v(-2.15, 4.38, s * 0.3), H.hi.clone().add(v(-0.06, -0.2, s * 0.06))], 0.11, { peak: 0.45, p: 0.5 });
    add('m_iliopsoas', m);

    // Pierna: extensor digital largo y fibular largo
    const pedisDigits = digits(H.ta.clone().add(v(0.03, -0.16, 0)), H.mt, s);
    m = M();
    m.main = bellyAlong([H.st.clone().add(v(0.03, 0.0, s * 0.08)), H.st.clone().add(v(0.02, -0.45, s * 0.1)), H.st.clone().add(v(-0.02, -0.85, s * 0.07))], 0.055, { peak: 0.35 });
    m.alt = [...tendon([H.st.clone().add(v(-0.02, -0.85, s * 0.07)), H.ta.clone().add(v(0.07, 0.0, s * 0.02)), H.ta.clone().add(v(0.07, -0.3, 0))], 0.016),
      ...pedisDigits.flatMap((d) => tendon([H.ta.clone().add(v(0.07, -0.3, 0)), d.head.clone().add(v(0.03, 0.04, 0)), d.p2.clone().add(v(0.0, 0.03, 0))], 0.009))];
    add('m_extensor_digitorum_longus', m, 'muscle', { voxel: 0.016, k: 0.015 });

    m = M();
    m.main = bellyAlong([H.st.clone().add(v(-0.04, -0.14, s * 0.14)), H.st.clone().add(v(-0.06, -0.45, s * 0.12)), H.st.clone().add(v(-0.06, -0.7, s * 0.11))], 0.05, { peak: 0.35 });
    m.alt = tendon([H.st.clone().add(v(-0.06, -0.7, s * 0.11)), H.ta.clone().add(v(-0.02, 0.04, s * 0.12)), H.ta.clone().add(v(0.01, -0.2, s * 0.06)), H.ta.clone().add(v(0.02, -0.25, -s * 0.06))], 0.013);
    add('m_fibularis_longus', m, 'muscleDark', { voxel: 0.016, k: 0.015 });
  }

  // Diafragma: lámina en cúpula con centro tendinoso, pilares y los tres hiatos
  const dome = ellipsoidB(DOME.c, [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)], DOME.r);
  const sheet = shell(dome, 0.05);
  const capBox: Prim = { d: (x) => (DOME.c.x + 0.02) - x, min: v(DOME.c.x - 0.1, 2.7, -1.1), max: v(DOME.c.x + 1.0, 5.3, 1.1) };
  // Limitado por la pared del tronco y por los cuerpos vertebrales (inserciones periféricas)
  const inWall: Prim = { d: (x, y, z) => Math.max(Math.abs(z) - wallZ(x, y) - 0.02, y - 4.86), min: v(-2, 2.5, -1.2), max: v(0.5, 5.3, 1.2) };
  parts.push({
    name: 'diaphragma', tissue: 'diaphragm',
    geometry: solid([sheet, ...[1, -1].map((s) => cone(v(-0.95, 4.65, s * 0.12), v(-1.5, 4.82, s * 0.06), 0.06, 0.04))], {
      voxel: 0.02, k: 0.012, fibers: true,
      intersect: [capBox, inWall], intK: 0.02,
      subtract: [
        cone(v(0.3, 4.66, -0.02), v(-1.5, 4.62, -0.02), 0.085, 0.085), // hiato aórtico
        cone(v(0.2, 4.4, -0.16), v(-1.2, 4.24, -0.34), 0.07, 0.07), // hiato esofágico
        cone(v(0.3, 3.98, 0.15), v(-1.2, 4.05, 0.15), 0.075, 0.075), // foramen de la vena cava
      ],
      subK: 0.01,
      paint: [ellipsoidB(v(DOME.c.x + DOME.r.x, DOME.c.y, 0), [v(1, 0, 0), v(0, 1, 0), v(0, 0, 1)], v(0.25, 0.42, 0.34))], // centro tendinoso
      paintBlend: 0.12,
    }),
  });
  return hull;
}
