import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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

    try {
        const notion = new Client({ auth: apiKey });

        // Query the database (not fetch blocks)
        const response = await notion.databases.query({
            database_id: databaseId,
            page_size: 100,
        });

        const quotes: { id: string; text: string; author: string }[] = [];

        for (const page of response.results) {
            if (!('properties' in page)) continue;

            const properties = page.properties as any;

            // Extract quote text from title property
            let quoteText = '';
            if (properties.Quote?.title) {
                quoteText = properties.Quote.title
                    .map((rt: any) => rt.plain_text)
                    .join('');
            }

            // Extract author from rich_text property
            let author = 'Unknown';
            if (properties.Author?.rich_text) {
                author = properties.Author.rich_text
                    .map((rt: any) => rt.plain_text)
                    .join('');
            }

            if (quoteText) {
                quotes.push({
                    id: page.id,
                    text: quoteText,
                    author: author || 'Unknown'
                });
            }
        }

        return res.status(200).json({ quotes });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch quotes' });
    }
}
