import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { KanbanColumn, Lead, Profile, Source } from "@/lib/leadtrack";

export function useLeadTrackBase() {
  const { data: columns = [] } = useQuery({
    queryKey: ["kanban_columns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("kanban_columns").select("*").order("position");
      if (error) throw error;
      return data as KanbanColumn[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: sources = [] } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sources").select("*").eq("active", true).order("name");
      if (error) throw error;
      return data as Source[];
    },
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("key,value");
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.key, row.value])) as Record<string, string>;
    },
  });

  const stalledDays = Number(settings["stalled_days"] ?? 5) || 5;

  return { columns, profiles, sources, settings, stalledDays };
}

/** Salva a mudança de etapa e registra o histórico. Retorna a mensagem de erro, se houver. */
export async function moveLead(lead: Lead, column: KanbanColumn, lossReason: string | null): Promise<string | null> {
  const { error } = await supabase
    .from("leads")
    .update({ status: column.key, loss_reason: column.requires_loss ? lossReason : null })
    .eq("id", lead.id);
  if (error) return error.message;

  const { data: userData } = await supabase.auth.getUser();
  await supabase.from("lead_audit").insert({
    lead_id: lead.id,
    user_id: userData.user?.id ?? null,
    action: "status_change",
    from_status: lead.status,
    to_status: column.key,
    detail: lossReason ?? null,
  });
  return null;
}
