import React, { lazy, Suspense } from 'react';
import { SectionType, ViewMode } from '../types';

const TearableProfileCanvas = lazy(() => import('./TearableProfileCanvas'));

const sectionMeta: Record<SectionType, {
  title: string;
  heroLines: [string, string];
  subtitle: string;
}> = {
  [SectionType.ABOUT]: {
    title: 'Profile',
    heroLines: ['hi! I am', 'Adi'],
    subtitle: 'AI products, agent infra, and fun internet experiments.',
  },
  [SectionType.THOUGHTS]: {
    title: 'Work',
    heroLines: ['WORK', 'LOG'],
    subtitle: 'Products, agents, and experiments worth opening.',
  },
  [SectionType.QUOTES]: {
    title: 'Quotes',
    heroLines: ['QUOTES', ''],
    subtitle: '',
  },
  [SectionType.RECOMMENDATIONS]: {
    title: 'Recommendation',
    heroLines: ['RECOMMENDATION', ''],
    subtitle: 'Books, tools, and references I recommend.',
  },
};

const nextSectionBySection: Record<SectionType, SectionType> = {
  [SectionType.ABOUT]: SectionType.THOUGHTS,
  [SectionType.THOUGHTS]: SectionType.QUOTES,
  [SectionType.QUOTES]: SectionType.RECOMMENDATIONS,
  [SectionType.RECOMMENDATIONS]: SectionType.ABOUT,
};

interface CodexRunFrameProps {
  activeSection: SectionType;
  currentWordCount: number;
  generatedAt: string | null;
  viewMode: ViewMode;
  chatContext: string;
  children: React.ReactNode;
  onRevealSection?: (section: SectionType) => void;
}

export function CodexRunFrame({
  activeSection,
  currentWordCount,
  generatedAt,
  children,
  onRevealSection,
}: CodexRunFrameProps) {
  const meta = sectionMeta[activeSection];
  const next = nextSectionBySection[activeSection];
  const syncedLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : 'recently';

  return (
    <main className="tearable-site">
      <section className="tearable-sheet-wrap" aria-label={`${meta.title} tearable sheet`}>
        <article className="tearable-content-sheet">
          <header className="tearable-sheet-hero">
            <div>
              <h1 className={activeSection === SectionType.THOUGHTS ? 'tearable-hero-wide' : undefined}>
                {meta.heroLines.map((line) => <span key={line}>{line}</span>)}
              </h1>
            </div>
            <p className="tearable-subtitle">{meta.subtitle}</p>
            <div className="tearable-sheet-meta">
              <span>{currentWordCount} words</span>
              <span>updated {syncedLabel}</span>
              <span>tear to {sectionMeta[next].title}</span>
              <a href="mailto:adi@watercoolerdev.com">contact adi</a>
            </div>
          </header>

          <div className="tearable-sheet-body">
            {children}
          </div>
        </article>

        <Suspense fallback={null}>
          <TearableProfileCanvas
            activeSection={activeSection}
            onRevealSection={(section) => onRevealSection?.(section)}
          />
        </Suspense>
      </section>
    </main>
  );
}
