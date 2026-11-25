import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

const isValidUrl = /^https?:\/\/.+/.test(rawUrl);

const supabaseUrl = isValidUrl
  ? rawUrl
  : "https://goelivbsdaafwpkuaxph.supabase.co";

const supabaseAnonKey = rawKey || "sb_publishable_placeholder";

export const isSupabaseConfigured = Boolean(isValidUrl && rawKey);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
