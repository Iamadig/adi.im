# adi.im

Personal website with Google Docs-style interface, powered by Notion CMS and Supabase.

## Features

- 🎨 **Google Docs-inspired UI** - Familiar editing interface
- 📝 **Notion CMS** - Manage all content from Notion
- 💬 **Guestbook** - User contributions with moderation (Supabase)
- ✨ **AI Features** - Content rewriting (OpenAI) and quote generation (Gemini)
- 🔒 **Secure** - API keys protected via serverless functions
- 📱 **Responsive** - Works on all devices

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Create `.env.local` in the project root:

```env
# Server-side variables (used by API routes) - NO VITE_ prefix
NOTION_KEY=your_notion_integration_token
NOTION_ABOUT_PAGE=your_about_page_id
NOTION_THOUGHTS_DB=your_thoughts_database_id
NOTION_QUOTES_DB=your_quotes_database_id
NOTION_CRAFTS_DB=your_crafts_database_id
NOTION_RECS_PAGE=your_recommendations_page_id
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key

# Client-side variables (used by React) - MUST have VITE_ prefix
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Important**: Server-side variables (for API routes) should NOT have the `VITE_` prefix. Only client-side variables need the `VITE_` prefix.

### 3. Run Locally

**Option A: Full Local Development (Recommended)**
```bash
npm run dev:full
```
This runs both the Vite frontend and a local Express server for API routes.
- Frontend: `http://localhost:3000`
- API Server: `http://localhost:3001`

> [!NOTE]
> Make sure your `.env.local` file has all the required environment variables (see step 2).

**Option B: Frontend Only (Mock Data)**
```bash
npm run dev
```
Visit `http://localhost:3000`

> [!NOTE]
> This runs the Vite dev server only. API routes (`/api/*`) won't work, so the app uses **mock data**. Perfect for UI development.

**Option C: Using Vercel CLI**
```bash
# First time: Install Vercel CLI globally
npm i -g vercel

# Run with Vercel dev server
vercel dev
```

> [!NOTE]
> This is an alternative to Option A. The first time you run `vercel dev`, it will ask you to login and link your project.

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

**Solution**: Use `npm run dev:full` to run both the frontend and API server, or use `vercel dev`.

```bash
# Option 1: Use the local Express server (recommended)
npm run dev:full

# Option 2: Use Vercel CLI
vercel dev
```

**Note**: Make sure your `.env.local` file has the server-side environment variables (without `VITE_` prefix):
- `NOTION_KEY`
- `NOTION_ABOUT_PAGE`
- `NOTION_THOUGHTS_DB`
- etc.

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
- **AI**: OpenAI (GPT-4o-mini) + Google Gemini
- **Hosting**: Vercel (recommended)

## Cost

All services have generous free tiers:
- Notion: Free
- Supabase: Free (500MB)
- OpenAI: Pay-as-you-go (GPT-4o-mini very cheap)
- Gemini: Free (1M requests/month)
- Vercel: Free (100GB bandwidth)

**Total: ~$0-5/month** for typical personal site traffic (OpenAI usage is minimal)

## License

MIT
