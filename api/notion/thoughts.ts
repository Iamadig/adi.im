import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.NOTION_KEY;
    const databaseId = process.env.NOTION_THOUGHTS_DB;

    if (!apiKey || !databaseId) {
        // Return mock data if not configured
        return res.status(200).json({
            thoughts: [
                {
                    id: '101',
                    title: 'On Craft',
                    date: 'Oct 12, 2023',
                    content: 'Craft is the difference between "good enough" and "magical". It\'s the invisible details—the spring physics of a button, the easing of a transition, the micro-copy that makes you smile. In a world of standardized components, craft is our rebellion.',
                    tags: ['Design', 'Philosophy']
                }
            ]
        });
    }

    try {
        const notion = new Client({ auth: apiKey });

        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [{ property: 'Date', direction: 'descending' }],
        });

        const thoughts = response.results.map((page: any) => {
            const props = page.properties;

            // Extract title
            const title = props.Title?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || 'Untitled';

            // Extract date
            const dateObj = props.Date?.date;
            const date = dateObj ? new Date(dateObj.start).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }) : '';

            // Extract content
            const content = props.Content?.rich_text?.[0]?.plain_text || '';

            // Extract tags
            const tags = props.Tags?.multi_select?.map((tag: any) => tag.name) || [];

            return {
                id: page.id,
                title,
                date,
                content,
                tags
            };
        });

        return res.status(200).json({ thoughts });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch thoughts from Notion' });
    }
}
