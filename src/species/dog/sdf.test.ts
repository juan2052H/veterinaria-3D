import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cone, Field, solid, sphere } from './sdf';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function volume(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const idx = g.index!;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let vol = 0;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i)); b.fromBufferAttribute(p, idx.getX(i + 1)); c.fromBufferAttribute(p, idx.getX(i + 2));
    vol += a.dot(b.clone().cross(c)) / 6;
  }
  return vol;
}

describe('motor SDF', () => {
  it('poligoniza una esfera con volumen correcto y normales hacia fuera', () => {
    const g = solid([sphere(v(0, 0, 0), 1)], { voxel: 0.05, k: 0.02 });
    const exact = (4 / 3) * Math.PI;
    expect(volume(g)).toBeGreaterThan(exact * 0.93);
    expect(volume(g)).toBeLessThan(exact * 1.05);
    const n = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, 0);
    const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position, 0);
    expect(n.dot(p)).toBeGreaterThan(0);
  });

  it('la sustracción reduce el volumen', () => {
    const base = solid([sphere(v(0, 0, 0), 1)], { voxel: 0.05, k: 0.02 });
    const holed = solid([sphere(v(0, 0, 0), 1)], { voxel: 0.05, k: 0.02, subtract: [sphere(v(1, 0, 0), 0.5)] });
    expect(volume(holed)).toBeLessThan(volume(base) * 0.97);
  });

  it('el cono redondeado respeta sus radios y genera fibras', () => {
    const f = Field.fit([cone(v(0, 0, 0), v(2, 0, 0), 0.3, 0.1)], 0.03, 0.01);
    const g = f.mesh({ fibers: true });
    const bb = g.boundingBox!;
    expect(bb.min.x).toBeCloseTo(-0.3, 1);
    expect(bb.max.x).toBeCloseTo(2.1, 1);
    expect(Math.abs(g.attributes.fiber.getX(0))).toBeCloseTo(1, 3);
  });
});
