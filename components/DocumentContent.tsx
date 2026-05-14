import React, { memo, useEffect } from 'react';
import { FormatState, OutlineItem, SectionType, ViewMode } from '../types';
import { useSiteContentState } from '../hooks/useSiteContentState';
import { LayeredTearableSite } from './LayeredTearableSite';
import { TearableThoughtsOverlay } from './TearableThoughtsOverlay';

interface DocumentContentProps {
  activeSection: SectionType;
  onFormatChange: (formats: FormatState) => void;
  onContentChange: () => void;
  statsRef: React.MutableRefObject<(() => { words: number, chars: number, charsNoSpace: number }) | null>;
  viewMode: ViewMode;
  onEditorActiveChange: (isActive: boolean) => void;
  onOutlineChange: (items: OutlineItem[]) => void;
  onActiveOutlineChange: (id: string | null) => void;
  onRevealSection?: (section: SectionType) => void;
}

const DocumentContentComponent: React.FC<DocumentContentProps> = ({
  activeSection,
  statsRef,
  onEditorActiveChange,
  onOutlineChange,
  onActiveOutlineChange,
  onRevealSection,
}) => {
  const {
    aboutHtml,
    recommendations,
    thoughts,
    quotes,
    generatedAt,
    isLoadingSnapshot,
    snapshotLoadError,
  } = useSiteContentState();

  useEffect(() => {
    statsRef.current = () => ({ words: 0, chars: 0, charsNoSpace: 0 });
  }, [statsRef]);

  useEffect(() => {
    onEditorActiveChange(false);
    onOutlineChange([]);
    onActiveOutlineChange(null);
  }, [onActiveOutlineChange, onEditorActiveChange, onOutlineChange]);

  if (isLoadingSnapshot) {
    return (
      <main className="layered-tearable-site layered-tearable-loading">
        <div className="layered-tearable-loading-card">Loading tearable profile...</div>
      </main>
    );
  }

  if (snapshotLoadError) {
    return (
      <main className="layered-tearable-site layered-tearable-loading">
        <div className="layered-tearable-loading-card">This page had trouble loading. Please refresh.</div>
      </main>
    );
  }

  const tearableContent = { aboutHtml, thoughts, quotes, recommendations, generatedAt };
  return (
    <>
      <LayeredTearableSite activeSection={activeSection} content={tearableContent} onRevealSection={onRevealSection} />
      <TearableThoughtsOverlay activeSection={activeSection} thoughts={thoughts} />
    </>
  );
};

export const DocumentContent = memo(DocumentContentComponent);
