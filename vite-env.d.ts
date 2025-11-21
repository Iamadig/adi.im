/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string
    readonly VITE_NOTION_KEY: string
    readonly VITE_NOTION_ABOUT_PAGE: string
    readonly VITE_NOTION_THOUGHTS_DB: string
    readonly VITE_NOTION_QUOTES_DB: string
    readonly VITE_NOTION_CRAFTS_DB: string
    readonly VITE_NOTION_RECS_PAGE: string
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
