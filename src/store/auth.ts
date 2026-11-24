import { create } from 'zustand';
import { storage, uid } from '../services/storage';
import { hashPassword, passwordIssues, verifyPassword } from '../services/crypto';

export type Role = 'student' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  institution?: string;
  semester?: string;
  role: Role;
  createdAt: number;
}

interface StoredUser extends User {
  salt: string;
  hash: string;
}

interface AuthState {
  user: User | null;
  register: (data: { name: string; email: string; password: string; institution?: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginGuest: () => void;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'institution' | 'semester'>>) => void;
  changePassword: (current: string, next: string) => Promise<void>;
}

const USERS = 'users';
const SESSION = 'session';
const readUsers = () => storage.get<StoredUser[]>(USERS, []);
const strip = ({ salt: _s, hash: _h, ...u }: StoredUser): User => u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function restore(): User | null {
  const id = storage.get<string | null>(SESSION, null);
  if (!id) return null;
  if (id === 'guest') return storage.get<User | null>('guest', null);
  const u = readUsers().find((x) => x.id === id);
  return u ? strip(u) : null;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: restore(),

  async register({ name, email, password, institution }) {
    const e = email.trim().toLowerCase();
    if (name.trim().length < 2) throw new Error('Ingrese su nombre completo.');
    if (!EMAIL_RE.test(e)) throw new Error('El correo electrónico no es válido.');
    const issues = passwordIssues(password);
    if (issues.length) throw new Error(`La contraseña debe tener ${issues.join(', ')}.`);
    const users = readUsers();
    if (users.some((u) => u.email === e)) throw new Error('Ya existe una cuenta con ese correo.');
    const { salt, hash } = await hashPassword(password);
    const user: StoredUser = {
      id: uid('u_'), name: name.trim(), email: e, institution: institution?.trim(),
      // El primer usuario registrado en este navegador administra el contenido.
      role: users.length === 0 ? 'admin' : 'student',
      createdAt: Date.now(), salt, hash,
    };
    storage.set(USERS, [...users, user]);
    storage.set(SESSION, user.id);
    set({ user: strip(user) });
  },

  async login(email, password) {
    const e = email.trim().toLowerCase();
    const u = readUsers().find((x) => x.email === e);
    // Mismo mensaje en ambos casos para no revelar qué cuentas existen.
    if (!u || !(await verifyPassword(password, u.salt, u.hash))) throw new Error('Correo o contraseña incorrectos.');
    storage.set(SESSION, u.id);
    set({ user: strip(u) });
  },

  loginGuest() {
    const guest: User = { id: 'guest', name: 'Invitado', email: 'invitado@local', role: 'student', createdAt: Date.now() };
    storage.set('guest', guest);
    storage.set(SESSION, 'guest');
    set({ user: guest });
  },

  logout() {
    storage.remove(SESSION);
    set({ user: null });
  },

  updateProfile(patch) {
    const user = get().user;
    if (!user) return;
    const next = { ...user, ...patch };
    if (user.id === 'guest') storage.set('guest', next);
    else storage.set(USERS, readUsers().map((u) => (u.id === user.id ? { ...u, ...patch } : u)));
    set({ user: next });
  },

  async changePassword(current, next) {
    const user = get().user;
    if (!user || user.id === 'guest') throw new Error('La cuenta de invitado no tiene contraseña.');
    const users = readUsers();
    const u = users.find((x) => x.id === user.id)!;
    if (!(await verifyPassword(current, u.salt, u.hash))) throw new Error('La contraseña actual no es correcta.');
    const issues = passwordIssues(next);
    if (issues.length) throw new Error(`La nueva contraseña debe tener ${issues.join(', ')}.`);
    const { salt, hash } = await hashPassword(next);
    storage.set(USERS, users.map((x) => (x.id === user.id ? { ...x, salt, hash } : x)));
  },
}));
