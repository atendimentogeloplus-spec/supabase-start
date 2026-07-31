import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const env = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;

const supabaseUrl =
  import.meta.env.EXTERNAL_SUPABASE_URL ?? env['EXTERNAL_SUPABASE_URL'] ?? "";
const supabaseAnonKey =
  import.meta.env.EXTERNAL_SUPABASE_ANON_KEY ?? env['EXTERNAL_SUPABASE_ANON_KEY'] ?? "";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
