import { Link } from 'react-router-dom';
import { Box } from 'lucide-react';
import { SYSTEMS } from '../core/systems';
import { useStructures } from '../store/content';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { Card, LevelBadge, PageHeader, ProgressBar, Tabs } from '../components/ui';
import type { Level } from '../core/types';

export default function LibraryPage() {
  const structures = useStructures();
  const viewed = useProgress((s) => s.data.viewed);
  const level = useSettings((s) => s.level);
  const setLevel = useSettings((s) => s.setLevel);

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title="Biblioteca de sistemas anatómicos"
        subtitle="Explicaciones por sistema y acceso directo a sus estructuras y a su visualización 3D."
        actions={
          <Tabs<Level | 'todos'>
            value={level}
            onChange={setLevel}
            tabs={[{ id: 'todos', label: 'Todos' }, { id: 'basico', label: 'Básico' }, { id: 'intermedio', label: 'Intermedio' }, { id: 'avanzado', label: 'Avanzado' }]}
          />
        }
      />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {SYSTEMS.map((sys) => {
          const list = structures.filter((s) => s.system === sys.id && (level === 'todos' || s.level === level));
          const all = structures.filter((s) => s.system === sys.id);
          const seen = all.filter((s) => viewed[s.id]).length;
          return (
            <Card key={sys.id} className="flex flex-col">
              <div className="mb-3 flex items-center gap-3">
                <span className="h-9 w-1.5 rounded-full" style={{ background: sys.color }} />
                <div>
                  <h2 className="font-semibold text-ink-900 dark:text-white">{sys.name}</h2>
                  <p className="text-xs text-ink-500">{all.length} estructuras · {seen} consultadas</p>
                </div>
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-300">{sys.description}</p>
              <ProgressBar value={(seen / Math.max(all.length, 1)) * 100} color={sys.color} className="mt-3" />
              <ul className="mt-4 flex-1 space-y-1 text-sm">
                {list.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <Link to={`/fichas/${s.id}`} className="truncate hover:text-brand-600 hover:underline dark:hover:text-brand-300">
                      {s.name}
                    </Link>
                    <LevelBadge level={s.level} />
                  </li>
                ))}
                {list.length === 0 && <li className="text-xs text-ink-500">Sin estructuras en este nivel.</li>}
              </ul>
              <Link to={`/explorador?systems=${sys.id}${sys.id !== 'oseo' ? ',oseo' : ''}`}
                className="mt-4 inline-flex items-center gap-2 self-start rounded-lg bg-ink-100 px-3 py-1.5 text-xs font-medium hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700">
                <Box size={14} /> Ver en 3D
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
