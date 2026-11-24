/**
 * Visor anatómico 3D. Funciona igual con el modelo esquemático generado por código
 * que con cualquier GLB: todas las mallas se anotan con su ficha (meshResolver) y el
 * estado visual (sistemas, capas, opacidad, cortes, selección) se aplica por malla.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, GizmoHelper, GizmoViewport, Html, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { Info } from 'lucide-react';
import { PEEL_STEPS, SYSTEM_BY_ID } from '../core/systems';
import type { AnatomicalStructure, MeshInfo, ModelSource } from '../core/types';
import { useModels, useStructureMap, useStructures } from '../store/content';
import { annotateModel } from './meshResolver';
import { useViewer, type ViewName, type ViewerState } from './viewerStore';
import { ErrorBoundary } from '../components/ErrorBoundary';

/** Plano de corte compartido por todos los materiales. */
export const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
/** Acceso al renderer para capturas de pantalla. */
export const glRef: { current: THREE.WebGLRenderer | null } = { current: null };

const proceduralCache = new WeakMap<object, THREE.Group>();
/** Generaciones en curso (Web Worker), para poder suspender el render mientras tanto. */
const proceduralPending = new WeakMap<object, { promise: Promise<void>; error?: Error }>();

export interface AnatomyViewerProps {
  className?: string;
  /** Se invoca al seleccionar una malla. Si se omite, la selección actualiza el store. */
  onPick?: (info: MeshInfo) => void;
  dark?: boolean;
  showDisclaimer?: boolean;
}

export function AnatomyViewer({ className = 'relative h-full w-full', onPick, dark = true, showDisclaimer = true }: AnatomyViewerProps) {
  const models = useModels();
  const modelIndex = useViewer((s) => s.modelIndex);
  const source = models[Math.min(modelIndex, models.length - 1)];
  const [showInfo, setShowInfo] = useState(false);

  return (
    <div className={`overflow-hidden ${dark ? 'viewer-bg-dark' : 'viewer-bg-light'} ${className}`}>
      <Canvas
        camera={{ position: [6, 6, 14], fov: 35, near: 0.05, far: 500 }}
        dpr={[1, 2]}
        shadows="soft"
        gl={{ antialias: true, preserveDrawingBuffer: true, localClippingEnabled: true }}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.localClippingEnabled = true;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <StudioLights dark={dark} />
        <ErrorBoundary
          fallback={(err) => (
            <Html center>
              <div className="w-72 rounded-lg bg-red-950/90 p-4 text-sm text-red-100">
                No se pudo cargar el modelo 3D. {String(err.message || err)}
              </div>
            </Html>
          )}
        >
          <Suspense fallback={<Html center><div className="rounded-lg bg-black/60 px-4 py-2 text-sm text-white">Cargando modelo…</div></Html>}>
            {source && <ModelLayer key={source.label} source={source} onPick={onPick} />}
          </Suspense>
        </ErrorBoundary>
        <StudioFloor dark={dark} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={0.6} maxDistance={80} />
        <CameraRig />
        <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
          <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
        </GizmoHelper>
      </Canvas>

      {showDisclaimer && source?.disclaimer && (
        <div className="pointer-events-auto absolute bottom-3 left-3 max-w-md">
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-200 backdrop-blur hover:bg-amber-500/25"
            aria-expanded={showInfo}
          >
            <Info size={13} /> {source.kind === 'procedural' ? 'Modelo esquemático provisional — no validado' : 'Aviso sobre el modelo'}
          </button>
          {showInfo && (
            <p className="mt-2 rounded-lg border border-amber-400/30 bg-ink-950/90 p-3 text-xs leading-relaxed text-amber-100 animate-fadein">
              {source.disclaimer}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================ Iluminación de estudio ============================ */

/**
 * Iluminación tipo estudio fotográfico de laboratorio: luz principal cenital-lateral con
 * sombras suaves, luz de relleno, contraluz para separar el contorno del fondo y un
 * entorno de "softboxes" (sin descargas) que da reflejos realistas a las superficies
 * húmedas (serosas, cartílago, vasos).
 */
function StudioLights({ dark }: { dark: boolean }) {
  return (
    <>
      <hemisphereLight args={['#fffaf2', dark ? '#2a2f3a' : '#c9ced8', 0.35]} />
      <directionalLight
        position={[5, 14, 9]}
        intensity={2.1}
        color="#fff6ea"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={9}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={40}
      />
      <directionalLight position={[-9, 6, -7]} intensity={0.55} color="#dfe8ff" />
      <directionalLight position={[-3, 4, 12]} intensity={0.35} color="#ffffff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 9, 2]} rotation={[Math.PI / 2, 0, 0]} scale={[14, 6, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[-9, 3, 4]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={0.9} position={[9, 3, -4]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={0.6} position={[0, 2, -10]} scale={6} />
      </Environment>
    </>
  );
}

/** Superficie de apoyo neutra con sombra de contacto (sin elementos decorativos). */
function StudioFloor({ dark }: { dark: boolean }) {
  const bounds = useViewer((s) => s.bounds);
  const cx = bounds ? (bounds.min[0] + bounds.max[0]) / 2 : 0;
  const cz = bounds ? (bounds.min[2] + bounds.max[2]) / 2 : 0;
  return (
    <group position={[cx, 0, cz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <meshStandardMaterial color={dark ? '#1c212b' : '#e4e7ec'} roughness={0.92} metalness={0} transparent opacity={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.006, 0]} receiveShadow>
        <circleGeometry args={[9, 64]} />
        <shadowMaterial opacity={dark ? 0.45 : 0.22} />
      </mesh>
    </group>
  );
}

/* ================================ Modelos ================================ */

function ModelLayer({ source, onPick }: { source: ModelSource; onPick?: (info: MeshInfo) => void }) {
  if (source.kind === 'procedural') return <ProceduralModel source={source} onPick={onPick} />;
  return <GlbModel source={source} onPick={onPick} />;
}

function ProceduralModel({ source, onPick }: { source: Extract<ModelSource, { kind: 'procedural' }>; onPick?: (i: MeshInfo) => void }) {
  const key = source.build;
  let root = proceduralCache.get(key);
  if (!root) {
    if (source.buildAsync) {
      // Patrón de Suspense: mientras el worker genera el modelo, se muestra "Cargando modelo…"
      let pending = proceduralPending.get(key);
      if (!pending) {
        const entry: { promise: Promise<void>; error?: Error } = { promise: Promise.resolve() };
        entry.promise = source.buildAsync()
          .then((g) => { proceduralCache.set(key, g); })
          .catch((err: Error) => {
            // Si el worker falla (p. ej., navegador sin soporte de workers de módulo), se genera aquí.
            try { proceduralCache.set(key, source.build()); } catch { entry.error = err; }
          });
        proceduralPending.set(key, entry);
        pending = entry;
      }
      if (pending.error) throw pending.error;
      throw pending.promise;
    }
    root = source.build();
    proceduralCache.set(key, root);
  }
  return <AnnotatedModel root={root} meshMap={{}} onPick={onPick} />;
}

function GlbModel({ source, onPick }: { source: Extract<ModelSource, { kind: 'glb' }>; onPick?: (i: MeshInfo) => void }) {
  const gltf = useGLTF(source.url);
  const root = useMemo(() => {
    const scene = gltf.scene.clone(true);
    const t = source.transform;
    if (t?.scale) scene.scale.setScalar(t.scale);
    if (t?.rotation) scene.rotation.set(...t.rotation);
    if (t?.position) scene.position.set(...t.position);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat) => (mat.side = THREE.DoubleSide));
      }
    });
    return scene;
  }, [gltf, source.transform]);
  return <AnnotatedModel root={root} meshMap={source.meshMap} onPick={onPick} />;
}

/* ============================ Modelo anotado ============================ */

const COLOR_SELECTED = new THREE.Color('#14b8a6');
const COLOR_COMPARE = new THREE.Color('#f59e0b');
const COLOR_HOVER = new THREE.Color('#60a5fa');
const COLOR_OK = new THREE.Color('#22c55e');
const COLOR_BAD = new THREE.Color('#ef4444');
const BLACK = new THREE.Color(0, 0, 0);

function meshVisualState(info: MeshInfo, st: ViewerState) {
  const sys = info.system;
  const quizCorrect = st.quiz.correctId && info.structureId === st.quiz.correctId;
  if (!sys || !info.structureId) {
    // Malla sin ficha asociada (solo en GLB): se muestra en gris.
    return { visible: !(st.isolate && st.selectedId) && !st.quiz.active, opacity: st.transparentAll ? 0.35 : 1 };
  }
  const depthOk = (info.layerDepth ?? SYSTEM_BY_ID[sys].depth) >= PEEL_STEPS[Math.min(st.peel, PEEL_STEPS.length - 1)].depth;
  const sexOk = !info.sex || info.sex === st.sex;
  const lc = st.layerCompare;
  const inCompare = lc.enabled && (sys === lc.a || sys === lc.b);
  let visible: boolean = (st.visible[sys] || inCompare) && depthOk && sexOk && !st.hidden[info.structureId];
  if (st.isolate && st.selectedId) visible = info.structureId === st.selectedId && sexOk;
  let opacity = st.opacity[sys];
  if (inCompare) opacity = sys === lc.a ? 1 - lc.t : lc.t;
  if (st.transparentAll) opacity *= 0.35;
  if (st.xray && st.selectedId) opacity = info.structureId === st.selectedId ? 1 : Math.min(opacity, 0.1);
  if (quizCorrect) {
    visible = true;
    opacity = 1;
  }
  return { visible: visible && opacity > 0.01, opacity };
}

function AnnotatedModel({ root, meshMap, onPick }: { root: THREE.Object3D; meshMap: Record<string, { structureId: string; side?: 'l' | 'r' }>; onPick?: (i: MeshInfo) => void }) {
  const structures = useStructures();
  const st = useViewer();
  const setViewer = useViewer((s) => s.set);
  const select = useViewer((s) => s.select);
  const hover = useViewer((s) => s.hover);

  // Anotar mallas e indexarlas una vez por modelo
  const { meshes, centers } = useMemo(() => {
    annotateModel(root, structures, meshMap);
    root.updateMatrixWorld(true);
    const list: THREE.Mesh[] = [];
    const ctr = new Map<string, THREE.Vector3>();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      list.push(m);
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      ctr.set(m.name, m.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(m.matrixWorld));
    });
    return { meshes: list, centers: ctr };
  }, [root, structures, meshMap]);

  useEffect(() => {
    const index: Record<string, string[]> = {};
    const depth: Record<string, number> = {};
    for (const m of meshes) {
      const info = m.userData as MeshInfo;
      if (!info.structureId) continue;
      (index[info.structureId] ??= []).push(m.name);
      if (info.layerDepth !== undefined) depth[info.structureId] = info.layerDepth;
    }
    const box = new THREE.Box3().setFromObject(root);
    setViewer({ meshIndex: index, depthIndex: depth, bounds: { min: box.min.toArray(), max: box.max.toArray() } });
  }, [meshes, root, setViewer]);

  // Plano de corte
  useEffect(() => {
    const b = st.bounds;
    if (!b) return;
    const axis = st.clip.plane === 'sagital' ? 2 : st.clip.plane === 'transversal' ? 0 : 1;
    const value = b.min[axis] + (b.max[axis] - b.min[axis]) * st.clip.pos;
    const n = new THREE.Vector3();
    n.setComponent(axis, st.clip.flip ? 1 : -1);
    clipPlane.normal.copy(n);
    clipPlane.constant = st.clip.flip ? -value : value;
  }, [st.clip, st.bounds]);

  // Aplicar estado visual a cada malla. La opacidad no cambia de golpe: se fija un objetivo
  // y useFrame la interpola, de modo que al retirar o mostrar capas la transición es fluida
  // y se conserva la orientación espacial.
  const animating = useRef(true);
  useEffect(() => {
    const selectedSide = st.selectedMesh ? (meshes.find((m) => m.name === st.selectedMesh)?.userData as MeshInfo | undefined) : undefined;
    for (const m of meshes) {
      const info = m.userData as MeshInfo;
      const { visible, opacity } = meshVisualState(info, st);
      const base = (m.userData.baseOpacity as number | undefined) ?? 1;
      m.userData.__target = visible ? Math.min(1, opacity * base) : 0;
      if (m.userData.__cur === undefined) m.userData.__cur = 0;
      let emissive = BLACK;
      let intensity = 0;
      if (st.quiz.correctId && info.structureId === st.quiz.correctId) { emissive = COLOR_OK; intensity = 0.65; }
      else if (st.quiz.wrongMesh === m.name) { emissive = COLOR_BAD; intensity = 0.65; }
      else if (m.name === st.selectedMesh) { emissive = COLOR_SELECTED; intensity = 0.55; }
      else if (st.compareSides && selectedSide?.structureId && info.structureId === selectedSide.structureId) { emissive = COLOR_COMPARE; intensity = 0.5; }
      else if (m.name === st.hoveredMesh) { emissive = COLOR_HOVER; intensity = 0.22; }
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[];
      for (const mat of mats) {
        const hadClip = !!mat.clippingPlanes?.length;
        mat.clippingPlanes = st.clip.enabled ? [clipPlane] : null;
        if ('emissive' in mat && mat.emissive) {
          mat.emissive.copy(emissive);
          mat.emissiveIntensity = intensity;
        }
        if (!info.structureId && mat.color) mat.color.set('#9aa3b2');
        if (hadClip !== st.clip.enabled) mat.needsUpdate = true;
      }
    }
    animating.current = true;
  }, [meshes, st]);

  useFrame((_, dt) => {
    if (!animating.current) return;
    const k = 1 - Math.exp(-dt * 9);
    let still = true;
    for (const m of meshes) {
      const target = m.userData.__target as number;
      let cur = m.userData.__cur as number;
      if (Math.abs(target - cur) > 0.004) { cur += (target - cur) * k; still = false; } else cur = target;
      m.userData.__cur = cur;
      m.visible = cur > 0.01;
      m.castShadow = cur > 0.85;
      m.renderOrder = cur < 0.999 ? 2 : 0;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[];
      for (const mat of mats) {
        const wasTransparent = mat.transparent;
        mat.opacity = cur;
        mat.transparent = cur < 0.999;
        mat.depthWrite = cur >= 0.6;
        if (wasTransparent !== mat.transparent) mat.needsUpdate = true;
      }
    }
    if (still) animating.current = false;
  });
  const choose = (e: ThreeEvent<PointerEvent | MouseEvent>): THREE.Mesh | null => {
    const candidates: THREE.Mesh[] = [];
    for (const it of e.intersections) {
      const m = it.object as THREE.Mesh;
      if (!m.isMesh || !isShown(m)) continue;
      if (st.clip.enabled && clipPlane.distanceToPoint(it.point) < 0) continue;
      candidates.push(m);
    }
    const opaque = candidates.find((m) => {
      const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      return mat.opacity >= 0.35;
    });
    return opaque ?? candidates[0] ?? null;
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // fue un arrastre de cámara
    const m = choose(e);
    if (!m) return;
    const info = m.userData as MeshInfo;
    if (onPick) onPick(info);
    else select(m.name, info.structureId ?? null);
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const m = choose(e);
    hover(m?.name ?? null);
    document.body.style.cursor = m ? 'pointer' : 'auto';
  };

  return (
    <>
      <primitive
        object={root}
        onClick={onClick}
        onPointerMove={onMove}
        onPointerOut={() => {
          hover(null);
          document.body.style.cursor = 'auto';
        }}
      />
      <Labels meshes={meshes} centers={centers} />
    </>
  );
}

function isShown(o: THREE.Object3D | null): boolean {
  while (o) {
    if (!o.visible) return false;
    o = o.parent;
  }
  return true;
}

/* ================================ Etiquetas ================================ */

function labelText(info: MeshInfo, s: AnatomicalStructure | undefined) {
  if (!s) return info.meshName;
  const side = info.side === 'l' ? ' (izq.)' : info.side === 'r' ? ' (der.)' : '';
  return s.name + side;
}

function Labels({ meshes, centers }: { meshes: THREE.Mesh[]; centers: Map<string, THREE.Vector3> }) {
  const byId = useStructureMap();
  const st = useViewer();
  const names = new Set<string>();
  if (st.labels === 'all') {
    for (const m of meshes) if (m.visible && (m.userData as MeshInfo).structureId && names.size < 70) names.add(m.name);
  }
  if (st.labels !== 'none') {
    if (st.selectedMesh) names.add(st.selectedMesh);
    if (st.hoveredMesh) names.add(st.hoveredMesh);
  }
  if (st.quiz.correctId) {
    const m = meshes.find((x) => (x.userData as MeshInfo).structureId === st.quiz.correctId);
    if (m) names.add(m.name);
  }
  return (
    <>
      {[...names].map((n) => {
        const m = meshes.find((x) => x.name === n);
        const pos = centers.get(n);
        if (!m || !pos) return null;
        const info = m.userData as MeshInfo;
        const strong = n === st.selectedMesh || (st.quiz.correctId && info.structureId === st.quiz.correctId);
        return (
          <Html key={n} position={pos} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium shadow-lg ${strong ? 'bg-brand-500 text-white' : 'bg-ink-950/80 text-ink-100'}`}>
              {labelText(info, info.structureId ? byId.get(info.structureId) : undefined)}
            </div>
          </Html>
        );
      })}
    </>
  );
}

/* ================================ Cámara ================================ */

const VIEW_DIRS: Record<ViewName, THREE.Vector3> = {
  lateral_derecha: new THREE.Vector3(0, 0.05, 1),
  lateral_izquierda: new THREE.Vector3(0, 0.05, -1),
  dorsal: new THREE.Vector3(0.001, 1, 0.001),
  ventral: new THREE.Vector3(0.001, -1, 0.001),
  craneal: new THREE.Vector3(1, 0.05, 0),
  caudal: new THREE.Vector3(-1, 0.05, 0),
  iso: new THREE.Vector3(0.55, 0.38, 0.75),
};

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const cmd = useViewer((s) => s.camCmd);
  const bounds = useViewer((s) => s.bounds);
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => (goal.current = null);
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, [controls]);

  useEffect(() => {
    if (!bounds || !controls) return;
    const box = new THREE.Box3(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max));
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const aspect = size.width / Math.max(size.height, 1);
    const fit = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 0.78 * Math.max(1, 1.25 / aspect);
    const c = cmd ?? { kind: 'view' as const, view: 'iso' as ViewName, n: 0 };
    if (!cmd && initialized.current) return;
    initialized.current = true;
    if (c.kind === 'view') {
      goal.current = { target: center, pos: center.clone().add(VIEW_DIRS[c.view].clone().normalize().multiplyScalar(fit)) };
    } else if (c.kind === 'fit') {
      const dir = camera.position.clone().sub(controls.target).normalize();
      goal.current = { target: center, pos: center.clone().add(dir.multiplyScalar(fit)) };
    } else if (c.kind === 'focus') {
      const obj = scene.getObjectByName(c.meshName) as THREE.Mesh | undefined;
      if (!obj) return;
      if (!obj.geometry.boundingSphere) obj.geometry.computeBoundingSphere();
      const sphere = obj.geometry.boundingSphere!.clone().applyMatrix4(obj.matrixWorld);
      const dir = camera.position.clone().sub(controls.target).normalize();
      const dist = Math.max(sphere.radius * 6.5, radius * 0.35);
      goal.current = { target: sphere.center, pos: sphere.center.clone().add(dir.multiplyScalar(dist)) };
    }
  }, [cmd, bounds, controls, camera, scene, size.width, size.height]);

  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    const k = 1 - Math.exp(-dt * 7);
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceTo(g.pos) < 0.003 && controls.target.distanceTo(g.target) < 0.003) goal.current = null;
  });
  return null;
}
