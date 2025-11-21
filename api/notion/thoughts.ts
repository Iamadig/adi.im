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
    const databaseId = process.env.NOTION_THOUGHTS_DB;

    if (!apiKey || !databaseId) {
        return res.status(200).json({
            thoughts: [
                {
                    id: '1',
                    title: 'The Future of Interfaces',
                    date: '2024-03-15',
                    tags: ['Design', 'AI'],
                    content: 'Interfaces are becoming more fluid...'
                },
                {
                    id: '2',
                    title: 'Crafting Software',
                    date: '2024-02-20',
                    tags: ['Engineering'],
                    content: 'Software is a craft, not just engineering...'
                }
            ]
        });
    }

    // Check in-memory cache
    const cacheKey = `thoughts_${databaseId} `;
    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
        return res.status(200).json(cachedData);
    }

    try {
        const notion = new Client({ auth: apiKey });

        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                {
                    property: 'Date',
                    direction: 'descending',
                },
            ],
        });

        const thoughts = await Promise.all(response.results.map(async (page: any) => {
            const props = page.properties;

            // Fetch page content
            const blocks = await notion.blocks.children.list({
                block_id: page.id,
                page_size: 100,
            });

            let content = '';
            for (const block of blocks.results) {
                if ('type' in block && block.type === 'paragraph' && 'paragraph' in block) {
                    content += block.paragraph.rich_text.map((rt: any) => rt.plain_text).join('') + '\n\n';
                }
            }

            return {
                id: page.id,
                title: props.Name?.title?.[0]?.plain_text || 'Untitled',
                date: props.Date?.date?.start || new Date().toISOString().split('T')[0],
                tags: props.Tags?.multi_select?.map((tag: any) => tag.name) || [],
                content: content.trim()
            };
        }));

        const responseData = { thoughts };
        setCache(cacheKey, responseData);

        return res.status(200).json(responseData);
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch thoughts' });
    }
}
