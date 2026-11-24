import type * as THREE from 'three';
import type { AnatomicalStructure, MeshInfo, MeshMap, Sex, Side } from '../core/types';
import { layerDepthOf } from '../core/systems';

/**
 * Resuelve el nombre de una malla a su ficha anatómica.
 *
 * Convención de nombres: `<structureId>[__l|__r][@male|@female]`
 *   femur__l          → fémur izquierdo
 *   cor               → corazón
 *   urethra@female    → uretra (variante femenina)
 *
 * Un `meshMap` explícito tiene prioridad (para GLB con nombres del artista).
 * GLTFLoader puede añadir sufijos como `_1`, `.001` al dividir mallas multimaterial;
 * también se toleran.
 */
export function parseMeshName(name: string): { structureId: string; side?: Side; sex?: Sex } {
  let base = name.trim();
  let sex: Sex | undefined;
  const sexMatch = base.match(/@(male|female)$/i);
  if (sexMatch) {
    sex = sexMatch[1].toLowerCase() as Sex;
    base = base.slice(0, -sexMatch[0].length);
  }
  base = base.replace(/(\.\d{3}|_\d+)$/, '');
  let side: Side | undefined;
  const sideMatch = base.match(/__(l|r)$/i);
  if (sideMatch) {
    side = sideMatch[1].toLowerCase() as Side;
    base = base.slice(0, -sideMatch[0].length);
  }
  return { structureId: base, side, sex };
}

export function resolveMesh(
  meshName: string,
  structures: Map<string, AnatomicalStructure>,
  meshMap: MeshMap = {},
): MeshInfo {
  const explicit = meshMap[meshName];
  if (explicit && structures.has(explicit.structureId)) {
    const st = structures.get(explicit.structureId)!;
    return { meshName, structureId: st.id, system: st.system, side: explicit.side, sex: st.sex, layerDepth: layerDepthOf(st.system, st.layer) };
  }
  const parsed = parseMeshName(meshName);
  const st = structures.get(parsed.structureId);
  if (!st) return { meshName };
  return { meshName, structureId: st.id, system: st.system, side: parsed.side, sex: parsed.sex ?? st.sex, layerDepth: layerDepthOf(st.system, st.layer) };
}

/** Anota todas las mallas del grupo con su MeshInfo y clona materiales para control individual. */
export function annotateModel(
  root: THREE.Object3D,
  structures: AnatomicalStructure[],
  meshMap: MeshMap = {},
): { mapped: number; unmapped: string[] } {
  const byId = new Map(structures.map((s) => [s.id, s]));
  let mapped = 0;
  const unmapped: string[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const info = resolveMesh(mesh.name || mesh.parent?.name || '', byId, meshMap);
    mesh.userData = { ...mesh.userData, ...info };
    if (!mesh.userData.__matCloned) {
      const mat = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      mesh.material = mat;
      mesh.userData.__matCloned = true;
      const m0 = (Array.isArray(mat) ? mat[0] : mat) as THREE.MeshStandardMaterial;
      mesh.userData.__baseColor = m0.color ? m0.color.getHex() : 0xcccccc;
    }
    if (info.structureId) mapped++;
    else unmapped.push(info.meshName);
  });
  return { mapped, unmapped };
}
