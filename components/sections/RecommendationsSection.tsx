import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { RecommendationSection as RecommendationSectionType } from '../../types';

interface RecommendationsSectionProps {
  recommendations: RecommendationSectionType[];
  isEditing: boolean;
}

function formatAttribution(attribution: string) {
  const trimmed = attribution.trim();

  if (trimmed.startsWith('@')) {
    const handle = trimmed.slice(1);
    return (
      <a
        href={`https://x.com/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-docs-blue hover:underline"
      >
        {trimmed}
      </a>
    );
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return (
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="text-docs-blue hover:underline"
      >
        Link
      </a>
    );
  }

  return <span>{trimmed}</span>;
}

export default function RecommendationsSection({
  recommendations,
}: RecommendationsSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="section-title">Recommendation</h2>
      </div>

      {recommendations.map((section) => (
        <section key={section.id} className="mb-10 rounded-2xl border border-codex-border bg-codex-panel p-5">
          <h3
            id={`rec-section-${section.id}`}
            data-outline-id={`rec-section-${section.id}`}
            className="mb-4 scroll-mt-28 text-xl font-semibold text-codex-ink"
          >
            {section.title}
          </h3>

          <ul className="editor-content space-y-2">
            {section.items.map((item, idx) => (
              <li
                key={item.id || idx}
                className={`rounded-xl border px-3 py-2 leading-relaxed ${
                  item.kind === 'community'
                    ? 'border-codex-green/30 bg-codex-green/10 text-[17px] text-codex-ink'
                    : 'border-transparent bg-codex-panel-strong text-lg text-codex-ink'
                }`}
              >
                {item.kind === 'community' && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-codex-green">
                    <CheckCircle2 size={12} />
                    Accepted suggestion
                  </div>
                )}
                <div>
                  <span dangerouslySetInnerHTML={{ __html: item.html }} />
                  {item.attribution && (
                    <span className={`ml-1.5 text-sm ${item.kind === 'community' ? 'text-codex-green' : 'text-codex-muted'}`}>
                      → {formatAttribution(item.attribution)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

        </section>
      ))}
    </div>
  );
}
