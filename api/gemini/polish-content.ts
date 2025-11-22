import type { VercelRequest, VercelResponse } from '@vercel/node';

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 5; // 5 requests per minute (more restrictive for content polishing)

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const requests = rateLimitMap.get(ip) || [];

    const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS) {
        return false;
    }

    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(String(ip))) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('=== API DEBUG ===');
    console.log('OPENAI_API_KEY exists:', !!apiKey);
    console.log('OPENAI_API_KEY length:', apiKey?.length || 0);
    console.log('=== END DEBUG ===');

    if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text content is required' });
    }

    try {
        // Ultra-simple format definitions
        const formats = [
            {
                type: 'email',
                label: 'Professional Email',
                prompt: 'Rewrite as a professional email introduction (2-3 sentences):'
            },
            {
                type: 'twitter',
                label: 'Twitter Bio',
                prompt: 'Rewrite as a Twitter bio (under 160 characters):'
            },
            {
                type: 'linkedin',
                label: 'LinkedIn Profile',
                prompt: 'Rewrite as a LinkedIn About section (2-3 paragraphs):'
            }
        ];

        const selectedFormat = formats[Math.floor(Math.random() * formats.length)];

        // Use XML-style boundaries and avoid trigger words like "rewrite"
        const prompt = `
<task>
Produce ONE message in the style described below.
No alternatives.
No options.
No variations.
No explanations.
Return ONLY the final message text with no headings or meta commentary.
Start immediately with the message.
</task>

<style>
${selectedFormat.label}
</style>

<input>
${text}
</input>
`;

        console.log('=== CALLING OPENAI ===');
        console.log('Model: gpt-4o-mini');
        console.log('=== END ===');

        // Call OpenAI API with gpt-4o-mini
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        const responseText = data.choices?.[0]?.message?.content;

        if (!responseText) {
            console.error('Gemini API returned empty response:', JSON.stringify(response, null, 2));
            throw new Error('Empty response from AI');
        }

        // Log the raw response to see what we're actually getting
        console.log('=== RAW AI RESPONSE ===');
        console.log(responseText);
        console.log('=== END RAW RESPONSE ===');

        // Simple post-processing: if AI returns multiple options, take the first one
        let cleaned = responseText.trim();

        // Remove any intro text like "Here is..." or "Here are..."
        // This needs to be more aggressive - remove everything up to the first newline after the colon
        cleaned = cleaned.replace(/^(Here is|Here are|Here's).*?\n/i, '');

        // If there are multiple options, take everything before "Option 2" or "**Option 2"
        if (cleaned.includes('Option 2') || cleaned.includes('**Option 2')) {
            cleaned = cleaned.split(/\*\*Option 2|\nOption 2/i)[0].trim();
        }

        // Remove "Option 1" label if present at the start
        cleaned = cleaned.replace(/^\*\*Option 1.*?\*\*\s*\n/i, '');
        cleaned = cleaned.replace(/^Option 1.*?:\s*\n/i, '');

        // If there are "---" separators, take only the first section
        const sections = cleaned.split(/\n\s*---\s*\n/);
        if (sections.length > 1) {
            cleaned = sections[0].trim();
        }

        // Clean up extra whitespace
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

        console.log('=== CLEANED RESPONSE ===');
        console.log(cleaned);
        console.log('=== END CLEANED ===');

        return res.status(200).json({
            text: cleaned,
            formatType: selectedFormat.type,
            formatLabel: selectedFormat.label
        });
    } catch (error: any) {
        console.error('Gemini API Error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return res.status(500).json({ error: 'Failed to process content' });
    }
}
