import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import { useProgress } from './store/progress';
import { applyTheme, useSettings } from './store/settings';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import DashboardPage from './pages/DashboardPage';

// Carga diferida: el visor 3D y las páginas pesadas solo se descargan al usarse.
const ExplorerPage = lazy(() => import('./pages/ExplorerPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const LearnPage = lazy(() => import('./pages/LearnPage'));
const QuizzesPage = lazy(() => import('./pages/QuizzesPage'));
const Practice3DPage = lazy(() => import('./pages/QuizzesPage').then((m) => ({ default: m.Practice3DPage })));
const QuizRunnerPage = lazy(() => import('./pages/QuizRunnerPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.ResultsPage })));
const AttemptDetailPage = lazy(() => import('./pages/ResultsPage').then((m) => ({ default: m.AttemptDetailPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const StructuresListPage = lazy(() => import('./pages/StructuresPage').then((m) => ({ default: m.StructuresListPage })));
const StructureDetailPage = lazy(() => import('./pages/StructuresPage').then((m) => ({ default: m.StructureDetailPage })));
const ComparePage = lazy(() => import('./pages/StructuresPage').then((m) => ({ default: m.ComparePage })));

function Loading() {
  return <div className="grid h-full place-items-center p-10 text-sm text-ink-500">Cargando…</div>;
}

export default function App() {
  const user = useAuth((s) => s.user);
  const loadProgress = useProgress((s) => s.load);
  const theme = useSettings((s) => s.theme);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => loadProgress(user?.id ?? null), [user?.id, loadProgress]);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const fn = () => applyTheme('system');
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div className="grid min-h-screen place-items-center p-6 text-center">
          <div>
            <h1 className="text-xl font-semibold">Ocurrió un error inesperado</h1>
            <p className="mt-2 text-sm text-ink-500">{err.message}</p>
            <button onClick={reset} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm text-white">Reintentar</button>
          </div>
        </div>
      )}
    >
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          {!user ? (
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registro" element={<RegisterPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="explorador" element={<Suspense fallback={<Loading />}><ExplorerPage /></Suspense>} />
                <Route path="biblioteca" element={<Suspense fallback={<Loading />}><LibraryPage /></Suspense>} />
                <Route path="fichas" element={<Suspense fallback={<Loading />}><StructuresListPage /></Suspense>} />
                <Route path="fichas/comparar" element={<Suspense fallback={<Loading />}><ComparePage /></Suspense>} />
                <Route path="fichas/:id" element={<Suspense fallback={<Loading />}><StructureDetailPage /></Suspense>} />
                <Route path="aprendizaje" element={<Suspense fallback={<Loading />}><LearnPage /></Suspense>} />
                <Route path="cuestionarios" element={<Suspense fallback={<Loading />}><QuizzesPage /></Suspense>} />
                <Route path="practica-3d" element={<Suspense fallback={<Loading />}><Practice3DPage /></Suspense>} />
                <Route path="evaluacion" element={<Suspense fallback={<Loading />}><QuizRunnerPage /></Suspense>} />
                <Route path="resultados" element={<Suspense fallback={<Loading />}><ResultsPage /></Suspense>} />
                <Route path="resultados/:id" element={<Suspense fallback={<Loading />}><AttemptDetailPage /></Suspense>} />
                <Route path="perfil" element={<Suspense fallback={<Loading />}><ProfilePage /></Suspense>} />
                <Route path="admin" element={<Suspense fallback={<Loading />}><AdminPage /></Suspense>} />
                <Route path="login" element={<Navigate to="/" replace />} />
                <Route path="registro" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          )}
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
