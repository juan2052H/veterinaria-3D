/**
 * Materiales PBR por tejido para modelos generados por código.
 *
 * En lugar de colores planos, cada tejido añade en el shader un microrrelieve y una
 * variación de color procedurales (ruido 3D en el espacio del objeto, por lo que no
 * requieren coordenadas UV ni texturas descargadas):
 *   - músculo: fibras orientadas según el eje del vientre muscular (atributo `fiber`)
 *   - hueso: porosidad fina y moteado
 *   - pulmón: lobulillos poligonales y aspecto esponjoso
 *   - encéfalo: circunvoluciones (giros y surcos)
 *   - piel: pelaje direccional con brillo de tipo "sheen"
 *   - grasa, glándulas: lobulación
 * El relieve se atenúa con la distancia para evitar parpadeo (aliasing).
 *
 * Los modelos GLB conservan sus propios materiales; esto solo se aplica al modelo
 * esquemático o a cualquier malla a la que se le asigne explícitamente.
 */
import * as THREE from 'three';

export type Tissue =
  | 'fur' | 'fat' | 'muscle' | 'muscleDark' | 'tendon' | 'bone' | 'tooth' | 'cartilage' | 'disc' | 'ligament'
  | 'lung' | 'liver' | 'heart' | 'kidney' | 'adrenal' | 'gut' | 'stomach' | 'colon' | 'artery' | 'vein'
  | 'nerve' | 'brain' | 'cerebellum' | 'cord' | 'gland' | 'spleen' | 'lymph' | 'mucosa' | 'tongue'
  | 'airway' | 'bladder' | 'ureter' | 'gallbladder' | 'gonad' | 'uterus' | 'pad' | 'diaphragm' | 'eye' | 'fascia';

/** Tipo de patrón procedural (debe coincidir con las ramas del shader). */
const P = { none: 0, fur: 1, lobule: 2, fiber: 3, porous: 4, lung: 5, smooth: 6, gyri: 7, rings: 8, papillae: 9, folds: 10 } as const;

interface Spec {
  color: string;
  color2: string;
  pattern: number;
  scale: number;
  bump: number;
  roughness: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  sheen?: number;
  sheenColor?: string;
  /** Mezcla máxima hacia color2 según el patrón. */
  mix?: number;
  /** Tejido secundario (atributo `alt`): tendón, cartílago articular, grasa… */
  alt?: string;
}

const SPECS: Record<Tissue, Spec> = {
  fur: { color: '#8a5a36', color2: '#3d2614', pattern: P.fur, scale: 1, bump: 0.55, roughness: 0.78, sheen: 1, sheenColor: '#d8b089', mix: 0.55, alt: '#2b2320' },
  fat: { color: '#f0d27c', color2: '#d9a94a', pattern: P.lobule, scale: 9, bump: 0.5, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.3, mix: 0.45 },
  muscle: { color: '#a8352b', color2: '#6e1c17', pattern: P.fiber, scale: 1, bump: 0.5, roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.35, mix: 0.55, alt: '#ece4d6' },
  muscleDark: { color: '#93302a', color2: '#5c1712', pattern: P.fiber, scale: 1, bump: 0.5, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35, mix: 0.55, alt: '#ece4d6' },
  tendon: { color: '#ece6da', color2: '#c9bfae', pattern: P.fiber, scale: 1, bump: 0.25, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.4 },
  bone: { color: '#e9dfc8', color2: '#bda983', pattern: P.porous, scale: 30, bump: 0.4, roughness: 0.62, mix: 0.4, alt: '#cfe2e8' },
  tooth: { color: '#f7f3e8', color2: '#dccfae', pattern: P.smooth, scale: 6, bump: 0.05, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.1, mix: 0.3 },
  cartilage: { color: '#c9dfe6', color2: '#9fbfcf', pattern: P.smooth, scale: 6, bump: 0.1, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.35 },
  disc: { color: '#b9d6e4', color2: '#e8f0f2', pattern: P.rings, scale: 40, bump: 0.15, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.4 },
  ligament: { color: '#f1ece2', color2: '#cfc5b3', pattern: P.fiber, scale: 1, bump: 0.3, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.4 },
  lung: { color: '#e8a0a4', color2: '#b8636e', pattern: P.lung, scale: 7, bump: 0.55, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.25, mix: 0.6 },
  liver: { color: '#6e2219', color2: '#4a130e', pattern: P.lobule, scale: 22, bump: 0.12, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, mix: 0.4 },
  heart: { color: '#8f2a24', color2: '#5a1410', pattern: P.fiber, scale: 0.6, bump: 0.25, roughness: 0.35, clearcoat: 0.85, clearcoatRoughness: 0.15, mix: 0.45, alt: '#eac873' },
  kidney: { color: '#7a2a24', color2: '#4e1712', pattern: P.smooth, scale: 8, bump: 0.08, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.12, mix: 0.4 },
  adrenal: { color: '#d8a24a', color2: '#a8702a', pattern: P.lobule, scale: 20, bump: 0.3, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.25, mix: 0.4 },
  gut: { color: '#e3a18b', color2: '#c46f62', pattern: P.folds, scale: 5, bump: 0.25, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.4 },
  stomach: { color: '#dc9886', color2: '#b8665a', pattern: P.folds, scale: 3, bump: 0.3, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.4 },
  colon: { color: '#c98a72', color2: '#9a5c4a', pattern: P.folds, scale: 4, bump: 0.3, roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.18, mix: 0.4 },
  artery: { color: '#c42a2a', color2: '#8a1414', pattern: P.fiber, scale: 0.5, bump: 0.12, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.3 },
  vein: { color: '#3757a8', color2: '#1f3470', pattern: P.fiber, scale: 0.5, bump: 0.12, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.3 },
  nerve: { color: '#f2d24a', color2: '#c9a020', pattern: P.fiber, scale: 0.7, bump: 0.45, roughness: 0.4, clearcoat: 0.4, clearcoatRoughness: 0.3, mix: 0.45 },
  brain: { color: '#efc9bd', color2: '#c48e82', pattern: P.gyri, scale: 6, bump: 1.0, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.6 },
  cerebellum: { color: '#e6b6a8', color2: '#b67c70', pattern: P.rings, scale: 70, bump: 0.6, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.5 },
  cord: { color: '#f3e2c4', color2: '#d9bf92', pattern: P.fiber, scale: 0.5, bump: 0.2, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, mix: 0.3 },
  gland: { color: '#e8c27a', color2: '#c4924a', pattern: P.lobule, scale: 16, bump: 0.55, roughness: 0.48, clearcoat: 0.45, clearcoatRoughness: 0.25, mix: 0.45 },
  spleen: { color: '#6a2440', color2: '#45132a', pattern: P.smooth, scale: 10, bump: 0.08, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.12, mix: 0.4 },
  lymph: { color: '#c9b9a0', color2: '#9a8a70', pattern: P.lobule, scale: 30, bump: 0.3, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.35 },
  mucosa: { color: '#e48c98', color2: '#b55a68', pattern: P.folds, scale: 8, bump: 0.35, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.4 },
  tongue: { color: '#d97a86', color2: '#a84c5a', pattern: P.papillae, scale: 70, bump: 0.5, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2, mix: 0.35 },
  airway: { color: '#eccfc6', color2: '#c9a59a', pattern: P.rings, scale: 22, bump: 0.6, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, mix: 0.45 },
  bladder: { color: '#e8cf86', color2: '#c4a050', pattern: P.smooth, scale: 5, bump: 0.1, roughness: 0.25, clearcoat: 0.9, clearcoatRoughness: 0.1, mix: 0.35 },
  ureter: { color: '#e2c27a', color2: '#b8964a', pattern: P.fiber, scale: 0.5, bump: 0.1, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, mix: 0.3 },
  gallbladder: { color: '#3f7a3a', color2: '#24501f', pattern: P.smooth, scale: 6, bump: 0.05, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, mix: 0.35 },
  gonad: { color: '#e9c0c8', color2: '#c08a96', pattern: P.smooth, scale: 8, bump: 0.08, roughness: 0.28, clearcoat: 0.85, clearcoatRoughness: 0.12, mix: 0.35 },
  uterus: { color: '#d98fa8', color2: '#a85a74', pattern: P.folds, scale: 6, bump: 0.2, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.15, mix: 0.4 },
  pad: { color: '#3a3330', color2: '#1c1816', pattern: P.papillae, scale: 90, bump: 0.8, roughness: 0.85, mix: 0.5, alt: '#2a2522' },
  eye: { color: '#2b1a10', color2: '#7a4a22', pattern: P.smooth, scale: 30, bump: 0.02, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, mix: 0.5 },
  fascia: { color: '#f0ebe2', color2: '#d6ccbc', pattern: P.fiber, scale: 1, bump: 0.15, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, mix: 0.3 },
  diaphragm: { color: '#b54a3e', color2: '#e8ddd0', pattern: P.fiber, scale: 1, bump: 0.35, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, mix: 0.35, alt: '#e9e2d4' },
};

const GLSL_NOISE = /* glsl */ `
varying vec3 vTPos;
varying vec3 vFiber;
varying float vAlt;
uniform vec3 uColor2;
uniform vec3 uAltColor;
uniform float uScale;
uniform float uBump;
uniform float uMix;
float tH;
float tH0;
float tMask;

float tHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float tNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tHash(i), tHash(i + vec3(1,0,0)), u.x), mix(tHash(i + vec3(0,1,0)), tHash(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(tHash(i + vec3(0,0,1)), tHash(i + vec3(1,0,1)), u.x), mix(tHash(i + vec3(0,1,1)), tHash(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float tFbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * tNoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
// Distancias a los dos puntos de Voronoi más cercanos (F1, F2)
vec2 tVoronoi(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(x, y, z);
    vec3 o = vec3(tHash(i + g), tHash(i + g + 19.7), tHash(i + g + 41.3));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
  }
  return vec2(d1, d2);
}
// Coordenadas alineadas con las fibras: x a lo largo de la fibra, yz transversales
vec3 tFiberSpace(vec3 p, vec3 f) {
  vec3 u = normalize(abs(f.y) < 0.9 ? cross(f, vec3(0, 1, 0)) : cross(f, vec3(1, 0, 0)));
  vec3 w = cross(f, u);
  return vec3(dot(p, f), dot(p, u), dot(p, w));
}

// Antialiasing: ancho de un píxel en unidades del modelo. Un componente de frecuencia f
// se desvanece hacia su valor medio cuando el píxel ya no puede representarlo.
float tAA;
float fadeF(float f) { return 1.0 - smoothstep(0.18, 0.5, tAA * f); }
float aaN(vec3 p, float f) { return mix(0.5, tNoise(p), fadeF(f)); }

void tissuePattern(vec3 p) {
  tH = 0.0; tMask = 0.0;
  tAA = length(fwidth(p));
#if TISSUE_PATTERN == 1
  // Pelaje corto: mechones orientados craneocaudalmente y algo ventralmente
  vec3 q = tFiberSpace(p, normalize(vec3(-1.0, -0.45, 0.0)));
  float strands = aaN(vec3(q.x * 4.0, q.y * 45.0, q.z * 45.0), 45.0);
  float clumps = mix(0.5, tFbm(vec3(q.x * 1.2, q.y * 7.0, q.z * 7.0)), fadeF(14.0));
  tH = strands * 0.55 + clumps * 0.45;
  float dorsal = smoothstep(4.3, 5.6, p.y);
  float ventral = 1.0 - smoothstep(2.6, 3.6, p.y);
  tMask = clamp(dorsal * 0.85 + (clumps - 0.5) * 0.5 - ventral * 0.35, 0.0, 1.0);
#elif TISSUE_PATTERN == 2
  vec2 v = tVoronoi(p * uScale);
  float edge = mix(0.75, smoothstep(0.0, 0.12, v.y - v.x), fadeF(uScale * 2.0));
  tH = edge * 0.8 + aaN(p * uScale * 3.0, uScale * 3.0) * 0.2;
  tMask = (1.0 - edge) * 0.8 + tNoise(p * uScale * 0.3) * 0.3;
#elif TISSUE_PATTERN == 3
  vec3 f = length(vFiber) > 0.5 ? normalize(vFiber) : vec3(1.0, 0.0, 0.0);
  vec3 q = tFiberSpace(p, f);
  float fibers = aaN(vec3(q.x * 3.0 * uScale, q.y * 70.0, q.z * 70.0), 70.0);
  float bundles = aaN(vec3(q.x * 1.0 * uScale, q.y * 16.0, q.z * 16.0), 16.0);
  tH = fibers * 0.45 + bundles * 0.55;
  tMask = smoothstep(0.35, 0.8, bundles) * 0.6 + tNoise(p * 2.5) * 0.3;
#elif TISSUE_PATTERN == 4
  float pores = aaN(p * uScale * 1.6, uScale * 1.6);
  float grain = mix(0.5, tFbm(p * uScale * 0.3), fadeF(uScale * 0.6));
  tH = pores * 0.45 + grain * 0.55;
  tMask = smoothstep(0.45, 0.85, tFbm(p * 2.2));
#elif TISSUE_PATTERN == 5
  vec2 v = tVoronoi(p * uScale);
  float septa = mix(0.25, 1.0 - smoothstep(0.0, 0.09, v.y - v.x), fadeF(uScale * 2.5));
  float sponge = aaN(p * uScale * 6.0, uScale * 6.0);
  tH = (1.0 - septa) * 0.6 + sponge * 0.4;
  tMask = septa * 0.55 + smoothstep(0.5, 0.9, tFbm(p * 2.0)) * 0.6;
#elif TISSUE_PATTERN == 6
  tH = mix(0.5, tFbm(p * uScale), fadeF(uScale * 2.0));
  tMask = smoothstep(0.4, 0.8, tFbm(p * uScale * 0.4));
#elif TISSUE_PATTERN == 7
  // Giros y surcos: ruido "ridged" anisótropo (más largos en sentido rostrocaudal)
  vec3 q = p * vec3(uScale * 0.7, uScale * 1.2, uScale * 1.2);
  float n = 1.0 - abs(tNoise(q) * 2.0 - 1.0);
  float n2 = mix(0.5, 1.0 - abs(tNoise(q * 2.1 + 5.0) * 2.0 - 1.0), fadeF(uScale * 2.5));
  tH = mix(0.5, pow(n, 2.5), fadeF(uScale * 1.2)) * 0.7 + n2 * 0.3;
  tMask = 1.0 - smoothstep(0.15, 0.55, tH);
#elif TISSUE_PATTERN == 8
  // Anillos/láminas transversales (cartílagos traqueales, folias del cerebelo)
  vec3 f = length(vFiber) > 0.5 ? normalize(vFiber) : vec3(1.0, 0.0, 0.0);
  float s = sin(dot(p, f) * uScale) * 0.5 + 0.5;
  float ring = mix(0.5, smoothstep(0.2, 0.8, s), fadeF(uScale / 6.2831));
  tH = ring * 0.85 + aaN(p * 30.0, 30.0) * 0.15;
  tMask = 1.0 - ring;
#elif TISSUE_PATTERN == 9
  vec2 v = tVoronoi(p * uScale);
  tH = mix(0.4, 1.0 - smoothstep(0.0, 0.45, v.x), fadeF(uScale * 1.5));
  tMask = smoothstep(0.3, 0.8, tFbm(p * 4.0));
#elif TISSUE_PATTERN == 10
  float n = tFbm(p * uScale);
  tH = smoothstep(0.3, 0.75, n) * 0.8 + aaN(p * uScale * 5.0, uScale * 5.0) * 0.2;
  tMask = smoothstep(0.45, 0.8, tFbm(p * uScale * 0.5 + 3.0));
#endif
}`;

/** Material físico con microrrelieve procedural según el tejido. */
export class TissueMaterial extends THREE.MeshPhysicalMaterial {
  readonly tissue: Tissue;
  readonly tissueUniforms: { uColor2: { value: THREE.Color }; uAltColor: { value: THREE.Color }; uScale: { value: number }; uBump: { value: number }; uMix: { value: number } };

  constructor(tissue: Tissue, altColor?: string) {
    const s = SPECS[tissue];
    super({
      color: s.color,
      roughness: s.roughness,
      metalness: 0,
      clearcoat: s.clearcoat ?? 0,
      clearcoatRoughness: s.clearcoatRoughness ?? 0.3,
      sheen: s.sheen ?? 0,
      sheenColor: new THREE.Color(s.sheenColor ?? '#ffffff'),
      sheenRoughness: 0.6,
      side: THREE.DoubleSide,
    });
    this.tissue = tissue;
    this.tissueUniforms = {
      uColor2: { value: new THREE.Color(s.color2) },
      uAltColor: { value: new THREE.Color(altColor ?? s.alt ?? '#ffffff') },
      uScale: { value: s.scale },
      uBump: { value: s.bump },
      uMix: { value: s.mix ?? 0.4 },
    };
    const pattern = s.pattern;
    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.tissueUniforms);
      shader.defines = { ...(shader.defines ?? {}), TISSUE_PATTERN: pattern };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 fiber;\nattribute float alt;\nvarying vec3 vTPos;\nvarying vec3 vFiber;\nvarying float vAlt;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTPos = position;\nvFiber = fiber;\nvAlt = alt;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${GLSL_NOISE}`)
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          tissuePattern(vTPos);
          tH0 = tH;
          diffuseColor.rgb = mix(diffuseColor.rgb, uColor2, clamp(tMask, 0.0, 1.0) * uMix);
          diffuseColor.rgb *= 0.88 + 0.24 * tH;
          diffuseColor.rgb = mix(diffuseColor.rgb, uAltColor * (0.92 + 0.12 * tH), clamp(vAlt, 0.0, 1.0));
          tH *= 1.0 - 0.7 * clamp(vAlt, 0.0, 1.0);`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor * (0.85 + 0.3 * tH), 0.04, 1.0);`,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          {
            // Relieve: gradiente del patrón en el espacio del objeto (diferencias finitas).
            // A diferencia de las derivadas de pantalla, no produce bloques de 2×2 píxeles.
            // Las mallas del modelo no están transformadas, así que objeto = mundo.
            float hC = tH, mC = tMask;
            float e = max(tAA * 0.75, 0.0006);
            tissuePattern(vTPos + vec3(e, 0.0, 0.0)); float hx = tH;
            tissuePattern(vTPos + vec3(0.0, e, 0.0)); float hy = tH;
            tissuePattern(vTPos + vec3(0.0, 0.0, e)); float hz = tH;
            vec3 g = vec3(hx - tH0, hy - tH0, hz - tH0) / e * (1.0 - 0.7 * clamp(vAlt, 0.0, 1.0));
            vec3 gv = (viewMatrix * vec4(g, 0.0)).xyz;
            gv -= dot(gv, normal) * normal;
            normal = normalize(normal - gv * uBump * 0.004);
            tH = hC; tMask = mC;
          }`,
        );    };
  }

  customProgramCacheKey() {
    return `tissue-${this.tissue}`;
  }

  clone(): this {
    return new TissueMaterial(this.tissue).copy(this) as this;
  }

  copy(source: THREE.MeshPhysicalMaterial): this {
    super.copy(source);
    if (source instanceof TissueMaterial && this.tissueUniforms) {
      this.tissueUniforms.uColor2.value.copy(source.tissueUniforms.uColor2.value);
      this.tissueUniforms.uAltColor.value.copy(source.tissueUniforms.uAltColor.value);
      this.tissueUniforms.uScale.value = source.tissueUniforms.uScale.value;
      this.tissueUniforms.uBump.value = source.tissueUniforms.uBump.value;
      this.tissueUniforms.uMix.value = source.tissueUniforms.uMix.value;
    }
    return this;
  }
}

export function tissueColor(t: Tissue) {
  return SPECS[t].color;
}
