/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_MESSAGING_MODE?: "demo" | "cloud" | "wa_me" | string;
  /** When "false", Download/Publish/Share work without sign-in in Connected Mode. Default: require sign-in. */
  readonly VITE_REQUIRE_SIGN_IN?: string;
  /** Optional override for Connected Mode hardcoded OTP (default 123456). Never show in UI. */
  readonly VITE_DEV_OTP?: string;
  /** Google Analytics 4 measurement ID (G-XXXXXXXX). Leave unset to disable analytics. */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
