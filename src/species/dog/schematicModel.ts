/**
 * MODELO ESQUEMÁTICO PROVISIONAL DEL PERRO (versión 2: modelado orgánico por SDF)
 * ------------------------------------------------------------------------------
 * Genera por código un modelo con una malla independiente por estructura, nombrada
 * con la convención `<structureId>[__l|__r][@male|@female]`.
 *
 * Cada estructura se modela como unión suave de campos de distancia (ver ./sdf.ts) con
 * sus accidentes anatómicos principales, y se representa con un material propio de su
 * tejido (ver viewer/tissueMaterials.ts). Los módulos están en ./model/.
 *
 * IMPORTANTE: sigue siendo una aproximación construida a partir de descripciones de la
 * bibliografía, NO un modelo obtenido de un espécimen ni validado por un docente. Las
 * formas y proporciones son aproximadas. La interfaz lo indica de forma permanente.
 * La ruta hacia un modelo de calidad profesional está en docs/MODELOS_3D.md.
 *
 * Sistema de coordenadas: el perro mira hacia +X, +Y es dorsal, +Z es el lado derecho.
 * Unidades aproximadas: 1 unidad ≈ 10 cm (perro de talla media).
 */
import * as THREE from 'three';
import { TissueMaterial } from '../../viewer/tissueMaterials';
import type { Part } from './model/common';
import { buildSkeleton } from './model/skeleton';
import { buildMuscles } from './model/muscles';
import { buildViscera } from './model/viscera';
import { buildIntegument } from './model/hull';

export type { Part };

export const SCHEMATIC_DISCLAIMER =
  'Modelo esquemático provisional generado por código a partir de descripciones de la bibliografía (Evans & de Lahunta; König & Liebich; Budras). Representa la forma general, la topografía y las relaciones entre estructuras, pero NO procede de un espécimen real ni ha sido validado por un docente: las formas y proporciones son aproximadas. Para un modelo de calidad profesional, ver docs/MODELOS_3D.md.';

export function buildDogSchematicParts(): Part[] {
  const parts: Part[] = [];
  const boneHull = buildSkeleton(parts);
  const muscleHull = buildMuscles(parts);
  buildViscera(parts);
  buildIntegument(parts, boneHull, muscleHull);
  return parts;
}

/* ----------------- Transferencia entre el worker y el hilo principal ----------------- */

export interface SerializedPart {
  name: string;
  tissue: Part['tissue'];
  alt?: string;
  baseOpacity?: number;
  attributes: Record<string, { array: Float32Array; itemSize: number }>;
  index: Uint32Array;
}

export function serializeParts(parts: Part[]): { parts: SerializedPart[]; transfer: ArrayBuffer[] } {
  const transfer: ArrayBuffer[] = [];
  const out = parts.map((p) => {
    const attributes: SerializedPart['attributes'] = {};
    for (const [key, attr] of Object.entries(p.geometry.attributes)) {
      const array = new Float32Array((attr as THREE.BufferAttribute).array as ArrayLike<number>);
      attributes[key] = { array, itemSize: attr.itemSize };
      transfer.push(array.buffer);
    }
    const index = new Uint32Array(p.geometry.index!.array as ArrayLike<number>);
    transfer.push(index.buffer);
    return { name: p.name, tissue: p.tissue, alt: p.alt, baseOpacity: p.baseOpacity, attributes, index };
  });
  return { parts: out, transfer };
}

export function deserializeParts(parts: SerializedPart[]): Part[] {
  return parts.map((p) => {
    const g = new THREE.BufferGeometry();
    for (const [key, a] of Object.entries(p.attributes)) g.setAttribute(key, new THREE.BufferAttribute(a.array, a.itemSize));
    g.setIndex(new THREE.BufferAttribute(p.index, 1));
    g.computeBoundingBox();
    return { name: p.name, tissue: p.tissue, alt: p.alt, baseOpacity: p.baseOpacity, geometry: g };
  });
}

/** Genera el modelo en un Web Worker (si el entorno lo permite) y construye el grupo. */
export function buildDogSchematicAsync(): Promise<THREE.Group> {
  if (typeof Worker === 'undefined') return Promise.resolve(buildDogSchematic());
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./schematic.worker.ts', import.meta.url), { type: 'module' });
    // El worker responde primero con el modelo y después, si lo acaba de generar, lo guarda
    // en la caché y envía { done }. No se cierra hasta entonces para no interrumpir la escritura.
    const stop = setTimeout(() => w.terminate(), 120000);
    w.onmessage = (e: MessageEvent<{ ok?: boolean; done?: boolean; parts?: SerializedPart[]; error?: string; cached?: boolean; timing?: { cache: number; build: number } }>) => {
      if (e.data.done) { clearTimeout(stop); w.terminate(); return; }
      if (e.data.ok && e.data.parts) {
        const t = e.data.timing;
        if (t) console.info(`[modelo] ${e.data.cached ? `leído de la caché en ${t.cache} ms` : `generado en ${t.build} ms`}`);
        resolve(partsToGroup(deserializeParts(e.data.parts)));
      } else {
        clearTimeout(stop);
        w.terminate();
        reject(new Error(e.data.error ?? 'Error al generar el modelo'));
      }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Error en el generador del modelo')); };
    w.postMessage('build');
  });
}

export function buildDogSchematic(): THREE.Group {
  return partsToGroup(buildDogSchematicParts());
}

export function partsToGroup(parts: Part[]): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dog_schematic';
  for (const p of parts) {
    p.geometry.computeBoundingSphere();
    const mat = new TissueMaterial(p.tissue, p.alt);
    const mesh = new THREE.Mesh(p.geometry, mat);
    mesh.name = p.name;
    if (p.baseOpacity !== undefined) mesh.userData.baseOpacity = p.baseOpacity;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
