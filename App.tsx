import React, { useCallback, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { DocumentContent } from './components/DocumentContent';
import { FormatState, OutlineItem, SectionType } from './types';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionType>(SectionType.ABOUT);
  const updateStatsRef = useRef<() => { words: number, chars: number, charsNoSpace: number }>(null);

  const handleFormatChange = useCallback((_formats: FormatState) => {}, []);
  const handleContentChange = useCallback(() => {}, []);
  const handleOutlineChange = useCallback((_items: OutlineItem[]) => {}, []);
  const handleActiveOutlineChange = useCallback((_id: string | null) => {}, []);

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
      {import.meta.env.PROD ? <Analytics /> : null}
    </div>
  );
};

export default App;
