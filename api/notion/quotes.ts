import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.NOTION_KEY;
    const databaseId = process.env.NOTION_QUOTES_DB;

    if (!apiKey || !databaseId) {
        // Return mock data if not configured
        return res.status(200).json({
            quotes: [
                { id: '1', text: "The details are not the details. They make the design.", author: "Charles Eames" },
                { id: '2', text: "Good design is as little design as possible.", author: "Dieter Rams" },
                { id: '3', text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" }
            ]
        });
    }

    try {
        const notion = new Client({ auth: apiKey });

        const response = await notion.databases.query({
            database_id: databaseId,
        });

        const quotes = response.results.map((page: any) => {
            const props = page.properties;

            // Extract quote text (could be in 'Quote', 'Text', or 'Name' property)
            const text = props.Quote?.title?.[0]?.plain_text ||
                props.Text?.rich_text?.[0]?.plain_text ||
                props.Name?.title?.[0]?.plain_text || '';

            // Extract author
            const author = props.Author?.rich_text?.[0]?.plain_text || 'Unknown';

            return {
                id: page.id,
                text,
                author
            };
        });

        return res.status(200).json({ quotes });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch quotes from Notion' });
    }
}
