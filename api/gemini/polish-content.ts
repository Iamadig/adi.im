import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

    const apiKey = process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }

    const { text } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Text content is required' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: `Rewrite the following text to be more professional, engaging, and concise, while maintaining a personal tone suitable for a personal website bio: "${text}"`,
        });

        const polishedText = response.text || text;

        return res.status(200).json({ text: polishedText });
    } catch (error) {
        console.error('Gemini API Error:', error);
        return res.status(500).json({ text }); // Return original text on error
    }
}
