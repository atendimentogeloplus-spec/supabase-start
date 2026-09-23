import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { VAPID_PUBLIC_KEY } from "@/lib/push";

export const Route = createFileRoute("/api/public/push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = z.object({ id: z.string().uuid() }).safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("bad request", { status: 400 });
        const privateKey = process.env["VAPID_PRIVATE_KEY"];
        if (!privateKey) return new Response("not configured", { status: 500 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Só envia avisos reais ainda não enviados (evita abuso da rota pública)
        const { data: n } = await supabaseAdmin
          .from("notifications")
          .update({ pushed_at: new Date().toISOString() } as never)
          .eq("id", parsed.data.id)
          .is("pushed_at" as never, null)
          .select("id, user_id, title, body")
          .maybeSingle();
        if (!n) return new Response("ok");

        const { data: subs } = await supabaseAdmin
          .from("push_subscriptions" as never)
          .select("id, endpoint, p256dh, auth")
          .eq("user_id", (n as { user_id: string }).user_id);

        const vapid = { subject: "mailto:renato.c2eventos@gmail.com", publicKey: VAPID_PUBLIC_KEY, privateKey };
        const note = n as { title: string; body: string | null };
        await Promise.all(
          ((subs ?? []) as { id: string; endpoint: string; p256dh: string; auth: string }[]).map(async (s) => {
            try {
              const payload = await buildPushPayload(
                { data: JSON.stringify({ title: note.title, body: note.body ?? "", url: "/avisos" }), options: { ttl: 86400 } },
                { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
                vapid,
              );
              const res = await fetch(s.endpoint, payload);
              if (res.status === 404 || res.status === 410) {
                await supabaseAdmin.from("push_subscriptions" as never).delete().eq("id", s.id);
              }
            } catch (e) {
              console.error("push failed", e);
            }
          }),
        );
        return new Response("ok");
      },
    },
  },
});
