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
NOTION_CANVAS_CMS_PAGE=your_canvas_cms_page_id
NOTION_CANVAS_COPY_DB=your_canvas_copy_database_id
NOTION_CANVAS_LINKS_DB=your_canvas_profile_links_database_id
NOTION_CANVAS_THOUGHTS_DB=your_canvas_thoughts_database_id
NOTION_CANVAS_QUOTES_DB=your_canvas_quotes_database_id
NOTION_CANVAS_RECOMMENDATIONS_DB=your_canvas_recommendations_database_id
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

### Tearable Canvas CMS

This site now uses a canvas-specific Notion CMS instead of forcing old long-form pages into fixed canvas slots.

Create or recreate the CMS with:

```bash
npm run content:create-cms
```

The script creates a Notion page called `Adi Website Canvas CMS`, seeds it from the current content snapshot, and appends the `NOTION_CANVAS_*` database IDs to `.env.local`.

The CMS contains:
- `Canvas Copy` for short canvas slots such as hero lines, subtitles, profile intro, and footer
- `Profile Links` for About-page link pills
- `Thoughts` for article metadata and article body
- `Quotes` for quote text and attribution
- `Recommendations` for short public recommendation labels

Each database includes character guidance:
- `Max Characters` or field-specific max columns
- `Character Count`
- `Canvas Fit`, which says `OK` or shows how many characters need to be cut

Only rows with `Status = Published` are rendered publicly.

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

If the `NOTION_CANVAS_*` variables are present, the sync script reads the new canvas CMS. If they are absent, it falls back to the legacy Notion sources.

Public profile HTML can still be curated in `content/site-content.curated.json`, but the visible canvas copy should be edited in the Notion `Canvas Copy` database.

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
