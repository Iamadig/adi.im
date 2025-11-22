import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Client } from '@notionhq/client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.NOTION_KEY;
    const pageId = process.env.NOTION_CRAFTS_DB;

    if (!apiKey || !pageId) {
        return res.status(200).json({
            html: `<ul>
                <li>Personal Website - <a href="https://github.com/adi/personal-site" target="_blank">github.com</a></li>
                <li>Design System - <a href="https://www.figma.com" target="_blank">figma.com</a></li>
            </ul>`
        });
    }

    try {
        const notion = new Client({ auth: apiKey });

        // Fetch blocks from the page
        const response = await notion.blocks.children.list({
            block_id: pageId,
            page_size: 100,
        });

        let html = '';
        html = await processBlocks(response.results, notion);

        return res.status(200).json({ html });
    } catch (error) {
        console.error('Notion API Error:', error);
        return res.status(500).json({ error: 'Failed to fetch crafts' });
    }
}

async function processBlocks(blocks: any[], notion: Client, depth: number = 0): Promise<string> {
    let html = '';
    let currentListType: 'ul' | 'ol' | null = null;

    for (const block of blocks) {
        if (!('type' in block)) continue;

        const blockType = block.type;

        // Handle List Closing
        if (currentListType && blockType !== 'bulleted_list_item' && blockType !== 'numbered_list_item') {
            html += currentListType === 'ul' ? '</ul>' : '</ol>';
            currentListType = null;
        }

        // Handle List Opening
        if (!currentListType) {
            if (blockType === 'bulleted_list_item') {
                currentListType = 'ul';
                html += '<ul>';
            } else if (blockType === 'numbered_list_item') {
                currentListType = 'ol';
                html += '<ol>';
            }
        } else {
            // Switch list type if needed
            if (currentListType === 'ul' && blockType === 'numbered_list_item') {
                html += '</ul><ol>';
                currentListType = 'ol';
            } else if (currentListType === 'ol' && blockType === 'bulleted_list_item') {
                html += '</ol><ul>';
                currentListType = 'ul';
            }
        }

        if (blockType === 'paragraph' && 'paragraph' in block) {
            const content = richTextToHtml(block.paragraph.rich_text);
            if (content) html += `<p>${content}</p>`;
            else html += '<p><br/></p>'; // Empty paragraph
        }
        else if (blockType === 'heading_1' && 'heading_1' in block) {
            const content = richTextToHtml(block.heading_1.rich_text);
            if (content) html += `<h1>${content}</h1>`;
        }
        else if (blockType === 'heading_2' && 'heading_2' in block) {
            const content = richTextToHtml(block.heading_2.rich_text);
            if (content) html += `<h2>${content}</h2>`;
        }
        else if (blockType === 'heading_3' && 'heading_3' in block) {
            const content = richTextToHtml(block.heading_3.rich_text);
            if (content) html += `<h3>${content}</h3>`;
        }
        else if (blockType === 'bulleted_list_item' && 'bulleted_list_item' in block) {
            const content = richTextToHtml(block.bulleted_list_item.rich_text);
            html += `<li>${content}`;

            // Check for nested children
            if (block.has_children) {
                const childrenResponse = await notion.blocks.children.list({
                    block_id: block.id,
                });
                const childrenHtml = await processBlocks(childrenResponse.results, notion, depth + 1);
                html += childrenHtml;
            }

            html += '</li>';
        }
        else if (blockType === 'numbered_list_item' && 'numbered_list_item' in block) {
            const content = richTextToHtml(block.numbered_list_item.rich_text);
            html += `<li>${content}`;

            // Check for nested children
            if (block.has_children) {
                const childrenResponse = await notion.blocks.children.list({
                    block_id: block.id,
                });
                const childrenHtml = await processBlocks(childrenResponse.results, notion, depth + 1);
                html += childrenHtml;
            }

            html += '</li>';
        }
        else if (blockType === 'quote' && 'quote' in block) {
            const content = richTextToHtml(block.quote.rich_text);
            if (content) html += `<blockquote>${content}</blockquote>`;
        }
        else if (blockType === 'divider') {
            html += '<hr />';
        }
    }

    // Close any open list
    if (currentListType) {
        html += currentListType === 'ul' ? '</ul>' : '</ol>';
    }

    return html;
}

function richTextToHtml(richText: any[]): string {
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

        if (rt.href) {
            text = `<a href="${rt.href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }

        return text;
    }).join('');
}
