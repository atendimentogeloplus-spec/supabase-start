import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY =
  "BOaffE_wOycbC6J7PUJ2D3hppw9VGjAM1r_RwTlDeAJVFLMv2Mdl6hPOGw9CB4EhaDha0WjtZXD-75ovhhBVkc0";

function toUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function enablePush(userId: string) {
  if (!pushSupported()) throw new Error("Este aparelho não suporta notificações. No iPhone, instale o sistema na tela inicial primeiro.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão negada. Libere as notificações nas configurações do navegador.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  void userId;
  const { error } = await supabase.rpc("save_push_subscription" as never, { _endpoint: j.endpoint, _p256dh: j.keys.p256dh, _auth: j.keys.auth } as never);
  if (error) throw error;
}
