import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3, BookOpen, Box, ClipboardCheck, GraduationCap, LayoutDashboard, Library, LogOut, Menu, Moon, Search,
  Settings, Shield, Sun, Target, X, FileText,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { useSpecies, useStructures } from '../store/content';
import { useViewer } from '../viewer/viewerStore';
import { normalize } from '../quiz/engine';
import { SYSTEM_BY_ID } from '../core/systems';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Panel principal', icon: LayoutDashboard, end: true },
  { to: '/explorador', label: 'Explorador 3D', icon: Box },
  { to: '/biblioteca', label: 'Biblioteca de sistemas', icon: Library },
  { to: '/fichas', label: 'Fichas anatómicas', icon: FileText },
  { to: '/aprendizaje', label: 'Aprendizaje', icon: BookOpen },
  { to: '/cuestionarios', label: 'Cuestionarios', icon: ClipboardCheck },
  { to: '/practica-3d', label: 'Evaluación práctica 3D', icon: Target },
  { to: '/resultados', label: 'Resultados y estadísticas', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil y configuración', icon: Settings },
];

export function Layout() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { theme, setTheme } = useSettings();
  const species = useSpecies();
  const focusMode = useViewer((s) => s.focusMode);
  const [open, setOpen] = useState(false);
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="flex h-screen overflow-hidden bg-ink-50 text-ink-800 dark:bg-ink-950 dark:text-ink-100">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-white">
        Saltar al contenido
      </a>
      {/* Barra lateral */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-200 bg-white transition-transform dark:border-ink-800 dark:bg-ink-900 lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          focusMode && 'lg:hidden',
        )}
        aria-label="Navegación principal"
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-ink-200 px-5 dark:border-ink-800">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow">
            <GraduationCap size={20} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-ink-900 dark:text-white">VetAnatomía 3D</div>
            <div className="text-[11px] text-ink-500">Laboratorio virtual</div>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800',
                )
              }
            >
              <Icon size={17} /> {label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              onClick={() => setOpen(false)}
              className={({ isActive }) => cx('mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800')}
            >
              <Shield size={17} /> Administración
            </NavLink>
          )}
        </nav>
        <div className="border-t border-ink-200 p-3 dark:border-ink-800">
          <div className="rounded-lg bg-ink-50 p-3 text-xs dark:bg-ink-850">
            <div className="font-medium text-ink-800 dark:text-ink-100">{species.name}</div>
            <div className="italic text-ink-500">{species.scientificName}</div>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cx('flex h-16 shrink-0 items-center gap-3 border-b border-ink-200 bg-white/80 px-4 backdrop-blur dark:border-ink-800 dark:bg-ink-900/80', focusMode && 'hidden')}>
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú"><Menu size={20} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
              aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
              title={theme === 'system' ? 'Tema del sistema' : isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-ink-800 dark:text-ink-100">{user?.name}</div>
              <div className="text-[11px] text-ink-500">{user?.role === 'admin' ? 'Administrador' : 'Estudiante'}</div>
            </div>
            <button onClick={logout} className="ml-2 rounded-lg p-2 text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800" aria-label="Cerrar sesión" title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main id="contenido" className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const structures = useStructures();
  const species = useSpecies();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const n = normalize(q);
    if (n.length < 2) return [];
    const st = structures
      .filter((s) => [s.name, s.latinName, s.commonName ?? '', s.region].some((x) => normalize(x).includes(n)))
      .slice(0, 8)
      .map((s) => ({ kind: 'structure' as const, id: s.id, title: s.name, sub: `${s.latinName} · ${SYSTEM_BY_ID[s.system].shortName}` }));
    const gl = species.glossary
      .filter((g) => normalize(g.term).includes(n))
      .slice(0, 4)
      .map((g) => ({ kind: 'term' as const, id: g.term, title: g.term, sub: 'Glosario' }));
    return [...st, ...gl];
  }, [q, structures, species]);

  const go = (r: (typeof results)[number]) => {
    setQ('');
    if (r.kind === 'structure') navigate(`/fichas/${r.id}`);
    else navigate(`/aprendizaje?tab=glosario&q=${encodeURIComponent(r.id)}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => { setQ(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
          if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          if (e.key === 'Enter' && results[active]) go(results[active]);
          if (e.key === 'Escape') setQ('');
        }}
        placeholder="Buscar estructuras o términos…  (Ctrl+K)"
        aria-label="Buscar estructuras anatómicas"
        className="w-full rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-ink-700 dark:bg-ink-850 dark:focus:bg-ink-850"
      />
      {results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl dark:border-ink-700 dark:bg-ink-850" role="listbox">
          {results.map((r, i) => (
            <li key={r.kind + r.id}>
              <button
                onMouseDown={(e) => { e.preventDefault(); go(r); }}
                className={cx('block w-full px-3 py-2 text-left text-sm', i === active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-ink-50 dark:hover:bg-ink-800')}
              >
                <div className="font-medium text-ink-900 dark:text-ink-50">{r.title}</div>
                <div className="text-xs text-ink-500">{r.sub}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
