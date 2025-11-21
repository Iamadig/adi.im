# adi.im

Personal website with Google Docs-style interface, powered by Notion CMS and Supabase.

## Features

- 🎨 **Google Docs-inspired UI** - Familiar editing interface
- 📝 **Notion CMS** - Manage all content from Notion
- 💬 **Guestbook** - User contributions with moderation (Supabase)
- ✨ **AI Features** - Quote generation and content polishing (Gemini)
- 🔒 **Secure** - API keys protected via serverless functions
- 📱 **Responsive** - Works on all devices

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Create `.env.local` in the project root (copy from `.env.local.example`):

```env
# Required for AI features
VITE_GEMINI_API_KEY=your_gemini_api_key

# Required for CMS content (or use mock data)
VITE_NOTION_KEY=your_notion_integration_token
VITE_NOTION_ABOUT_PAGE=your_about_page_id
VITE_NOTION_THOUGHTS_DB=your_thoughts_database_id
VITE_NOTION_QUOTES_DB=your_quotes_database_id
VITE_NOTION_CRAFTS_DB=your_crafts_database_id
VITE_NOTION_RECS_PAGE=your_recommendations_page_id

# Required for guestbook (or stores in localStorage)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Locally

**Option A: With Mock Data (Quick Start)**
```bash
npm run dev
```
Visit `http://localhost:3000`

> [!NOTE]
> This runs the Vite dev server only. API routes (`/api/*`) won't work, so the app uses **mock data**. Perfect for UI development.

**Option B: With Real APIs (Full Features)**
```bash
# First time: Install Vercel CLI globally
npm i -g vercel

# Run with Vercel dev server
vercel dev
```

> [!IMPORTANT]
> Use `vercel dev` to test Notion/Supabase/Gemini integrations locally. This runs both Vite AND the serverless functions.

The first time you run `vercel dev`, it will ask you to:
1. Login to Vercel (or create free account)
2. Link to a project (create new one or skip)
3. Copy your `.env.local` settings

After setup, it will start at `http://localhost:3000` with full API functionality.

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

Vercel will automatically:
- Detect the Vite framework
- Build your app
- Deploy serverless API routes
- Provide a production URL

## Setup Guides

### Notion Setup

See [setup-guide.md](./docs/setup-guide.md) for detailed instructions on:
- Creating Notion integration
- Setting up databases (Thoughts, Quotes, Crafts)
- Creating content pages (About, Recommendations)

### Supabase Setup

Run this SQL in your Supabase project:

```sql
CREATE TABLE guestbook_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  color TEXT,
  is_approved BOOLEAN DEFAULT FALSE
);

ALTER TABLE guestbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view approved entries"
  ON guestbook_entries FOR SELECT
  USING (is_approved = true);

CREATE POLICY "Anyone can insert entries"
  ON guestbook_entries FOR INSERT
  WITH CHECK (true);
```

## Project Structure

```
├── api/                    # Serverless functions (Vercel)
│   ├── gemini/            # AI features
│   └── notion/            # CMS content
├── components/            # React components
├── services/              # API client services
├── types.ts               # TypeScript types
└── constants.ts           # Configuration
```

## Troubleshooting

### "API routes not working locally"

**Problem**: Running `npm run dev` but content isn't loading from Notion/Supabase.

**Solution**: The `/api` serverless functions only work with `vercel dev`, not regular Vite dev server.

```bash
# Stop npm run dev (Ctrl+C)
# Use vercel dev instead
vercel dev
```

### "Mock data showing instead of real content"

This is normal with `npm run dev`. Either:
- Use `vercel dev` for real API calls, OR
- Deploy to Vercel and test in production

### "vercel dev asking for login"

First time setup:
1. Create free account at https://vercel.com
2. Run `vercel login`
3. Follow the browser authentication
4. Run `vercel dev` again

---

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **CMS**: Notion API
- **Database**: Supabase
- **AI**: Google Gemini
- **Hosting**: Vercel (recommended)

## Cost

All services have generous free tiers:
- Notion: Free
- Supabase: Free (500MB)
- Gemini: Free (1M requests/month)
- Vercel: Free (100GB bandwidth)

**Total: $0/month** for typical personal site traffic

## License

MIT
