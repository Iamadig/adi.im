import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.VITE_NOTION_KEY;
    const databaseId = process.env.VITE_NOTION_CRAFTS_DB;

    if (!apiKey || !databaseId) {
        // Return mock data if not configured
        return res.status(200).json({
            crafts: [
                { id: '1', title: "Rauno Freiberg", url: "https://rauno.me", domain: "rauno.me" },
                { id: '2', title: "Paco Coursey", url: "https://paco.me", domain: "paco.me" },
                { id: '3', title: "Emil Kowalski", url: "https://emilkowal.ski", domain: "emilkowal.ski" }
            ]
        });
    }

    try {
        const notion = new Client({ auth: apiKey });

        const response = await notion.databases.query({
            database_id: databaseId,
        });

        const crafts = response.results.map((page: any) => {
            const props = page.properties;

            // Extract title
            const title = props.Title?.title?.[0]?.plain_text ||
                props.Name?.title?.[0]?.plain_text || 'Untitled';

            // Extract URL
            const url = props.URL?.url || props.Link?.url || '';

            // Extract or derive domain
            let domain = props.Domain?.rich_text?.[0]?.plain_text || '';
            if (!domain && url) {
                try {
                    domain = new URL(url).hostname.replace('www.', '');
                } catch (e) {
                    domain = url;
                }
            }

            return {
                id: page.id,
                title,
                url,
                domain
            };
        });

        return res.status(200).json({ crafts });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch crafts from Notion' });
    }
}
