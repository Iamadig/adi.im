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

## Testing

```bash
npm run lint --if-present
npm run typecheck
npm run test:physics
npm run test:wasm
npm run test:browser-smoke:wasm
npm run test:browser-smoke:ts
npm run build
```

- `test:physics` validates cloth promotion, release motion, stretch bounds, explicit cut topology, reusable geometry topology buffers, worker-provided upload hints, WASM-worker failover, live-cell shear/bend resistance, local curvature smoothing, and multi-grab slot bookkeeping without a browser.
- `test:wasm` builds the WASM cloth solver and compares active solve, motion-only snapshots, worker timing metadata, passive falling, normals, explicit cuts, tear counts, and live topology index output against the TypeScript solver.
- `test:browser-smoke:wasm` launches Chrome against the default WASM backend; `test:browser-smoke:ts` repeats the same flow with `?wasmCloth=0` to verify the TypeScript fallback.
- `test:browser-smoke` is the underlying DevTools smoke runner. It verifies protected links, display-only Thoughts/Quotes canvas surfaces, real article-pane scrolling/clicks, hidden arrow navigation, secondary-button cut/tear, tear-to-reveal timing, reset, mobile overflow, active-cloth worker usage, passive-sheet worker usage, worker timing/upload debug stats, two-touch grab slots, and frame pacing during tear/drop.
- The browser smoke test expects a local server at `http://127.0.0.1:3000/`. Run `npm run dev` first.
- Physics parity notes and remaining Pushmatrix gaps live in `docs/tearable-physics-audit.md`.

### WASM Cloth Solver

WASM is the default active and passive cloth worker backend. Build the deployable module with:

```bash
npm run wasm:build
npm run dev
```

Use `?wasmCloth=0`, `localStorage.tearableWasm = '0'`, or `VITE_TEARABLE_WASM=0` to force the TypeScript worker fallback. Use `?wasmCloth=1` or `localStorage.tearableWasm = '1'` to force WASM when needed. If the WASM worker fails during startup or runtime, the app rehydrates the TypeScript worker backend. If workers are unavailable entirely, it falls back to main-thread TypeScript stepping rather than blocking interaction.

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
- A torn sheet should stay alive as the same cloth mesh during release; avoid snapshot-style transitions.
- Drop promotion waits briefly after release so stored tension can visibly rebound before the sheet falls away.
- Drop impulse is layered onto existing cloth velocity instead of replacing release momentum.
- Secondary-button drag uses an explicit cut path for more deliberate tearing; Shift-drag keeps the same path as a keyboard-accessible shortcut.
- Active and passive tear simulation use WASM Web Workers by default, with TypeScript worker fallback available via `?wasmCloth=0`; worker snapshots include normals, and active snapshots include torn topology indices.
- Active worker frames that predate a later pointer command are skipped on arrival, so live grab/cut edits do not visibly rewind.
- Main-thread topology application reuses dynamic index buffers and draw ranges instead of reallocating index attributes during every tear update.
- Cloth position/normal buffers use dynamic draw usage plus changed-range tracking for partial attribute uploads on small local edits.
- Canvas sheet textures use `DataTexture` row-range updates after initial paint, so protected content changes can upload only changed rows.
- The Quotes layer is display-only; do not reintroduce a prompt field, pull button, or hidden input bridge on that surface.
- Initial pointer hits use a bounded cloth-grid raycast over live cells rather than Three's generic mesh raycaster.
- Active tear/cut drags use plane projection after the gesture starts, avoiding repeated mesh raycasts on the hottest pointer-move path.
- Live cells get diagonal shear correction, which keeps the sheet from collapsing into a loose rectangular mesh while still letting torn cells separate.
- The cloth solver includes a lightweight curvature smoothing pass so release/fall motion keeps more sheet-like tension instead of collapsing into rubbery local folds.
- Solver steps cap only extreme per-particle velocity outliers after constraints, preserving rebound while preventing single-frame snap spikes.
- Grab state is slot-based rather than global; slot `0` preserves single-pointer dragging and additional touch pointers can hold independent tension points.
- Released sheets use a Web Worker for passive cloth simulation so falling motion does not compete with UI rendering.
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
