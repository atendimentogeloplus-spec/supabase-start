import { createMiddleware } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export const requireSupabaseAuth = createMiddleware().server(
  async ({ next, request }) => {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      throw new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    // Create a client authenticated as the requesting user (RLS applies).
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

    const supabase = createClient<Database>(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Validate the token with Supabase Auth.
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Response("Unauthorized", { status: 401 });
    }

    return next({
      context: {
        supabase,
        userId: user.id,
        claims: user,
      },
    });
  },
);
