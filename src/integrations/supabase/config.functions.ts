import { createServerFn } from "@tanstack/react-start";

export const getSupabasePublicConfig = createServerFn({ method: "GET" }).handler(async () => ({
  url: process.env.EXTERNAL_SUPABASE_URL ?? "",
  anonKey: process.env.EXTERNAL_SUPABASE_ANON_KEY ?? "",
}));