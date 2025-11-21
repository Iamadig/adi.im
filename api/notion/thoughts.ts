import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
                    description: 'Interfaces are becoming more fluid and adaptive.',
                    content: 'Interfaces are becoming more fluid...'
                },
                {
                    id: '2',
                    title: 'Crafting Software',
                    date: '2024-02-20',
                    tags: ['Engineering'],
                    description: 'Software is a craft, not just engineering.',
                    content: 'Software is a craft, not just engineering...'
                }
            ]
        });
    }

    try {
        const notion = new Client({ auth: apiKey });

        // Check if we are fetching a specific thought's content
        const { id } = req.query;

        if (id && typeof id === 'string') {
            // Fetch page content
            const blocks = await notion.blocks.children.list({
                block_id: id,
                page_size: 100,
            });

            let html = '';
            // Simple block to HTML conversion (similar to about.ts but simplified for now)
            // We can reuse the logic from about.ts if we extract it, but for now inline it or use simple text
            // Actually, let's use the same logic as before but return HTML

            for (const block of blocks.results) {
                if (!('type' in block)) continue;

                if (block.type === 'paragraph' && 'paragraph' in block) {
                    const text = block.paragraph.rich_text.map((rt: any) => rt.plain_text).join('');
                    html += `<p>${text}</p>`;
                } else if (block.type === 'heading_1' && 'heading_1' in block) {
                    const text = block.heading_1.rich_text.map((rt: any) => rt.plain_text).join('');
                    html += `<h1>${text}</h1>`;
                } else if (block.type === 'heading_2' && 'heading_2' in block) {
                    const text = block.heading_2.rich_text.map((rt: any) => rt.plain_text).join('');
                    html += `<h2>${text}</h2>`;
                } else if (block.type === 'heading_3' && 'heading_3' in block) {
                    const text = block.heading_3.rich_text.map((rt: any) => rt.plain_text).join('');
                    html += `<h3>${text}</h3>`;
                } else if (block.type === 'bulleted_list_item' && 'bulleted_list_item' in block) {
                    const text = block.bulleted_list_item.rich_text.map((rt: any) => rt.plain_text).join('');
                    html += `<li>${text}</li>`;
                } else if (block.type === 'numbered_list_item' && 'numbered_list_item' in block) {
                    const text = block.numbered_list_item.rich_text.map((rt: any) => rt.plain_text).join('');
                    html += `<li>${text}</li>`;
                }
            }

            return res.status(200).json({ content: html });
        }

        // Otherwise, fetch the list
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                {
                    property: 'Date',
                    direction: 'descending',
                },
            ],
        });

        const thoughts = response.results.map((page: any) => {
            const props = page.properties;

            // Extract Description
            const description = props.Description?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';

            return {
                id: page.id,
                title: props.Name?.title?.[0]?.plain_text || 'Untitled',
                date: props.Date?.date?.start || new Date().toISOString().split('T')[0],
                tags: props.Tags?.multi_select?.map((tag: any) => tag.name) || [],
                description: description,
                content: '' // Don't fetch content in list view
            };
        });

        return res.status(200).json({ thoughts });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch thoughts' });
    }
}
