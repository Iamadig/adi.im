import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import type { Request, Response } from 'express';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also load .env if it exists

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Helper to convert Express req/res to Vercel format
function createVercelHandler(handler: (req: VercelRequest, res: VercelResponse) => Promise<any>) {
  return async (req: Request, res: Response) => {
    // Get client IP (Express way)
    const clientIp = req.ip || 
                     req.socket.remoteAddress || 
                     (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     'unknown';

    const vercelReq = {
      method: req.method,
      query: req.query,
      body: req.body,
      headers: {
        ...req.headers,
        'x-forwarded-for': clientIp,
      },
      socket: {
        remoteAddress: clientIp,
      },
    } as any as VercelRequest;

    let statusCode = 200;
    const vercelRes = {
      status: (code: number) => {
        statusCode = code;
        return vercelRes;
      },
      json: (data: any) => {
        res.status(statusCode).json(data);
      },
    } as any as VercelResponse;

    try {
      await handler(vercelReq, vercelRes);
    } catch (error) {
      console.error('Handler error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

// Import and register API routes
async function setupRoutes() {
  // Notion routes
  const aboutHandler = (await import('./api/notion/about.ts')).default;
  app.get('/api/notion/about', createVercelHandler(aboutHandler));

  const thoughtsHandler = (await import('./api/notion/thoughts.ts')).default;
  app.get('/api/notion/thoughts', createVercelHandler(thoughtsHandler));

  const quotesHandler = (await import('./api/notion/quotes.ts')).default;
  app.get('/api/notion/quotes', createVercelHandler(quotesHandler));

  const craftsHandler = (await import('./api/notion/crafts.ts')).default;
  app.get('/api/notion/crafts', createVercelHandler(craftsHandler));

  const recommendationsHandler = (await import('./api/notion/recommendations.ts')).default;
  app.get('/api/notion/recommendations', createVercelHandler(recommendationsHandler));

  // Gemini routes
  const generateQuoteHandler = (await import('./api/gemini/generate-quote.ts')).default;
  app.post('/api/gemini/generate-quote', createVercelHandler(generateQuoteHandler));

  const polishContentHandler = (await import('./api/gemini/polish-content.ts')).default;
  app.post('/api/gemini/polish-content', createVercelHandler(polishContentHandler));
}

setupRoutes().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Local API server running on http://localhost:${PORT}`);
    console.log(`📝 API routes available at http://localhost:${PORT}/api/*`);
    console.log(`\n💡 Make sure your .env.local file has the required environment variables:`);
    console.log(`   - NOTION_KEY`);
    console.log(`   - NOTION_ABOUT_PAGE`);
    console.log(`   - NOTION_THOUGHTS_DB`);
    console.log(`   - NOTION_QUOTES_DB`);
    console.log(`   - NOTION_CRAFTS_DB`);
    console.log(`   - NOTION_RECS_PAGE`);
    console.log(`   - GEMINI_API_KEY (optional)\n`);
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

