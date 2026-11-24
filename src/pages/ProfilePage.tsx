import { useState, type FormEvent } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useSettings, type Theme } from '../store/settings';
import { useProgress } from '../store/progress';
import { downloadBlob } from '../services/storage';
import { Button, Card, Field, PageHeader, Tabs, inputCls } from '../components/ui';
import type { Level } from '../core/types';

export default function ProfilePage() {
  const user = useAuth((s) => s.user)!;
  const updateProfile = useAuth((s) => s.updateProfile);
  const changePassword = useAuth((s) => s.changePassword);
  const settings = useSettings();
  const data = useProgress((s) => s.data);
  const reset = useProgress((s) => s.reset);
  const [form, setForm] = useState({ name: user.name, institution: user.institution ?? '', semester: user.semester ?? '' });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return setMsg({ ok: false, text: 'El nombre es obligatorio.' });
    updateProfile({ name: form.name.trim(), institution: form.institution.trim(), semester: form.semester.trim() });
    setMsg({ ok: true, text: 'Perfil actualizado.' });
  };
  const savePw = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      setMsg({ ok: true, text: 'Contraseña actualizada.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title="Perfil y configuración" subtitle={`${user.email} · ${user.role === 'admin' ? 'Administrador' : 'Estudiante'}`} />
      {msg && <p role="status" className={`mb-4 rounded-lg p-3 text-sm ${msg.ok ? 'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300'}`}>{msg.text}</p>}
      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Datos personales">
          <form onSubmit={saveProfile} className="space-y-3">
            <Field label="Nombre completo"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Institución"><input value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} className={inputCls} /></Field>
            <Field label="Semestre"><input value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} className={inputCls} /></Field>
            <Button type="submit">Guardar</Button>
          </form>
        </Card>
        <Card title="Preferencias">
          <div className="space-y-5">
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">Tema</div>
              <Tabs<Theme> value={settings.theme} onChange={settings.setTheme} tabs={[{ id: 'light', label: 'Claro' }, { id: 'dark', label: 'Oscuro' }, { id: 'system', label: 'Sistema' }]} />
            </div>
            <div>
              <div className="mb-1.5 text-xs font-medium text-ink-600 dark:text-ink-300">Nivel de estudio predeterminado</div>
              <Tabs<Level | 'todos'> value={settings.level} onChange={settings.setLevel} tabs={[{ id: 'todos', label: 'Todos' }, { id: 'basico', label: 'Básico' }, { id: 'intermedio', label: 'Intermedio' }, { id: 'avanzado', label: 'Avanzado' }]} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.reducedMotion} onChange={(e) => settings.setReducedMotion(e.target.checked)} className="accent-brand-500" />
              Reducir animaciones de la interfaz
            </label>
          </div>
        </Card>
        {user.id !== 'guest' && (
          <Card title="Cambiar contraseña">
            <form onSubmit={savePw} className="space-y-3">
              <Field label="Contraseña actual"><input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className={inputCls} /></Field>
              <Field label="Nueva contraseña" hint="Mínimo 8 caracteres, con letras y números."><input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className={inputCls} /></Field>
              <Button type="submit">Actualizar contraseña</Button>
            </form>
          </Card>
        )}
        <Card title="Mis datos">
          <p className="text-sm text-ink-500">Descarga una copia de tu progreso o reinícialo.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadBlob('vetanatomia-progreso.json', JSON.stringify({ user, progress: data }, null, 2), 'application/json')}><Download size={16} /> Exportar progreso</Button>
            <Button variant="danger" onClick={() => { if (confirm('¿Borrar todo tu progreso? Esta acción no se puede deshacer.')) { reset(); setMsg({ ok: true, text: 'Progreso reiniciado.' }); } }}><Trash2 size={16} /> Reiniciar progreso</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
