import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers = new Headers();

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    return next({ headers });
  },
);
