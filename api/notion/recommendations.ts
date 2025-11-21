import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.VITE_NOTION_KEY;
    const pageId = process.env.VITE_NOTION_RECS_PAGE;

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

    try {
        const notion = new Client({ auth: apiKey });

        // Fetch blocks from the page
        const response = await notion.blocks.children.list({
            block_id: pageId,
            page_size: 100,
        });

        const recommendations: any[] = [];
        let currentSection: any = null;

        for (const block of response.results) {
            if ('type' in block) {
                // Headings create new sections
                if (block.type === 'heading_2' && 'heading_2' in block) {
                    if (currentSection) {
                        recommendations.push(currentSection);
                    }
                    const title = block.heading_2.rich_text.map((rt: any) => rt.plain_text).join('');
                    currentSection = {
                        id: title.toLowerCase().replace(/\s+/g, '-'),
                        title,
                        items: []
                    };
                }
                // Bulleted list items add to current section
                else if (block.type === 'bulleted_list_item' && 'bulleted_list_item' in block && currentSection) {
                    const item = block.bulleted_list_item.rich_text.map((rt: any) => rt.plain_text).join('');
                    if (item) {
                        currentSection.items.push(item);
                    }
                }
            }
        }

        // Push the last section
        if (currentSection) {
            recommendations.push(currentSection);
        }

        return res.status(200).json({ recommendations });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch recommendations from Notion' });
    }
}
