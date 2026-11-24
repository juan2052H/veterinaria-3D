/// <reference lib="webworker" />
/**
 * Genera el modelo esquemático fuera del hilo principal para que la interfaz no se
 * bloquee durante los segundos que tarda la poligonización. Si el navegador ya tiene
 * el modelo en caché (IndexedDB), lo usa y solo reconstruye las normales. Devuelve los
 * búferes de geometría como objetos transferibles (sin copia).
 */
import { buildDogSchematicParts, serializeParts } from './schematicModel';
import { loadCachedParts, saveCachedParts } from './modelCache';

self.onmessage = async () => {
  try {
    const t0 = performance.now();
    let parts = await loadCachedParts();
    const cached = !!parts;
    const t1 = performance.now();
    if (!parts) parts = buildDogSchematicParts();
    const t2 = performance.now();
    const { parts: out, transfer } = serializeParts(parts);
    const timing = { cache: Math.round(t1 - t0), build: Math.round(t2 - t1) };
    (self as unknown as Worker).postMessage({ ok: true, parts: out, cached, timing }, transfer);
    // Guardar después de responder: la escritura no retrasa la primera visualización
    // (serializeParts copia los búferes, así que `parts` sigue intacto tras la transferencia)
    if (!cached) await saveCachedParts(parts);
    (self as unknown as Worker).postMessage({ done: true });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String((err as Error)?.message ?? err) });
  }
};
