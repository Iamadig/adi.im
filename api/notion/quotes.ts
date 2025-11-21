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
    const databaseId = process.env.NOTION_QUOTES_DB;

    if (!apiKey || !databaseId) {
        return res.status(200).json({
            quotes: [
                { id: '1', text: 'Simplicity is the ultimate sophistication.', author: 'Leonardo da Vinci' },
                { id: '2', text: 'Design is not just what it looks like and feels like. Design is how it works.', author: 'Steve Jobs' }
            ]
        });
    }

    // Check in-memory cache
    const cacheKey = `quotes_${databaseId}`;
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

        const quotes: { id: string; text: string; author: string }[] = [];

        for (const block of response.results) {
            if (!('type' in block)) continue;

            if (block.type === 'quote' && 'quote' in block) {
                const richText = block.quote.rich_text;
                if (richText.length > 0) {
                    const text = richText.map((rt: any) => rt.plain_text).join('');

                    // Try to extract author from the text (e.g. "Quote" - Author)
                    let quoteText = text;
                    let author = 'Unknown';

                    if (text.includes('—')) {
                        const parts = text.split('—');
                        quoteText = parts[0].trim();
                        author = parts[1].trim();
                    } else if (text.includes('-')) {
                        const parts = text.split('-');
                        // Check if the last part looks like an author (short, no quotes)
                        if (parts.length > 1) {
                            const lastPart = parts[parts.length - 1].trim();
                            if (lastPart.length < 30) {
                                author = lastPart;
                                quoteText = parts.slice(0, -1).join('-').trim();
                            }
                        }
                    }

                    // Remove surrounding quotes if present
                    quoteText = quoteText.replace(/^["']|["']$/g, '');

                    quotes.push({
                        id: block.id,
                        text: quoteText,
                        author
                    });
                }
            }
        }

        const responseData = { quotes };
        setCache(cacheKey, responseData);

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch quotes' });
    }
}
