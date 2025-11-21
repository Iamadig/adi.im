import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// Simple in-memory rate limiting (resets on cold start)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const requests = rateLimitMap.get(ip) || [];

    // Filter out requests outside the window
    const recentRequests = requests.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS) {
        return false;
    }

    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);
    return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Rate limiting
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(String(ip))) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const { mood } = req.body;

    try {
        const ai = new GoogleGenAI({ apiKey });

        let prompt = '';
        if (mood && mood.trim()) {
            prompt = `Generate a profound, inspiring, or comforting quote suitable for someone who is feeling "${mood}". 
      Return ONLY the quote and the author in the following format: "Quote Text" - Author Name. 
      Do not include any other text or conversational filler.`;
        } else {
            prompt = `Generate a profound, inspiring, unique, and less common quote about life, creativity, or human nature.
      Return ONLY the quote and the author in the following format: "Quote Text" - Author Name.
      Do not include any other text or conversational filler.`;
        }

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite',
            contents: prompt,
        });

        // Try multiple ways to access the response text
        let result = '';

        // Method 1: Direct .text property
        if (response.text) {
            result = response.text.trim();
        }
        // Method 2: Through candidates array (fallback)
        else if (response.candidates && response.candidates.length > 0) {
            const candidate = response.candidates[0];
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                result = candidate.content.parts[0].text?.trim() || '';
            }
        }

        if (!result) {
            console.error('Gemini API returned empty response:', JSON.stringify(response, null, 2));
            throw new Error('Empty response from Gemini API');
        }

        const lastDashIndex = result.lastIndexOf(' - ');

        if (lastDashIndex !== -1) {
            let text = result.substring(0, lastDashIndex).trim();
            const author = result.substring(lastDashIndex + 3).trim();

            if (text.startsWith('"') && text.endsWith('"')) {
                text = text.slice(1, -1);
            }

            return res.status(200).json({ text, author });
        } else {
            return res.status(200).json({
                text: result.replace(/"/g, ''),
                author: 'Unknown'
            });
        }
    } catch (error: any) {
        console.error('Gemini API Error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return res.status(500).json({
            error: 'Failed to generate quote',
            details: error.message,
            text: 'Every moment is a fresh beginning.',
            author: 'T.S. Eliot'
        });
    }
}
