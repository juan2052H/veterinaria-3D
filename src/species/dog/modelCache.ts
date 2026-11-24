/**
 * Caché del modelo generado en IndexedDB.
 *
 * La generación del modelo esquemático tarda varios segundos; se guarda el resultado
 * en el navegador en un formato compacto (fibras y tejido secundario cuantizados a
 * 8 bits, índices de 16 bits cuando caben, sin normales) y en las visitas siguientes
 * solo se reconstruyen las normales.
 *
 * IMPORTANTE: al cambiar la geometría del modelo hay que incrementar MODEL_VERSION.
 * En desarrollo la caché está desactivada para ver siempre el último código.
 */
import * as THREE from 'three';
import type { Part } from './model/common';

export const MODEL_VERSION = 'dog-schematic-2.2';
const DB = 'vet3d-model-cache';
const STORE = 'models';

interface CompactPart {
  name: string;
  tissue: Part['tissue'];
  alt?: string;
  baseOpacity?: number;
  position: Float32Array;
  fiber?: Int8Array;
  altAttr?: Uint8Array;
  index: Uint16Array | Uint32Array;
}

export const cacheEnabled = () => typeof indexedDB !== 'undefined' && !import.meta.env.DEV;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadCachedParts(): Promise<Part[] | null> {
  if (!cacheEnabled()) return null;
  try {
    const db = await open();
    const data = await new Promise<CompactPart[] | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(MODEL_VERSION);
      req.onsuccess = () => resolve(req.result as CompactPart[] | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!data) return null;
    return data.map((c) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(c.position, 3));
      if (c.fiber) g.setAttribute('fiber', new THREE.BufferAttribute(new Float32Array(c.fiber).map((x) => x / 127), 3));
      if (c.altAttr) g.setAttribute('alt', new THREE.BufferAttribute(new Float32Array(c.altAttr).map((x) => x / 255), 1));
      g.setIndex(new THREE.BufferAttribute(c.index, 1));
      g.computeVertexNormals();
      g.computeBoundingBox();
      g.computeBoundingSphere();
      return { name: c.name, tissue: c.tissue, alt: c.alt, baseOpacity: c.baseOpacity, geometry: g };
    });
  } catch {
    return null; // una caché dañada o bloqueada no debe impedir generar el modelo
  }
}

export async function saveCachedParts(parts: Part[]): Promise<void> {
  if (!cacheEnabled()) return;
  try {
    const data: CompactPart[] = parts.map((p) => {
      const g = p.geometry;
      const pos = g.attributes.position.array as Float32Array;
      const fib = g.attributes.fiber?.array as Float32Array | undefined;
      const alt = g.attributes.alt?.array as Float32Array | undefined;
      const idx = g.index!.array as ArrayLike<number>;
      const n = pos.length / 3;
      return {
        name: p.name, tissue: p.tissue, alt: p.alt, baseOpacity: p.baseOpacity,
        position: new Float32Array(pos),
        fiber: fib ? Int8Array.from(fib, (x) => Math.round(x * 127)) : undefined,
        altAttr: alt ? Uint8Array.from(alt, (x) => Math.round(Math.min(1, Math.max(0, x)) * 255)) : undefined,
        index: n < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx),
      };
    });
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear(); // conservar solo la versión actual
      store.put(data, MODEL_VERSION);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // sin espacio o en modo privado: simplemente no se guarda
  }
}
