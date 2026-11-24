import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Layers, Target, Box } from 'lucide-react';
import { useAuth } from '../store/auth';
import { Button, Field, inputCls } from '../components/ui';

function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="grid min-h-screen bg-ink-50 dark:bg-ink-950 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-900 to-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15"><GraduationCap /></div>
          <div>
            <div className="text-lg font-semibold">VetAnatomía 3D</div>
            <div className="text-sm text-brand-100/80">Laboratorio virtual de anatomía veterinaria</div>
          </div>
        </div>
        <div className="mt-auto max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">Explora, comprende y evalúa la anatomía animal en tres dimensiones.</h2>
          <ul className="space-y-3 text-sm text-brand-50/90">
            <li className="flex gap-3"><Box size={18} className="shrink-0" /> Modelo 3D por sistemas y capas, con cortes por planos.</li>
            <li className="flex gap-3"><Layers size={18} className="shrink-0" /> Fichas anatómicas con relaciones e importancia clínica.</li>
            <li className="flex gap-3"><Target size={18} className="shrink-0" /> Evaluaciones prácticas: identifica estructuras directamente en el modelo.</li>
          </ul>
        </div>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold text-ink-900 dark:text-white">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <p className="mt-8 text-xs leading-relaxed text-ink-500">
            Versión local: las cuentas y el progreso se guardan cifrados con PBKDF2 únicamente en este navegador. Consulte <code>server/README.md</code> para el despliegue con servidor.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const login = useAuth((s) => s.login);
  const loginGuest = useAuth((s) => s.loginGuest);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Iniciar sesión" subtitle="Accede a tu laboratorio de anatomía.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Correo electrónico">
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Contraseña">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-400"><span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />o<span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" /></div>
      <Button variant="secondary" className="w-full" onClick={() => { loginGuest(); navigate('/'); }}>Explorar como invitado</Button>
      <p className="mt-6 text-center text-sm text-ink-500">
        ¿No tienes cuenta? <Link to="/registro" className="font-medium text-brand-600 hover:underline dark:text-brand-300">Regístrate</Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', institution: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Crear cuenta de estudiante" subtitle="Registra tu progreso, cuestionarios y fichas favoritas.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nombre completo"><input autoComplete="name" value={form.name} onChange={set('name')} className={inputCls} /></Field>
        <Field label="Correo electrónico"><input type="email" autoComplete="email" value={form.email} onChange={set('email')} className={inputCls} /></Field>
        <Field label="Institución (opcional)"><input value={form.institution} onChange={set('institution')} className={inputCls} /></Field>
        <Field label="Contraseña" hint="Mínimo 8 caracteres, con al menos una letra y un número.">
          <input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} className={inputCls} />
        </Field>
        <Field label="Confirmar contraseña"><input type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} className={inputCls} /></Field>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creando cuenta…' : 'Crear cuenta'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500">
        ¿Ya tienes cuenta? <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-300">Inicia sesión</Link>
      </p>
    </AuthShell>
  );
}
