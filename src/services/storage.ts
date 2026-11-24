/**
 * Capa de persistencia. En esta primera versión los datos se guardan en el navegador
 * (localStorage). Toda la app accede a la persistencia a través de este módulo y de los
 * stores, de modo que migrar a la API Node.js + PostgreSQL (ver server/schema.sql)
 * solo exige reimplementar estas funciones.
 */
const PREFIX = 'vet3d:';

export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (err) {
      console.error('No se pudo guardar en el almacenamiento local', err);
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignorar */
    }
  },
};

export function uid(prefix = ''): string {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return prefix + Date.now().toString(36) + rnd[0].toString(36) + rnd[1].toString(36);
}

export function downloadBlob(filename: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
