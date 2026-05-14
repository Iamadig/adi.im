import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionType, Thought } from '../types';

interface TearableThoughtsOverlayProps {
  activeSection: SectionType;
  thoughts: Thought[];
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function TearableThoughtsOverlay({ activeSection, thoughts }: TearableThoughtsOverlayProps) {
  const visible = activeSection === SectionType.THOUGHTS && thoughts.length > 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const readerRef = useRef<HTMLElement | null>(null);
  const selected = useMemo(
    () => thoughts.find((thought) => thought.id === selectedId) ?? thoughts[0] ?? null,
    [selectedId, thoughts],
  );

  useEffect(() => {
    if (!thoughts.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !thoughts.some((thought) => thought.id === selectedId)) {
      setSelectedId(thoughts[0].id);
    }
  }, [selectedId, thoughts]);

  useEffect(() => {
    readerRef.current?.scrollTo({ top: 0 });
  }, [selected?.id]);

  if (!visible || !selected) return null;

  return (
    <section
      className="tearable-thoughts-overlay"
      aria-label="Scrollable thoughts reader"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <aside className="tearable-thoughts-index" aria-label="Thought articles">
        <h2>Articles</h2>
        <div className="tearable-thoughts-list">
          {thoughts.map((thought) => (
            <button
              key={thought.id}
              type="button"
              className={thought.id === selected.id ? 'is-active' : undefined}
              onClick={() => setSelectedId(thought.id)}
            >
              <span>{thought.title}</span>
              <small>{formatDate(thought.date)}</small>
            </button>
          ))}
        </div>
      </aside>

      <article ref={readerRef} className="tearable-thoughts-reader">
        <header>
          <h1>{selected.title}</h1>
          <div className="tearable-thoughts-meta">
            <span>{formatDate(selected.date)}</span>
            {selected.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          {selected.description ? <p className="tearable-thoughts-description">{selected.description}</p> : null}
        </header>
        <div
          className="tearable-thoughts-prose"
          dangerouslySetInnerHTML={{ __html: selected.content || `<p>${stripHtml(selected.description ?? '')}</p>` }}
        />
      </article>
    </section>
  );
}
