import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Award, Bookmark, Box, Clock, ClipboardCheck, Eye, Star, Target, Trophy } from 'lucide-react';
import { useAuth } from '../store/auth';
import { useProgress, today } from '../store/progress';
import { useSettings } from '../store/settings';
import { useSpecies, useStructureMap } from '../store/content';
import { SPECIES } from '../core/registry';
import { SYSTEMS } from '../core/systems';
import { computeAchievements, overallProgress } from '../lib/achievements';
import { Card, PageHeader, ProgressBar, Stat, Button, Badge, cx, formatDuration } from '../components/ui';

const DAILY_GOAL_MIN = 20;

export default function DashboardPage() {
  const user = useAuth((s) => s.user)!;
  const data = useProgress((s) => s.data);
  const species = useSpecies();
  const setSpecies = useSettings((s) => s.setSpecies);
  const byId = useStructureMap();
  const navigate = useNavigate();

  const prog = overallProgress(data, species.structures.map((s) => s.id), species.guidedPath, SYSTEMS.length);
  const achievements = computeAchievements(data, species.structures.length, species.guidedPath);
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const nextStep = species.guidedPath.find((g) => !data.guidedDone.includes(g.id));
  const todayMin = (data.studyByDay[today()] ?? 0) / 60;
  const weekQuizzes = data.attempts.filter((a) => a.date > Date.now() - 7 * 864e5).length;
  const avg = data.attempts.length ? data.attempts.reduce((a, x) => a + x.scorePct, 0) / data.attempts.length : 0;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <PageHeader
        title={`Hola, ${user.name.split(' ')[0]}`}
        subtitle="Continúa tu estudio de anatomía veterinaria."
        actions={<Button onClick={() => navigate('/explorador')}><Box size={16} /> Abrir explorador 3D</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Progreso general" value={`${Math.round(prog.total)} %`} icon={<Trophy size={16} />} hint={<ProgressBar value={prog.total} className="mt-2" />} />
        <Stat label="Tiempo de estudio" value={formatDuration(data.studySeconds)} icon={<Clock size={16} />} hint={`${Object.keys(data.studyByDay).length} días con actividad`} />
        <Stat label="Estructuras consultadas" value={`${Object.keys(data.viewed).length} / ${species.structures.length}`} icon={<Eye size={16} />} hint={`${Math.round(prog.coverage)} % de cobertura`} />
        <Stat label="Cuestionarios" value={data.attempts.length} icon={<ClipboardCheck size={16} />} hint={data.attempts.length ? `Promedio ${avg.toFixed(1)} %` : 'Aún sin evaluaciones'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Especies">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {SPECIES.map((sp) => (
                <button
                  key={sp.id}
                  disabled={!sp.available}
                  onClick={() => { setSpecies(sp.id); navigate('/explorador'); }}
                  className={cx(
                    'rounded-xl border p-4 text-left transition',
                    sp.available
                      ? sp.id === species.id ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/10' : 'border-ink-200 hover:border-brand-400 dark:border-ink-700'
                      : 'cursor-not-allowed border-dashed border-ink-200 opacity-60 dark:border-ink-800',
                  )}
                >
                  <div className="font-medium text-ink-900 dark:text-white">{sp.name}</div>
                  <div className="text-xs italic text-ink-500">{sp.scientificName}</div>
                  <div className="mt-2">{sp.available ? <Badge color="#08c4a6">Disponible</Badge> : <Badge>Próximamente</Badge>}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Estudio guiado" action={<Link to="/aprendizaje" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Ver ruta completa</Link>}>
            <ProgressBar value={prog.guided} />
            <p className="mt-2 text-xs text-ink-500">{data.guidedDone.length} de {species.guidedPath.length} pasos completados</p>
            {nextStep ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-50 p-4 dark:bg-ink-850">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-ink-500">Siguiente paso</div>
                  <div className="font-medium text-ink-900 dark:text-white">{nextStep.title}</div>
                  <div className="text-xs text-ink-500">{nextStep.structureIds.length} estructuras</div>
                </div>
                <Button variant="secondary" onClick={() => navigate(`/aprendizaje?paso=${nextStep.id}`)}>Continuar <ArrowRight size={15} /></Button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-brand-700 dark:text-brand-300">¡Completaste toda la ruta de estudio guiado!</p>
            )}
          </Card>

          <Card title="Evaluaciones recientes" action={<Link to="/resultados" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Ver historial</Link>}>
            {data.attempts.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-500">Todavía no has realizado evaluaciones.</p>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => navigate('/cuestionarios')}><ClipboardCheck size={15} /> Cuestionario</Button>
                  <Button variant="secondary" onClick={() => navigate('/practica-3d')}><Target size={15} /> Práctica 3D</Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                {data.attempts.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <div className="font-medium text-ink-800 dark:text-ink-100">{a.title}</div>
                      <div className="text-xs text-ink-500">{new Date(a.date).toLocaleString('es-CO')} · {a.correct}/{a.total} correctas</div>
                    </div>
                    <span className={cx('rounded-lg px-2 py-1 text-sm font-semibold tabular-nums', a.grade >= 3 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {a.grade.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Objetivos">
            <div className="space-y-4 text-sm">
              <div>
                <div className="mb-1 flex justify-between"><span>Estudio diario</span><span className="tabular-nums text-ink-500">{Math.floor(todayMin)} / {DAILY_GOAL_MIN} min</span></div>
                <ProgressBar value={(todayMin / DAILY_GOAL_MIN) * 100} />
              </div>
              <div>
                <div className="mb-1 flex justify-between"><span>Cuestionarios esta semana</span><span className="tabular-nums text-ink-500">{weekQuizzes} / 3</span></div>
                <ProgressBar value={(weekQuizzes / 3) * 100} color="#f59e0b" />
              </div>
            </div>
          </Card>

          <Card title={`Logros (${unlocked}/${achievements.length})`} action={<Link to="/resultados" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Ver todos</Link>}>
            <ul className="space-y-2">
              {achievements.slice(0, 6).map((a) => (
                <li key={a.id} className={cx('flex items-center gap-3 text-sm', !a.unlocked && 'opacity-50')}>
                  <Award size={18} className={a.unlocked ? 'text-amber-500' : 'text-ink-400'} />
                  <div className="flex-1">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-ink-500">{a.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Favoritos y marcadores">
            {data.favorites.length + data.bookmarks.length === 0 ? (
              <p className="text-sm text-ink-500">Marca estructuras con <Star size={13} className="inline" /> o <Bookmark size={13} className="inline" /> desde el explorador para encontrarlas aquí.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {data.favorites.map((id) => byId.get(id) && (
                    <Link key={id} to={`/explorador?s=${id}`} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800 hover:underline dark:bg-amber-500/10 dark:text-amber-300">
                      <Star size={11} className="fill-current" /> {byId.get(id)!.name}
                    </Link>
                  ))}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {data.bookmarks.slice(0, 5).map((b) => byId.get(b.structureId) && (
                    <li key={b.id}>
                      <Link to={`/explorador?s=${b.structureId}`} className="font-medium hover:underline">{byId.get(b.structureId)!.name}</Link>
                      {b.note && <p className="text-xs text-ink-500">{b.note}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
