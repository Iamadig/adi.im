import React from 'react';
import { ArrowLeft } from 'lucide-react';
import type { Thought } from '../../types';

interface ThoughtsSectionProps {
  thoughts: Thought[];
  selectedThought: Thought | null;
  isEditing: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  titleRef: React.RefObject<HTMLHeadingElement | null>;
  stripHtml: (value: string) => string;
  onThoughtClick: (thought: Thought) => void;
  onBack: () => void;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  onCheckFormats: () => void;
  onLinkClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  readingTimeMinutes: number | null;
  readingProgress: number;
}

export default function ThoughtsSection({
  thoughts,
  selectedThought,
  isEditing,
  editorRef,
  titleRef,
  stripHtml,
  onThoughtClick,
  onBack,
  onInput,
  onCheckFormats,
  onLinkClick,
  readingTimeMinutes,
  readingProgress,
}: ThoughtsSectionProps) {
  if (selectedThought) {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
        <div className="sticky top-0 z-20 -mx-5 border-b border-codex-border bg-codex-panel-strong/95 px-5 pt-2 pb-3 backdrop-blur md:-mx-8 md:px-8">
          <div className="h-1 w-full overflow-hidden rounded-full bg-codex-line">
            <div
              className="h-full rounded-full bg-codex-accent transition-[width] duration-200"
              style={{ width: `${readingProgress * 100}%` }}
            />
          </div>
        </div>

        <div className="-mt-3 flex items-center gap-2 border-b border-codex-border pb-3">
          <button onClick={onBack} className="codex-icon-button -ml-2">
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm font-medium text-codex-muted">Back to Work</span>
        </div>

        <article className="thought-article relative">
          <div className="mb-6 border-b border-codex-border pb-6">
            <h1
              ref={titleRef}
              id="thought-hero"
              data-outline-id="thought-hero"
              className="max-w-4xl text-[2rem] font-semibold leading-[1.12] text-codex-ink md:text-[3rem]"
            >
              {selectedThought.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[12px] text-codex-faint" contentEditable={false}>
              <span>{selectedThought.date}</span>
              {readingTimeMinutes && (
                <>
                  <span>/</span>
                  <span>{readingTimeMinutes} min read</span>
                </>
              )}
              <span>/</span>
              <span className="text-codex-accent">
                {Math.round(readingProgress * 100)}% through
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedThought.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-codex-border bg-codex-panel px-2 py-1 text-[11px] font-medium text-codex-muted">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div
            ref={editorRef}
            className={`editor-content thought-prose codex-prose min-h-[300px] focus:outline-none ${isEditing ? "empty:before:content-['Start_typing...'] empty:before:text-codex-faint" : ""}`}
            contentEditable={isEditing}
            suppressContentEditableWarning={true}
            onInput={onInput}
            onKeyUp={onCheckFormats}
            onMouseUp={onCheckFormats}
            onClick={onLinkClick}
          />
        </article>
      </div>
    );
  }

    return (
    <div className="space-y-8">
      <div>
        <p className="section-kicker">work index</p>
        <h2 className="section-title">Work</h2>
      </div>
      <div className="grid gap-3">
        {thoughts.map((thought) => (
          <button
            key={thought.id}
            type="button"
            className="group w-full cursor-pointer rounded-2xl border border-codex-border bg-codex-panel px-4 py-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-codex-accent/45 hover:bg-codex-panel-strong hover:shadow-xl hover:shadow-black/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-codex-accent"
            onClick={() => onThoughtClick(thought)}
          >
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-[1.15rem] font-semibold text-codex-ink transition-colors group-hover:text-codex-accent">
                {thought.title}
              </h3>
              <span className="font-mono text-[12px] text-codex-faint">{thought.date}</span>
            </div>
            <p className="line-clamp-3 text-[15px] leading-relaxed text-codex-muted">
              {thought.description || stripHtml(thought.content)}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
