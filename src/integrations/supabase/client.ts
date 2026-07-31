import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type PublicSupabaseConfig = { url: string; anonKey: string };

declare global {
  interface Window {
    __SUPABASE_PUBLIC_CONFIG__?: PublicSupabaseConfig;
  }
}

let client: ReturnType<typeof createClient<Database>> | undefined;

function getClient() {
  if (client) return client;

  const serverEnv = typeof process !== "undefined" ? process.env : undefined;
  const config = typeof window !== "undefined" ? window.__SUPABASE_PUBLIC_CONFIG__ : undefined;
  const url = config?.url ?? import.meta.env.EXTERNAL_SUPABASE_URL ?? serverEnv?.EXTERNAL_SUPABASE_URL;
  const anonKey =
    config?.anonKey ?? import.meta.env.EXTERNAL_SUPABASE_ANON_KEY ?? serverEnv?.EXTERNAL_SUPABASE_ANON_KEY;

  if (!url || !anonKey) throw new Error("Configuração pública do banco não foi carregada.");

  client = createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get: (_target, property) => Reflect.get(getClient(), property),
});
