// Quick test to verify your Notion credentials
import { Client } from '@notionhq/client';
import * as dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: '.env.local' });

async function testNotionConnection() {
    console.log('Testing Notion Connection...\n');

    // Check if we have the variables (without VITE_ prefix for server-side)
    const apiKey = process.env.NOTION_KEY;
    const pageId = process.env.NOTION_ABOUT_PAGE;

    console.log('Environment Check:');
    console.log('✓ NOTION_KEY exists:', !!apiKey);
    console.log('✓ NOTION_ABOUT_PAGE exists:', !!pageId);
    console.log('');

    if (!apiKey || !pageId) {
        console.error('❌ Missing environment variables!');
        console.log('\nMake sure your .env.local has:');
        console.log('NOTION_KEY=secret_xxx...');
        console.log('NOTION_ABOUT_PAGE=xxx-xxx-xxx...');
        process.exit(1);
    }

    // Test the connection
    try {
        const notion = new Client({ auth: apiKey });

        console.log('Attempting to fetch page...');
        const response = await notion.blocks.children.list({
            block_id: pageId,
            page_size: 10,
        });

        console.log('✅ SUCCESS! Connected to Notion');
        console.log('✅ Found', response.results.length, 'blocks');
        console.log('\nFirst block preview:');
        console.log(JSON.stringify(response.results[0], null, 2));

    } catch (error: any) {
        console.error('❌ ERROR connecting to Notion:');
        console.error(error.message);

        if (error.code === 'unauthorized') {
            console.log('\n🔍 Possible issues:');
            console.log('1. Invalid NOTION_KEY - check your integration token');
            console.log('2. Integration not connected to the page - add connection in Notion');
        } else if (error.code === 'object_not_found') {
            console.log('\n🔍 Possible issues:');
            console.log('1. Invalid NOTION_ABOUT_PAGE ID');
            console.log('2. Page doesn\'t exist or was deleted');
        }
        process.exit(1);
    }
}

testNotionConnection();
