/**
 * Derivación de contraseñas con PBKDF2-SHA256 (Web Crypto API).
 * Nunca se guarda la contraseña en claro. En producción la verificación debe hacerse en
 * el servidor (ver server/README.md); este módulo cubre el modo local.
 */
const ITERATIONS = 210_000;

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

export async function hashPassword(password: string, saltHex?: string): Promise<{ salt: string; hash: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return { salt: toHex(salt.buffer as ArrayBuffer), hash: toHex(bits) };
}

export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const res = await hashPassword(password, salt);
  // comparación en tiempo constante
  if (res.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= res.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push('al menos 8 caracteres');
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(pw)) issues.push('una letra');
  if (!/\d/.test(pw)) issues.push('un número');
  return issues;
}
