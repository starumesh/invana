/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_MESSAGING_MODE?: "demo" | "cloud" | "wa_me" | string;
  /** When "false", Download works without sign-in in Connected Mode. Default: require sign-in. Publish/Share always require sign-in. */
  readonly VITE_REQUIRE_SIGN_IN?: string;
  /** Google Analytics 4 measurement ID (G-XXXXXXXX). Leave unset to disable analytics. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
