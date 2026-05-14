import type { SiteContentSnapshot } from '../types';

const SNAPSHOT_PATH = '/site-content.generated.json';

let cachedSnapshot: SiteContentSnapshot | null = null;

export async function getSiteContentSnapshot(forceRefresh = false): Promise<SiteContentSnapshot> {
  if (cachedSnapshot && !forceRefresh) {
    return cachedSnapshot;
  }

  const response = await fetch(`${SNAPSHOT_PATH}?t=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Unable to load page content');
  }

  cachedSnapshot = await response.json() as SiteContentSnapshot;
  return cachedSnapshot;
}
