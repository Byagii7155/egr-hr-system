import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase орчны хувьсагчид (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) .env.local дээр тохируулагдаагүй байна."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);