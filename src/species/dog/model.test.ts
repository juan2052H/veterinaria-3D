import { describe, expect, it } from 'vitest';
import { buildDogSchematic } from './schematicModel';
import { DOG_STRUCTURES } from './structures';
import { annotateModel, parseMeshName } from '../../viewer/meshResolver';
import type * as THREE from 'three';

describe('modelo esquemático del perro', () => {
  const group = buildDogSchematic();
  const meshes: THREE.Mesh[] = [];
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });

  it('todas las mallas tienen una ficha asociada', () => {
    const { unmapped } = annotateModel(group, DOG_STRUCTURES);
    expect(unmapped).toEqual([]);
  });

  it('todas las fichas tienen al menos una malla (y ambas si son bilaterales)', () => {
    for (const s of DOG_STRUCTURES) {
      const own = meshes.filter((m) => parseMeshName(m.name).structureId === s.id);
      expect(own.length, s.id).toBeGreaterThan(0);
      if (s.bilateral) {
        expect(own.some((m) => parseMeshName(m.name).side === 'l'), `${s.id} izq.`).toBe(true);
        expect(own.some((m) => parseMeshName(m.name).side === 'r'), `${s.id} der.`).toBe(true);
      }
    }
  });

  it('la piel se genera con geometría no vacía y dentro de los límites esperados', () => {
    const skin = meshes.find((m) => m.name === 'cutis')!;
    const n = skin.geometry.attributes.position.count;
    expect(n).toBeGreaterThan(3000);
    const bb = skin.geometry.boundingBox!;
    expect(bb.min.y).toBeGreaterThan(-0.3);
    expect(bb.max.x).toBeGreaterThan(5);
    expect(bb.min.x).toBeLessThan(-4.5);
    expect(bb.max.z).toBeLessThan(2.2);
  });

  it('las geometrías no contienen valores NaN', () => {
    for (const m of meshes) {
      const arr = m.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < arr.length; i += 97) expect(Number.isFinite(arr[i]), m.name).toBe(true);
    }
  });
});

describe('parseMeshName', () => {
  it('interpreta lado, sexo y sufijos de exportación', () => {
    expect(parseMeshName('femur__l')).toEqual({ structureId: 'femur', side: 'l', sex: undefined });
    expect(parseMeshName('urethra@female')).toEqual({ structureId: 'urethra', side: undefined, sex: 'female' });
    expect(parseMeshName('pulmo__r.001').structureId).toBe('pulmo');
    expect(parseMeshName('cor').structureId).toBe('cor');
  });
});
