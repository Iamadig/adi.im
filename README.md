# adi.im

Personal website with a tearable paper interface and a build-time content snapshot.

## Features

- 🧠 **Tearable UI** - Full-screen paper layers for profile, thoughts, quotes, and recommendations
- 📝 **Curated Content** - Public copy lives in `content/site-content.curated.json`
- ⚡ **Static Reads** - Content is generated into local JSON at build time
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
# Server-side variables - NO VITE_ prefix
NOTION_KEY=your_notion_integration_token
NOTION_ABOUT_PAGE=your_about_page_id
NOTION_THOUGHTS_DB=your_thoughts_database_id
NOTION_QUOTES_DB=your_quotes_database_id
NOTION_RECOMMENDATIONS_DB=your_recommendations_database_id
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
```

> **Important**: content reads are static after `npm run content:sync`. Runtime secrets are only used for Notion sync and optional AI features.

### 3. Run Locally

**Option A: Full Local Development (Recommended)**
```bash
npm run dev:full
```
This runs both the Vite frontend and a local Express server for optional AI APIs.
- Frontend: `http://localhost:3000`
- API Server: `http://localhost:3001`

> [!NOTE]
> Make sure your `.env.local` file has all the required environment variables (see step 2).

**Option B: Frontend Only**
```bash
npm run dev
```
Visit `http://localhost:3000`

> [!NOTE]
> This runs the Vite dev server only. Static content still works from the generated snapshot, but optional AI actions won't.

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
- Generate the static content snapshot during build
- Build your app
- Deploy optional serverless API routes
- Provide a production URL

## Setup Guides

### Notion Setup

See [setup-guide.md](./docs/setup-guide.md) for detailed instructions on:
- Creating Notion integration
- Setting up databases (Thoughts, Quotes, Recommendations)
- Creating content pages (About)

### Recommendations DB

Create one Notion database for curated recommendations. Add its ID as `NOTION_RECOMMENDATIONS_DB`.

Recommended properties:
- `Recommendation` or `Name` as the title property
- `Category` as `select`, `multi_select`, or `rich_text`
- `Status` as `status` or `select`, with `Done` meaning public and `Not started` meaning queued
- `Kind` as `select` with `curated`
- `Display` as `rich_text` for custom display text
- `Attribution` as `rich_text` or `url`

Only rows marked `Done` are shown on the public site.

### Refreshing Static Content

```bash
npm run content:sync
```

`npm run build` runs this automatically.

Public profile copy is intentionally curated in `content/site-content.curated.json`. The sync script still reads Notion, then applies this curated file so the personal-site narrative does not get overwritten by stale CMS content.

For the normal content-edit workflow:

```bash
npm run content:publish
```

That rebuilds the snapshot, runs the production build, then shows `git status` so you can commit and push.

## Project Structure

```
├── api/                    # Optional serverless functions
│   ├── gemini/            # AI features
├── components/            # React components
├── content/               # Generated static content snapshot
├── scripts/               # Snapshot generation
├── services/              # API client services
├── types.ts               # TypeScript types
└── constants.ts           # Configuration
```

## Troubleshooting

### "API routes not working locally"

**Problem**: Running `npm run dev` and AI actions are failing.

**Solution**: Use `npm run dev:full` to run both the frontend and API server, or use `vercel dev`.

```bash
# Option 1: Use the local Express server (recommended)
npm run dev:full

# Option 2: Use Vercel CLI
vercel dev
```

**Note**: Make sure your `.env.local` file has the server-side environment variables:
- `NOTION_KEY`
- `NOTION_RECOMMENDATIONS_DB`
- AI keys if you use AI features

### "Content is stale after updating Notion"

Regenerate the snapshot:

```bash
npm run content:sync
```

`npm run build` also refreshes it.

### "vercel dev asking for login"

First time setup:
1. Create free account at https://vercel.com
2. Run `vercel login`
3. Follow the browser authentication
4. Run `vercel dev` again

---

## Interface Notes

- The public shell should feel like one physical sheet, not an app dashboard.
- Keep `content/site-content.curated.json` as the source for public profile content.
- Keep visual changes grounded in readable content; this is a personal site first, interaction second.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **CMS**: Notion API
- **Content Delivery**: Generated JSON snapshot
- **Moderation Queue**: Notion database
- **AI**: OpenAI Responses API (`gpt-5.4-mini` by default) + Google Gemini fallback
- **Hosting**: Vercel (recommended)

## Cost

All services have generous free tiers:
- Notion: Free
- OpenAI: Pay-as-you-go (`gpt-5.4-mini` by default)
- Gemini: Free (1M requests/month)
- Vercel: Free (100GB bandwidth)

**Total: ~$0-5/month** for typical personal site traffic (OpenAI usage is minimal)

## License

MIT
