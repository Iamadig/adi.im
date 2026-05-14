import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { normalizeAboutHtml } from '../utils/siteCopy';

dotenv.config({ path: '.env.local' });
dotenv.config();

type RichText = Array<{
  plain_text: string;
  href?: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
}>;

type SiteContentSnapshot = Awaited<ReturnType<typeof buildSnapshot>>;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    if (['http:', 'https:', 'mailto:'].includes(url.protocol)) {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function richTextToHtml(richText: RichText = []): string {
  return richText.map((entry) => {
    let text = escapeHtml(entry.plain_text);

    if (entry.annotations.bold) text = `<b>${text}</b>`;
    if (entry.annotations.italic) text = `<i>${text}</i>`;
    if (entry.annotations.strikethrough) text = `<s>${text}</s>`;
    if (entry.annotations.underline) text = `<u>${text}</u>`;
    if (entry.annotations.code) text = `<code>${text}</code>`;

    const safeUrl = sanitizeUrl(entry.href);
    if (safeUrl) {
      text = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    return text;
  }).join('');
}

async function processBlocks(blocks: any[], notion: Client): Promise<string> {
  let html = '';
  let currentListType: 'ul' | 'ol' | null = null;

  for (const block of blocks) {
    if (!('type' in block)) {
      continue;
    }

    const blockType = block.type;

    if (currentListType && blockType !== 'bulleted_list_item' && blockType !== 'numbered_list_item') {
      html += currentListType === 'ul' ? '</ul>' : '</ol>';
      currentListType = null;
    }

    if (!currentListType) {
      if (blockType === 'bulleted_list_item') {
        currentListType = 'ul';
        html += '<ul>';
      } else if (blockType === 'numbered_list_item') {
        currentListType = 'ol';
        html += '<ol>';
      }
    } else if (currentListType === 'ul' && blockType === 'numbered_list_item') {
      html += '</ul><ol>';
      currentListType = 'ol';
    } else if (currentListType === 'ol' && blockType === 'bulleted_list_item') {
      html += '</ol><ul>';
      currentListType = 'ul';
    }

    if (blockType === 'paragraph' && 'paragraph' in block) {
      const content = richTextToHtml(block.paragraph.rich_text as RichText);
      html += content ? `<p>${content}</p>` : '<p><br/></p>';
      continue;
    }

    if (blockType === 'heading_1' && 'heading_1' in block) {
      const content = richTextToHtml(block.heading_1.rich_text as RichText);
      if (content) html += `<h1>${content}</h1>`;
      continue;
    }

    if (blockType === 'heading_2' && 'heading_2' in block) {
      const content = richTextToHtml(block.heading_2.rich_text as RichText);
      if (content) html += `<h2>${content}</h2>`;
      continue;
    }

    if (blockType === 'heading_3' && 'heading_3' in block) {
      const content = richTextToHtml(block.heading_3.rich_text as RichText);
      if (content) html += `<h3>${content}</h3>`;
      continue;
    }

    if (blockType === 'quote' && 'quote' in block) {
      const content = richTextToHtml(block.quote.rich_text as RichText);
      if (content) html += `<blockquote>${content}</blockquote>`;
      continue;
    }

    if (blockType === 'callout' && 'callout' in block) {
      const content = richTextToHtml(block.callout.rich_text as RichText);
      const icon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : '💡';
      let childrenHtml = '';
      if (block.has_children) {
        childrenHtml = await processBlocks(await listAllBlockChildren(notion, block.id), notion);
      }

      html += `<div class="bg-gray-50 p-4 rounded-lg border border-gray-100 my-4 flex gap-3"><div class="text-xl select-none">${icon}</div><div class="flex-1 space-y-2">${content}${childrenHtml}</div></div>`;
      continue;
    }

    if (blockType === 'divider') {
      html += '<hr />';
      continue;
    }

    if (blockType === 'bulleted_list_item' && 'bulleted_list_item' in block) {
      const content = richTextToHtml(block.bulleted_list_item.rich_text as RichText);
      html += `<li>${content}`;
      if (block.has_children) {
        html += await processBlocks(await listAllBlockChildren(notion, block.id), notion);
      }
      html += '</li>';
      continue;
    }

    if (blockType === 'numbered_list_item' && 'numbered_list_item' in block) {
      const content = richTextToHtml(block.numbered_list_item.rich_text as RichText);
      html += `<li>${content}`;
      if (block.has_children) {
        html += await processBlocks(await listAllBlockChildren(notion, block.id), notion);
      }
      html += '</li>';
    }
  }

  if (currentListType) {
    html += currentListType === 'ul' ? '</ul>' : '</ol>';
  }

  return html;
}

async function listAllBlockChildren(notion: Client, blockId: string): Promise<any[]> {
  const results: any[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: startCursor,
    });
    results.push(...response.results);
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (startCursor);

  return results;
}

async function queryAllDatabase(notion: Client, params: Record<string, any>): Promise<any[]> {
  const results: any[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.databases.query({
      ...params,
      page_size: 100,
      start_cursor: startCursor,
    } as any);
    results.push(...response.results);
    startCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (startCursor);

  return results;
}

async function getPageHtml(notion: Client, pageId: string): Promise<string> {
  return processBlocks(await listAllBlockChildren(notion, pageId), notion);
}

function getPlainText(parts?: any[]): string {
  return (parts ?? []).map((entry) => entry.plain_text ?? '').join('').trim();
}

async function buildSnapshot() {
  const notion = new Client({ auth: process.env.NOTION_KEY });

  const aboutHtml = normalizeAboutHtml(await getPageHtml(notion, process.env.NOTION_ABOUT_PAGE!));

  const thoughtPages = await queryAllDatabase(notion, {
    database_id: process.env.NOTION_THOUGHTS_DB!,
    sorts: [{ property: 'Date', direction: 'descending' }],
  });

  const thoughts = await Promise.all(thoughtPages.map(async (page: any) => {
    return {
      id: page.id,
      title: page.properties.Title?.title?.[0]?.plain_text || page.properties.Name?.title?.[0]?.plain_text || 'Untitled',
      date: page.properties.Date?.date?.start || new Date().toISOString().slice(0, 10),
      tags: page.properties.Tags?.multi_select?.map((tag: any) => tag.name) || [],
      description: getPlainText(page.properties.Description?.rich_text),
      content: await processBlocks(await listAllBlockChildren(notion, page.id), notion),
    };
  }));

  const quotePages = await queryAllDatabase(notion, {
    database_id: process.env.NOTION_QUOTES_DB!,
  });

  const quotes = quotePages.map((page: any) => ({
    id: page.id,
    text: getPlainText(page.properties.Quote?.title),
    author: getPlainText(page.properties.Author?.rich_text) || 'Unknown',
  })).filter((quote) => quote.text);

  const recPages = await queryAllDatabase(notion, {
    database_id: process.env.NOTION_RECOMMENDATIONS_DB!,
    sorts: [
      { property: 'Category', direction: 'ascending' },
      { property: 'Sort Order', direction: 'ascending' },
      { property: 'Name', direction: 'ascending' },
    ],
    filter: {
      property: 'Status',
      status: {
        equals: 'Done',
      },
    },
  });

  const sectionLabels: Record<string, string> = {
    books: 'Books',
    tools: 'Tools',
    misc: 'Misc',
    articles: 'Articles',
    podcasts: 'Podcasts',
    newsletters: 'Newsletters',
    movies: 'Movies',
  };

  const sectionMap = new Map<string, { id: string; title: string; items: Array<{ id: string; html: string; attribution?: string | null; kind: string }> }>();

  for (const page of recPages) {
    const props = page.properties;
    const category = props.Category?.select?.name || 'misc';
    const title = props.Name?.title?.[0]?.plain_text || 'Untitled';
    const display = richTextToHtml(props.Display?.rich_text as RichText);
    const notes = richTextToHtml(props.Notes?.rich_text as RichText);
    const attribution = getPlainText(props.Attribution?.rich_text) || null;
    const url = sanitizeUrl(props.URL?.url || props['URL']?.url || props['userDefined:URL']?.url);
    const kind = props.Kind?.select?.name || 'curated';

    let html = display;
    if (!html) {
      const linkedTitle = url
        ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`
        : escapeHtml(title);
      html = notes ? `${linkedTitle}${title !== getPlainText(props.Notes?.rich_text) ? `, ${notes}` : ''}` : linkedTitle;
    }

    if (!sectionMap.has(category)) {
      sectionMap.set(category, {
        id: category,
        title: sectionLabels[category] || category,
        items: [],
      });
    }

    sectionMap.get(category)!.items.push({
      id: page.id,
      html,
      attribution,
      kind,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    aboutHtml,
    craftsHtml: '',
    thoughts,
    quotes,
    recommendations: Array.from(sectionMap.values()),
  };
}

async function applyCuratedContent(snapshot: SiteContentSnapshot): Promise<SiteContentSnapshot> {
  const overridePath = path.join(process.cwd(), 'content', 'site-content.curated.json');

  try {
    const rawOverride = await fs.readFile(overridePath, 'utf8');
    const override = JSON.parse(rawOverride) as Partial<SiteContentSnapshot>;

    return {
      ...snapshot,
      ...override,
      generatedAt: snapshot.generatedAt,
      craftsHtml: override.craftsHtml ?? snapshot.craftsHtml,
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return snapshot;
    }

    throw error;
  }
}

async function main() {
  const snapshot = await applyCuratedContent(await buildSnapshot());
  const payload = JSON.stringify(snapshot, null, 2) + '\n';
  const outputDirs = [
    path.join(process.cwd(), 'content'),
    path.join(process.cwd(), 'public'),
  ];

  for (const outputDir of outputDirs) {
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, 'site-content.generated.json');
    await fs.writeFile(outputPath, payload, 'utf8');
    console.log(`Wrote ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
