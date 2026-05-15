import fs from 'fs/promises';
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { DEFAULT_CANVAS_COPY } from '../utils/canvasCms';

dotenv.config({ path: '.env.local' });
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_KEY });

function richText(content: string) {
  return [{ type: 'text', text: { content } }];
}

function title(content: string) {
  return [{ type: 'text', text: { content } }];
}

function statusOptions() {
  return {
    options: [
      { name: 'Published', color: 'green' },
      { name: 'Draft', color: 'gray' },
      { name: 'Archived', color: 'red' },
    ],
  };
}

function fitFormula(textProp: string, maxProp: string) {
  return {
    expression: `if(length(prop("${textProp}")) <= prop("${maxProp}"), "OK", "Too long by " + format(length(prop("${textProp}")) - prop("${maxProp}")) + " chars")`,
  };
}

function stripHtml(value = '') {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractLinksFromHtml(html: string) {
  const seen = new Set<string>();
  return Array.from(html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/g)).map((match, index) => ({
    id: `about-link-${index + 1}`,
    label: stripHtml(match[2]),
    url: match[1],
    sortOrder: index + 1,
  })).filter((link) => {
    if (!link.label || !link.url || seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}

function firstAnchorHref(html = '') {
  return html.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? null;
}

function cleanRecommendationLabel(value: string) {
  const noUrl = value.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();
  const [beforeColon, ...afterColonParts] = noUrl.split(':');
  const afterColon = afterColonParts.join(':').trim();
  const colonCandidate = afterColon && beforeColon.length > 42 ? afterColon : beforeColon || noUrl;
  const withoutParenthetical = colonCandidate.replace(/\([^)]*(?:\)|$)/g, '').trim();
  const beforeDash = withoutParenthetical.split(/\s+-\s*/)[0] || withoutParenthetical;
  const beforeComma = beforeDash.split(/\s*,\s+/)[0] || beforeDash;
  return beforeComma.slice(0, 42).trim() || noUrl.slice(0, 42).trim();
}

async function loadSnapshot() {
  const raw = await fs.readFile('content/site-content.generated.json', 'utf8');
  return JSON.parse(raw);
}

async function createHubPage(parentPageId: string) {
  return notion.pages.create({
    parent: { page_id: parentPageId },
    properties: {
      title: title('Adi Website Canvas CMS'),
    },
    children: [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: richText('How to edit this website') },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: richText('This CMS feeds the tearable website canvas. Edit short public fields here instead of forcing old long-form page copy into fixed canvas slots.'),
        },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: richText('Status must be Published for content to appear publicly.') },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: richText('Use Max Characters, Character Count, and Canvas Fit to keep copy inside the canvas.') },
      },
      {
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: richText('Internal Notes are for you only and are not rendered on the public site.') },
      },
    ],
  } as any);
}

async function createCanvasCopyDb(pageId: string) {
  return notion.databases.create({
    parent: { page_id: pageId },
    title: title('Canvas Copy'),
    properties: {
      Name: { title: {} },
      Layer: { select: { options: ['About', 'Thoughts', 'Quotes', 'Recommendations'].map((name) => ({ name })) } },
      Slot: {
        select: {
          options: ['hero_line_1', 'hero_line_2', 'subtitle', 'profile_intro', 'profile_summary', 'footer'].map((name) => ({ name })),
        },
      },
      Text: { rich_text: {} },
      URL: { url: {} },
      'Sort Order': { number: {} },
      'Max Characters': { number: {} },
      'Character Count': { formula: { expression: 'length(prop("Text"))' } },
      'Canvas Fit': { formula: fitFormula('Text', 'Max Characters') },
      Status: { select: statusOptions() },
      'Internal Notes': { rich_text: {} },
    },
  } as any);
}

async function createThoughtsDb(pageId: string) {
  return notion.databases.create({
    parent: { page_id: pageId },
    title: title('Thoughts'),
    properties: {
      Title: { title: {} },
      Date: { date: {} },
      Description: { rich_text: {} },
      Tags: { multi_select: {} },
      'Sort Order': { number: {} },
      'Max Title Chars': { number: {} },
      'Title Count': { formula: { expression: 'length(prop("Title"))' } },
      'Title Fit': { formula: fitFormula('Title', 'Max Title Chars') },
      'Max Description Chars': { number: {} },
      'Description Count': { formula: { expression: 'length(prop("Description"))' } },
      'Description Fit': { formula: fitFormula('Description', 'Max Description Chars') },
      Status: { select: statusOptions() },
      'Internal Notes': { rich_text: {} },
    },
  } as any);
}

async function createQuotesDb(pageId: string) {
  return notion.databases.create({
    parent: { page_id: pageId },
    title: title('Quotes'),
    properties: {
      Quote: { title: {} },
      Author: { rich_text: {} },
      'Sort Order': { number: {} },
      'Max Characters': { number: {} },
      'Character Count': { formula: { expression: 'length(prop("Quote"))' } },
      'Canvas Fit': { formula: fitFormula('Quote', 'Max Characters') },
      Status: { select: statusOptions() },
      'Internal Notes': { rich_text: {} },
    },
  } as any);
}

async function createRecommendationsDb(pageId: string) {
  return notion.databases.create({
    parent: { page_id: pageId },
    title: title('Recommendations'),
    properties: {
      Name: { title: {} },
      Category: { select: { options: ['books', 'tools', 'misc', 'articles', 'podcasts', 'newsletters', 'movies'].map((name) => ({ name })) } },
      'Display Label': { rich_text: {} },
      'Short Descriptor': { rich_text: {} },
      URL: { url: {} },
      Attribution: { rich_text: {} },
      Kind: { select: { options: [{ name: 'curated', color: 'blue' }, { name: 'community', color: 'green' }] } },
      'Sort Order': { number: {} },
      'Max Label Chars': { number: {} },
      'Label Count': { formula: { expression: 'length(prop("Display Label"))' } },
      'Label Fit': { formula: fitFormula('Display Label', 'Max Label Chars') },
      'Max Descriptor Chars': { number: {} },
      'Descriptor Count': { formula: { expression: 'length(prop("Short Descriptor"))' } },
      'Descriptor Fit': { formula: fitFormula('Short Descriptor', 'Max Descriptor Chars') },
      Status: { select: statusOptions() },
      'Internal Notes': { rich_text: {} },
    },
  } as any);
}

async function createLinksDb(pageId: string) {
  return notion.databases.create({
    parent: { page_id: pageId },
    title: title('Profile Links'),
    properties: {
      Label: { title: {} },
      URL: { url: {} },
      'Sort Order': { number: {} },
      'Max Characters': { number: {} },
      'Character Count': { formula: { expression: 'length(prop("Label"))' } },
      'Canvas Fit': { formula: fitFormula('Label', 'Max Characters') },
      Status: { select: statusOptions() },
      'Internal Notes': { rich_text: {} },
    },
  } as any);
}

async function seedCanvasCopy(databaseId: string) {
  for (const item of DEFAULT_CANVAS_COPY) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: { title: title(`${item.layer} / ${item.slot}`) },
        Layer: { select: { name: item.layer === 'About Me' ? 'About' : item.layer } },
        Slot: { select: { name: item.slot } },
        Text: { rich_text: richText(item.text) },
        'Sort Order': { number: item.sortOrder },
        'Max Characters': { number: item.maxCharacters ?? 80 },
        Status: { select: { name: 'Published' } },
      },
    } as any);
  }
}

async function seedThoughts(databaseId: string, thoughts: any[]) {
  for (const [index, thought] of thoughts.entries()) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Title: { title: title(thought.title || 'Untitled') },
        Date: { date: { start: thought.date || new Date().toISOString().slice(0, 10) } },
        Description: { rich_text: richText(thought.description || '') },
        Tags: { multi_select: (thought.tags || []).map((name: string) => ({ name })) },
        'Sort Order': { number: index + 1 },
        'Max Title Chars': { number: 70 },
        'Max Description Chars': { number: 160 },
        Status: { select: { name: 'Published' } },
      },
      children: stripHtml(thought.content)
        ? [{ object: 'block', type: 'paragraph', paragraph: { rich_text: richText(stripHtml(thought.content).slice(0, 1900)) } }]
        : [],
    } as any);
  }
}

async function seedQuotes(databaseId: string, quotes: any[]) {
  for (const [index, quote] of quotes.entries()) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Quote: { title: title(quote.text || '') },
        Author: { rich_text: richText(quote.author || '') },
        'Sort Order': { number: index + 1 },
        'Max Characters': { number: 140 },
        Status: { select: { name: 'Published' } },
      },
    } as any);
  }
}

async function seedRecommendations(databaseId: string, sections: any[]) {
  let order = 1;
  for (const section of sections) {
    for (const item of section.items || []) {
      const raw = stripHtml(item.html);
      const label = cleanRecommendationLabel(item.label || raw);
      const url = item.url || firstAnchorHref(item.html);
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Name: { title: title(label) },
          Category: { select: { name: section.id || 'misc' } },
          'Display Label': { rich_text: richText(label) },
          'Short Descriptor': { rich_text: richText(item.description || '') },
          URL: url ? { url } : { url: null },
          Attribution: { rich_text: richText(item.attribution || '') },
          Kind: { select: { name: item.kind || 'curated' } },
          'Sort Order': { number: order++ },
          'Max Label Chars': { number: 32 },
          'Max Descriptor Chars': { number: 55 },
          Status: { select: { name: 'Published' } },
          'Internal Notes': { rich_text: raw && raw !== label ? richText(raw) : [] },
        },
      } as any);
    }
  }
}

async function seedLinks(databaseId: string, aboutHtml: string) {
  for (const link of extractLinksFromHtml(aboutHtml)) {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Label: { title: title(link.label) },
        URL: { url: link.url },
        'Sort Order': { number: link.sortOrder },
        'Max Characters': { number: 18 },
        Status: { select: { name: 'Published' } },
      },
    } as any);
  }
}

async function appendEnv(updates: Record<string, string>) {
  const path = '.env.local';
  const existing = await fs.readFile(path, 'utf8').catch(() => '');
  const updateKeys = new Set(Object.keys(updates));
  const kept = existing
    .split('\n')
    .filter((line) => !updateKeys.has(line.split('=')[0]))
    .join('\n')
    .trimEnd();
  const block = [
    '',
    '# Tearable canvas CMS',
    ...Object.entries(updates).map(([key, value]) => `${key}=${value}`),
    '',
  ].join('\n');
  await fs.writeFile(path, kept + block, 'utf8');
}

async function main() {
  if (!process.env.NOTION_KEY || !process.env.NOTION_ABOUT_PAGE) {
    throw new Error('NOTION_KEY and NOTION_ABOUT_PAGE are required.');
  }

  const snapshot = await loadSnapshot();
  const hub = await createHubPage(process.env.NOTION_CANVAS_CMS_PARENT_PAGE || process.env.NOTION_ABOUT_PAGE);
  const hubId = (hub as any).id;
  const [copyDb, linksDb, thoughtsDb, quotesDb, recommendationsDb] = await Promise.all([
    createCanvasCopyDb(hubId),
    createLinksDb(hubId),
    createThoughtsDb(hubId),
    createQuotesDb(hubId),
    createRecommendationsDb(hubId),
  ]);

  await seedCanvasCopy((copyDb as any).id);
  await seedLinks((linksDb as any).id, snapshot.aboutHtml || '');
  await seedThoughts((thoughtsDb as any).id, snapshot.thoughts || []);
  await seedQuotes((quotesDb as any).id, snapshot.quotes || []);
  await seedRecommendations((recommendationsDb as any).id, snapshot.recommendations || []);

  await appendEnv({
    NOTION_CANVAS_CMS_PAGE: hubId,
    NOTION_CANVAS_COPY_DB: (copyDb as any).id,
    NOTION_CANVAS_LINKS_DB: (linksDb as any).id,
    NOTION_CANVAS_THOUGHTS_DB: (thoughtsDb as any).id,
    NOTION_CANVAS_QUOTES_DB: (quotesDb as any).id,
    NOTION_CANVAS_RECOMMENDATIONS_DB: (recommendationsDb as any).id,
  });

  console.log(`Created Adi Website Canvas CMS: ${(hub as any).url}`);
  console.log('Updated .env.local with NOTION_CANVAS_* IDs.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
