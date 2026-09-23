import { fetchAll } from "@/lib/paginate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { daysSince, formatCurrency, heatClass, validateMove, type KanbanColumn, type Lead } from "@/lib/leadtrack";
import { toast } from "sonner";
import { moveLead, useLeadTrackBase } from "@/lib/leadtrack-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kanban de leads | LeadTrack" },
      { name: "description", content: "Acompanhe o funil de vendas por etapa e veja há quanto tempo cada lead está parado." },
      { property: "og:title", content: "Kanban de leads | LeadTrack" },
      { property: "og:description", content: "Acompanhe o funil de vendas por etapa e veja há quanto tempo cada lead está parado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <KanbanPage />
    </AppShell>
  ),
});

function KanbanPage() {
  const qc = useQueryClient();
  const { columns, profiles, stalledDays } = useLeadTrackBase();

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("leads").select("*").is("converted_at", null).order("updated_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as Lead[];
    },
  });

  async function handleMove(lead: Lead, column: KanbanColumn) {
    const { count } = await supabase
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", lead.id);
    let lossReason: string | null = lead.loss_reason;
    if (column.requires_loss) {
      lossReason = window.prompt("Motivo da perda:", lead.loss_reason ?? "");
      if (lossReason === null) return;
    }
    const problem = validateMove(column, count ?? 0, lossReason);
    if (problem) {
      toast.error(problem);
      return;
    }
    const error = await moveLead(lead, column, lossReason);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(`Lead movido para "${column.label}".`);
    void qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kanban</h1>
        <Link to="/leads" className="text-sm text-primary underline">
          Ver lista de leads
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((column) => {
          const items = leads.filter((l) => l.status === column.key);
          return (
            <div key={column.id} className="w-72 shrink-0 rounded-lg bg-muted/40 p-2">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                <span className="text-sm font-medium">{column.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((lead) => {
                  const days = daysSince(lead.last_interaction_at ?? lead.updated_at);
                  return (
                    <div key={lead.id} className="rounded-md border bg-card p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${heatClass(days, stalledDays)}`} />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/leads/$leadId"
                            params={{ leadId: lead.id }}
                            className="block truncate font-medium hover:underline"
                          >
                            {lead.contact_name}
                          </Link>
                          {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.company}</p>}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(lead.estimated_value)} · {days}d sem movimento
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {profiles.find((p) => p.id === lead.owner_id)?.name ?? "Sem responsável"}
                          </p>
                        </div>
                      </div>
                      <select
                        className="mt-2 w-full rounded border bg-background px-2 py-1 text-xs"
                        value={lead.status}
                        onChange={(e) => {
                          const next = columns.find((c) => c.key === e.target.value);
                          if (next) void handleMove(lead, next);
                        }}
                      >
                        {columns.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="px-1 py-4 text-xs text-muted-foreground">Nenhum lead.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
