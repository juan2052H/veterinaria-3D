import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import type { AnatomicalStructure } from '../core/types';
import { BIBLIOGRAPHY } from '../core/bibliography';
import { useStructureMap } from '../store/content';
import { Badge, LevelBadge, SystemBadge } from './ui';

/** Contenido de una ficha anatómica, reutilizado en el visor y en la página de fichas. */
export function StructureInfo({ s, compact = false, onRelatedClick }: { s: AnatomicalStructure; compact?: boolean; onRelatedClick?: (id: string) => void }) {
  const byId = useStructureMap();
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SystemBadge id={s.system} />
          <LevelBadge level={s.level} />
          {s.bilateral && <Badge>Par (izq./der.)</Badge>}
          {s.sex && <Badge>{s.sex === 'male' ? 'Macho' : 'Hembra'}</Badge>}
          <Badge color={s.reviewStatus === 'revisado' ? '#22c55e' : '#f59e0b'}>
            {s.reviewStatus === 'revisado' ? 'Revisado por docente' : 'Pendiente de revisión docente'}
          </Badge>
        </div>
        <dl className="mt-3 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-ink-500">Nombre científico (NAV)</dt><dd className="font-medium italic">{s.latinName}</dd>
          <dt className="text-ink-500">Nombre anatómico</dt><dd className="font-medium">{s.name}</dd>
          {s.commonName && (<><dt className="text-ink-500">Nombre común</dt><dd>{s.commonName}</dd></>)}
          <dt className="text-ink-500">Clasificación</dt><dd>{s.classification}</dd>
          <dt className="text-ink-500">Región</dt><dd>{s.region}</dd>
        </dl>
      </div>
      <Section title="Descripción">{s.description}</Section>
      <Section title="Localización">{s.location}</Section>
      <Section title="Función">{s.function}</Section>
      <Section title="Características principales">
        <ul className="list-disc space-y-1 pl-5">{s.features.map((f) => <li key={f}>{f}</li>)}</ul>
      </Section>
      <Section title="Relaciones anatómicas">
        <ul className="list-disc space-y-1 pl-5">{s.relations.map((f) => <li key={f}>{f}</li>)}</ul>
        {!!s.relatedIds?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {s.relatedIds.map((id) => {
              const r = byId.get(id);
              if (!r) return null;
              return onRelatedClick ? (
                <button key={id} onClick={() => onRelatedClick(id)} className="rounded-full border border-ink-200 px-2 py-0.5 text-xs hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:hover:text-brand-300">
                  {r.name}
                </button>
              ) : (
                <Link key={id} to={`/fichas/${id}`} className="rounded-full border border-ink-200 px-2 py-0.5 text-xs hover:border-brand-400 hover:text-brand-600 dark:border-ink-700 dark:hover:text-brand-300">
                  {r.name}
                </Link>
              );
            })}
          </div>
        )}
      </Section>
      <Section title="Importancia clínica veterinaria">
        <p className="rounded-lg border-l-4 border-brand-500 bg-brand-50/60 p-3 dark:bg-brand-500/10">{s.clinical}</p>
      </Section>
      {!compact && (
        <Section title="Imagen de referencia">
          {s.imageUrl ? (
            <img src={s.imageUrl} alt={`Imagen de referencia: ${s.name}`} className="max-h-72 rounded-lg border border-ink-200 dark:border-ink-700" />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-ink-300 p-4 text-xs text-ink-500 dark:border-ink-700">
              <ImageOff size={16} /> Sin imagen de referencia. El administrador puede añadir una URL de imagen con licencia adecuada.
            </div>
          )}
        </Section>
      )}
      <Section title="Referencias bibliográficas">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-ink-600 dark:text-ink-400">
          {s.references.map((r) => <li key={r}>{BIBLIOGRAPHY[r] ?? r}</li>)}
        </ol>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">{title}</h3>
      <div className="text-ink-700 dark:text-ink-200">{children}</div>
    </section>
  );
}
