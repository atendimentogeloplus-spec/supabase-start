import { fetchAll } from "@/lib/paginate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { moveLead, useLeadTrackBase } from "@/lib/leadtrack-data";
import { useAuth } from "@/hooks/useAuth";
import {
  INTERACTION_LABELS,
  formatCurrency,
  formatDateTime,
  validateMove,
  type Interaction,
  type InteractionType,
  type Lead,
} from "@/lib/leadtrack";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/leads/$leadId")({
  head: () => ({
    meta: [
      { title: "Detalhe do lead | LeadTrack" },
      { name: "description", content: "Histórico de interações, etapa atual e dados de contato do lead." },
      { property: "og:title", content: "Detalhe do lead | LeadTrack" },
      { property: "og:description", content: "Histórico de interações, etapa atual e dados de contato do lead." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <LeadDetail />
    </AppShell>
  ),
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { columns, profiles, sources } = useLeadTrackBase();
  const [type, setType] = useState<InteractionType>("call");
  const [summary, setSummary] = useState("");

  const { data: lead } = useQuery({
    queryKey: ["lead", leadId],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
      if (error) throw error;
      return data as Lead | null;
    },
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["interactions", leadId],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase
        .from("interactions")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as Interaction[];
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["audit", leadId],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase
        .from("lead_audit")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as { id: string; action: string; detail: string | null; created_at: string }[];
    },
  });

  if (!lead) return <p className="text-muted-foreground">Carregando lead…</p>;

  async function addInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;
    const { error } = await supabase.from("interactions").insert({
      lead_id: leadId,
      user_id: user?.id ?? null,
      type,
      summary: summary.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("leads").update({ last_interaction_at: new Date().toISOString() }).eq("id", leadId);
    setSummary("");
    toast.success("Interação registrada.");
    void qc.invalidateQueries({ queryKey: ["interactions", leadId] });
    void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
  }

  async function changeStatus(key: string) {
    const column = columns.find((c) => c.key === key);
    if (!column || !lead) return;
    let lossReason: string | null = lead.loss_reason;
    if (column.requires_loss) {
      lossReason = window.prompt("Motivo da perda:", lead.loss_reason ?? "");
      if (lossReason === null) return;
    }
    const problem = validateMove(column, interactions.length, lossReason);
    if (problem) {
      toast.error(problem);
      return;
    }
    const error = await moveLead(lead, column, lossReason);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Etapa atualizada.");
    void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    void qc.invalidateQueries({ queryKey: ["audit", leadId] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
  }

  async function changeOwner(ownerId: string) {
    const { error } = await supabase
      .from("leads")
      .update({ owner_id: ownerId || null, assigned_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Responsável atualizado.");
    void qc.invalidateQueries({ queryKey: ["lead", leadId] });
  }

  return (
    <div className="space-y-4">
      <Link to="/leads" className="text-sm text-muted-foreground underline">
        ← Voltar para leads
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{lead.contact_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Empresa:</span> {lead.company ?? "—"}</p>
            <p><span className="text-muted-foreground">Telefone:</span> {lead.phone ?? "—"}</p>
            <p><span className="text-muted-foreground">E-mail:</span> {lead.email ?? "—"}</p>
            <p><span className="text-muted-foreground">Origem:</span> {sources.find((s) => s.id === lead.source_id)?.name ?? "—"}</p>
            <p><span className="text-muted-foreground">Valor estimado:</span> {formatCurrency(lead.estimated_value)}</p>
            <p><span className="text-muted-foreground">Último contato:</span> {formatDateTime(lead.last_interaction_at)}</p>
            {lead.loss_reason && <p><span className="text-muted-foreground">Motivo da perda:</span> {lead.loss_reason}</p>}
            {lead.notes && <p className="whitespace-pre-wrap text-muted-foreground">{lead.notes}</p>}

            <div className="space-y-1.5 pt-2">
              <Label>Etapa</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={lead.status}
                onChange={(e) => void changeStatus(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={lead.owner_id ?? ""}
                  onChange={(e) => void changeOwner(e.target.value)}
                >
                  <option value="">Sem responsável</option>
                  {profiles
                    .filter((p) => p.status === "active")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registrar interação</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={addInteraction}>
                <select
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={type}
                  onChange={(e) => setType(e.target.value as InteractionType)}
                >
                  {Object.entries(INTERACTION_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <Textarea
                  placeholder="O que foi conversado?"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                />
                <Button type="submit">Salvar interação</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de interações ({interactions.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {interactions.map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-sm">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{INTERACTION_LABELS[item.type] ?? item.type}</span>
                    <span>{formatDateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{item.summary}</p>
                </div>
              ))}
              {interactions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma interação ainda.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mudanças de etapa</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {audit.map((row) => (
                <p key={row.id} className="text-muted-foreground">
                  {formatDateTime(row.created_at)} · {row.detail ?? row.action}
                </p>
              ))}
              {audit.length === 0 && <p className="text-muted-foreground">Sem alterações registradas.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
