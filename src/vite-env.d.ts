// Fix: Replaced the failing 'vite/client' type reference with manual definitions
// for `import.meta.env`. This resolves errors related to TypeScript not
// recognizing environment variables (e.g., `import.meta.env.VITE_SUPABASE_URL`)
// and also fixes the "Cannot find type definition file for 'vite/client'" error.
interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
}
  
interface ImportMeta {
    readonly env: ImportMetaEnv;
}
