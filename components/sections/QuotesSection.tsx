import React, { useState } from 'react';
import { Loader2, Send, Sparkles } from 'lucide-react';
import type { Quote } from '../../types';
import { AlertCircleIcon, DiceIcon } from '../Icons';

interface QuotesSectionProps {
  quotes: Quote[];
  isEditing: boolean;
  onAddQuote: (quote: Quote) => void;
}

const COOLDOWN_MS = 5000;

export default function QuotesSection({ quotes, isEditing, onAddQuote }: QuotesSectionProps) {
  const [moodInput, setMoodInput] = useState('');
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [lastGenTime, setLastGenTime] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);

  const handleGenerateQuote = async (isRandom = false) => {
    const now = Date.now();
    if (now - lastGenTime < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (now - lastGenTime)) / 1000);
      setWarning(`Please wait ${remaining}s before generating again.`);
      return;
    }

    if (!isRandom && !moodInput.trim()) {
      return;
    }

    try {
      setWarning(null);
      setIsGeneratingQuote(true);
      setLastGenTime(now);

      const { generateQuote } = await import('../../services/geminiService');
      const { text, author } = await generateQuote(isRandom ? undefined : moodInput);

      onAddQuote({
        id: Date.now().toString(),
        text,
        author,
      });

      if (!isRandom) {
        setMoodInput('');
      }
    } catch (error: any) {
      setWarning(error.message || 'Failed to generate quote.');
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  return (
    <div className="space-y-10">
      <div>
        <p className="section-kicker">quotes</p>
        <h2 className="section-title">Quotes</h2>
      </div>
      <div className="flex flex-col gap-2 mb-6 print:hidden">
        <div className="flex max-w-2xl items-center gap-3 rounded-2xl border border-codex-border bg-codex-panel p-2 pl-4 shadow-sm transition-all focus-within:border-codex-accent/45 focus-within:bg-codex-panel-strong">
          <Sparkles className="shrink-0 text-codex-accent" size={18} />
          <input
            type="text"
            value={moodInput}
            onChange={(event) => setMoodInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleGenerateQuote(false);
              }
            }}
            placeholder="Type a question..."
            className="h-full min-w-[150px] flex-1 border-none bg-transparent py-1 text-base text-codex-ink outline-none placeholder:text-codex-faint"
            disabled={isGeneratingQuote}
          />
          <div className="mx-1 h-6 w-px bg-codex-border"></div>
          <div className="flex items-center gap-1 pr-1">
            <button
              onClick={() => handleGenerateQuote(false)}
              disabled={isGeneratingQuote || !moodInput.trim()}
              className="rounded-full p-2 text-codex-accent transition-colors hover:bg-codex-accent/10 disabled:opacity-30"
              aria-label="Pull a quote"
            >
              <Send size={18} />
            </button>
            <button
              onClick={() => handleGenerateQuote(true)}
              disabled={isGeneratingQuote}
              className="codex-pill-button disabled:opacity-50"
            >
              <DiceIcon size={16} />
              Pull Note
            </button>
          </div>
        </div>
        <p className="ml-2 text-xs text-codex-muted">
          {isEditing ? 'Write a prompt and generate a note.' : 'Type a question, press Enter, or pull a note.'}
        </p>
        {warning && (
          <div className="ml-2 flex w-fit items-center gap-2 rounded-md border border-codex-warn/30 bg-codex-warn/10 px-3 py-1.5 text-xs text-codex-warn">
            <AlertCircleIcon size={14} />
            {warning}
          </div>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {quotes.map((quote) => (
          <div key={quote.id} className="group rounded-2xl border border-codex-border bg-codex-panel p-5 transition-all duration-200 hover:border-codex-accent/45 hover:bg-codex-panel-strong">
            <p className="text-xl leading-relaxed text-codex-ink md:text-2xl">"{quote.text}"</p>
            <p className="mt-4 font-mono text-sm text-codex-muted">- {quote.author}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
