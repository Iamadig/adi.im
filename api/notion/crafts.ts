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
    const databaseId = process.env.NOTION_CRAFTS_DB;

    if (!apiKey || !databaseId) {
        return res.status(200).json({
            crafts: [
                { id: '1', title: 'Personal Website', url: 'https://github.com/adi/personal-site', domain: 'github.com' },
                { id: '2', title: 'Design System', url: 'https://www.figma.com', domain: 'figma.com' },
            ]
        });
    }

    // Check in-memory cache
    const cacheKey = `crafts_${databaseId}`;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        const notion = new Client({ auth: apiKey });

        // Fetch blocks from the page
        const response = await notion.blocks.children.list({
            block_id: databaseId,
            page_size: 100,
        });

        const crafts: { id: string; title: string; url: string; domain: string }[] = [];

        for (const block of response.results) {
            if (!('type' in block)) continue;

            let title = '';
            let url = '';

            if (block.type === 'paragraph' && 'paragraph' in block) {
                const richText = block.paragraph.rich_text;
                if (richText.length > 0) {
                    // Use richTextToHtml but skip links for the title itself
                    title = richTextToHtml(richText, { skipLinks: true });

                    const link = richText.find((rt: any) => rt.href !== null);
                    if (link && link.href) {
                        url = link.href;
                    }
                }
            } else if (block.type === 'bulleted_list_item' && 'bulleted_list_item' in block) {
                const richText = block.bulleted_list_item.rich_text;
                if (richText.length > 0) {
                    title = richTextToHtml(richText, { skipLinks: true });

                    const link = richText.find((rt: any) => rt.href !== null);
                    if (link && link.href) {
                        url = link.href;
                    } else {
                        // Fallback: Check if the text itself is a URL
                        const text = richText.map((rt: any) => rt.plain_text).join('').trim();
                        if (text.startsWith('http')) {
                            url = text;
                        }
                    }
                }
            } else if (block.type === 'bookmark' && 'bookmark' in block) {
                url = block.bookmark.url;
                const caption = block.bookmark.caption;
                if (caption && caption.length > 0) {
                    title = richTextToHtml(caption, { skipLinks: true });
                } else {
                    title = url;
                }
            }

            if (title) {
                // Extract domain
                let domain = '';
                try {
                    if (url) {
                        const urlObj = new URL(url);
                        domain = urlObj.hostname.replace('www.', '');
                    }
                } catch (e) {
                    // Invalid URL, ignore
                }

                crafts.push({
                    id: block.id,
                    title,
                    url,
                    domain
                });
            }
        }

        const responseData = { crafts };
        setCache(cacheKey, responseData);

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch crafts' });
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
