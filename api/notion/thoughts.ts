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
            html = await processBlocks(blocks.results, notion);

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
                title: props.Title?.title?.[0]?.plain_text || props.Name?.title?.[0]?.plain_text || 'Untitled',
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

            if (block.has_children) {
                const childrenResponse = await notion.blocks.children.list({ block_id: block.id });
                const childrenHtml = await processBlocks(childrenResponse.results, notion, depth + 1);
                html += childrenHtml;
            }

            html += '</li>';
        }
        else if (blockType === 'numbered_list_item' && 'numbered_list_item' in block) {
            const content = richTextToHtml(block.numbered_list_item.rich_text);
            html += `<li>${content}`;

            if (block.has_children) {
                const childrenResponse = await notion.blocks.children.list({ block_id: block.id });
                const childrenHtml = await processBlocks(childrenResponse.results, notion, depth + 1);
                html += childrenHtml;
            }

            html += '</li>';
        }
        else if (blockType === 'quote' && 'quote' in block) {
            const content = richTextToHtml(block.quote.rich_text);
            if (content) html += `<blockquote>${content}</blockquote>`;
        }
        else if (blockType === 'callout' && 'callout' in block) {
            const content = richTextToHtml(block.callout.rich_text);
            const icon = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : '💡';
            html += `<div class="bg-gray-50 p-4 rounded-lg border border-gray-100 my-4 flex gap-3"><div class="text-xl select-none">${icon}</div><div class="flex-1">${content}</div></div>`;
        }
        else if (blockType === 'divider') {
            html += '<hr />';
        }
        else if (blockType === 'image' && 'image' in block) {
            const url = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
            const caption = block.image.caption?.length ? richTextToHtml(block.image.caption) : '';
            html += `<figure class="my-6"><img src="${url}" alt="${caption}" class="rounded-lg w-full" />${caption ? `<figcaption class="text-center text-sm text-gray-500 mt-2">${caption}</figcaption>` : ''}</figure>`;
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
