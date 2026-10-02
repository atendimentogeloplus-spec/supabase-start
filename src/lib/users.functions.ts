import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      email: z.string().trim().email().max(200),
      phone: z.string().trim().max(40).nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Sem permissão");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: ge } = await supabaseAdmin.auth.admin.getUserById(data.id);
    if (ge || !u.user) throw new Error("Usuário não encontrado");
    const email = data.email.toLowerCase();
    if (u.user.email?.toLowerCase() === "renato.c2eventos@gmail.com" && email !== u.user.email.toLowerCase())
      throw new Error("O e-mail do desenvolvedor protegido não pode ser alterado.");
    if (u.user.email?.toLowerCase() !== email) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { email, email_confirm: true });
      if (error) throw new Error(error.message.includes("already") ? "Este e-mail já está em uso." : error.message);
    }
    const { error } = await supabaseAdmin.from("profiles").update({ name: data.name, email, phone: data.phone || null }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
