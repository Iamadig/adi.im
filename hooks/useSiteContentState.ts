import { useEffect, useState } from 'react';
import { getSiteContentSnapshot } from '../services/notion';
import { normalizeAboutHtml } from '../utils/siteCopy';
import { Quote, RecommendationSection, SiteContentSnapshot, Thought } from '../types';

export function useSiteContentState() {
  const [aboutHtml, setAboutHtml] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationSection[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(true);
  const [snapshotLoadError, setSnapshotLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    getSiteContentSnapshot()
      .then((snapshot: SiteContentSnapshot) => {
        if (isCancelled) {
          return;
        }

        setAboutHtml(normalizeAboutHtml(snapshot.aboutHtml));
        setRecommendations(snapshot.recommendations);
        setThoughts(snapshot.thoughts);
        setQuotes(snapshot.quotes);
        setGeneratedAt(snapshot.generatedAt);
        setSnapshotLoadError(null);
      })
      .catch((error: Error) => {
        if (!isCancelled) {
          setSnapshotLoadError(error.message);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingSnapshot(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    aboutHtml,
    setAboutHtml,
    recommendations,
    setRecommendations,
    thoughts,
    setThoughts,
    quotes,
    setQuotes,
    generatedAt,
    isLoadingSnapshot,
    snapshotLoadError,
  };
}
