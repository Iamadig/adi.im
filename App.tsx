import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { DocumentContent } from './components/DocumentContent';
import { FormatState, OutlineItem, SectionType } from './types';

const SECTION_ORDER = [
  SectionType.ABOUT,
  SectionType.THOUGHTS,
  SectionType.QUOTES,
  SectionType.RECOMMENDATIONS,
];

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionType>(SectionType.ABOUT);
  const updateStatsRef = useRef<() => { words: number, chars: number, charsNoSpace: number }>(null);

  const handleFormatChange = useCallback((_formats: FormatState) => {}, []);
  const handleContentChange = useCallback(() => {}, []);
  const handleOutlineChange = useCallback((_items: OutlineItem[]) => {}, []);
  const handleActiveOutlineChange = useCallback((_id: string | null) => {}, []);
  const goToSectionOffset = useCallback((offset: number) => {
    setActiveSection((current) => {
      const currentIndex = SECTION_ORDER.indexOf(current);
      const nextIndex = (currentIndex + offset + SECTION_ORDER.length) % SECTION_ORDER.length;
      return SECTION_ORDER[nextIndex];
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      event.preventDefault();
      goToSectionOffset(event.key === 'ArrowRight' ? 1 : -1);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToSectionOffset]);

  return (
    <div className="app-shell tearable-only-shell">
      <DocumentContent
        activeSection={activeSection}
        onFormatChange={handleFormatChange}
        onContentChange={handleContentChange}
        statsRef={updateStatsRef}
        viewMode="viewing"
        onEditorActiveChange={() => {}}
        onOutlineChange={handleOutlineChange}
        onActiveOutlineChange={handleActiveOutlineChange}
        onRevealSection={setActiveSection}
      />
      {activeSection !== SectionType.THOUGHTS ? <p className="tearable-page-hint">Tear the page to navigate. Press R to reset.</p> : null}
      {import.meta.env.PROD ? <Analytics /> : null}
    </div>
  );
};

export default App;
