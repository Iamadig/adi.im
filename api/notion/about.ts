import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.VITE_NOTION_KEY;
    const pageId = process.env.VITE_NOTION_ABOUT_PAGE;

    if (!apiKey || !pageId) {
        // Return default text if not configured
        return res.status(200).json({
            text: `I'm Adi. I'm a Design Engineer based in New York.

I sit at the intersection of design and engineering. I care deeply about building high-quality software that feels tangible and handcrafted. I believe that the best software is built by people who understand both the pixels and the code.

Currently, I'm building the future of creative tools. Before that, I worked on design systems and interaction design at various startups.

I enjoy photography, mechanical keyboards, and exploring the city.`
        });
    }

    try {
        const notion = new Client({ auth: apiKey });

        // Fetch blocks from the page
        const response = await notion.blocks.children.list({
            block_id: pageId,
            page_size: 100,
        });

        // Extract text from blocks
        let text = '';
        for (const block of response.results) {
            if ('type' in block) {
                if (block.type === 'paragraph' && 'paragraph' in block) {
                    const richText = block.paragraph.rich_text;
                    const paragraphText = richText.map((rt: any) => rt.plain_text).join('');
                    if (paragraphText) {
                        text += paragraphText + '\n\n';
                    }
                } else if (block.type === 'heading_1' && 'heading_1' in block) {
                    const richText = block.heading_1.rich_text;
                    const headingText = richText.map((rt: any) => rt.plain_text).join('');
                    if (headingText) {
                        text += headingText + '\n\n';
                    }
                } else if (block.type === 'heading_2' && 'heading_2' in block) {
                    const richText = block.heading_2.rich_text;
                    const headingText = richText.map((rt: any) => rt.plain_text).join('');
                    if (headingText) {
                        text += headingText + '\n\n';
                    }
                }
            }
        }

        return res.status(200).json({ text: text.trim() });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch content from Notion' });
    }
}
