import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';
import { getFromCache, setCache } from '../utils/cache';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Set Cache-Control headers for Vercel CDN
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600');

    const apiKey = process.env.NOTION_KEY;
    const pageId = process.env.NOTION_RECS_PAGE;

    if (!apiKey || !pageId) {
        // Return mock data if not configured
        return res.status(200).json({
            recommendations: [
                {
                    id: 'books',
                    title: 'Books',
                    items: [
                        'The Design of Everyday Things - Don Norman',
                        'Creative Selection - Ken Kocienda',
                        'Shape Up - Ryan Singer'
                    ]
                },
                {
                    id: 'tools',
                    title: 'Tools',
                    items: [
                        'Linear - Issue tracking',
                        'Raycast - Mac launcher',
                        'Figma - Interface design'
                    ]
                }
            ]
        });
    }

    // Check in-memory cache
    const cacheKey = `recs_${pageId}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        const notion = new Client({ auth: apiKey });

        // Fetch blocks from the page
        const response = await notion.blocks.children.list({
            block_id: pageId,
            page_size: 100,
        });

        // First, collect all toggle blocks
        const toggleBlocks = response.results.filter(
            (block): block is any =>
                'type' in block && block.type === 'toggle' && 'toggle' in block
        );

        // Fetch all toggle children in parallel for better performance
        const childrenPromises = toggleBlocks.map(block =>
            notion.blocks.children.list({
                block_id: block.id,
                page_size: 100
            })
        );

        const childrenResults = await Promise.all(childrenPromises);

        // Build recommendations from the results
        const recommendations: { id: string; title: string; items: string[] }[] = [];

        toggleBlocks.forEach((block, index) => {
            const title = block.toggle.rich_text.map((rt: any) => rt.plain_text).join('');
            const id = title.toLowerCase().replace(/\s+/g, '-');

            const currentSection = { id, title, items: [] as string[] };
            const children = childrenResults[index];

            for (const child of children.results) {
                if ('type' in child) {
                    let item = '';
                    if (child.type === 'bulleted_list_item' && 'bulleted_list_item' in child) {
                        item = richTextToHtml(child.bulleted_list_item.rich_text);
                    } else if (child.type === 'paragraph' && 'paragraph' in child) {
                        item = richTextToHtml(child.paragraph.rich_text);
                    }

                    if (item) {
                        currentSection.items.push(item);
                    }
                }
            }
            recommendations.push(currentSection);
        });

        const responseData = { recommendations };
        setCache(cacheKey, responseData);

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch recommendations from Notion' });
    }
}

function richTextToHtml(richText: any[], options: { skipLinks?: boolean } = {}): string {
    if (!richText || richText.length === 0) return '';

    return richText.map((rt) => {
        let text = rt.plain_text;

        // Escape HTML characters
        text = text.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const { annotations } = rt;
        if (annotations.bold) text = `<b>${text}</b>`;
        if (annotations.italic) text = `<i>${text}</i>`;
        if (annotations.strikethrough) text = `<s>${text}</s>`;
        if (annotations.underline) text = `<u>${text}</u>`;
        if (annotations.code) text = `<code>${text}</code>`;

        if (rt.href && !options.skipLinks) {
            text = `<a href="${rt.href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }

        return text;
    }).join('');
}
