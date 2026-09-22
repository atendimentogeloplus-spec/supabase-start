import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações | LeadTrack" },
      { name: "description", content: "Ajuste etapas do funil, origens de leads e o prazo de alerta para leads parados." },
      { property: "og:title", content: "Configurações | LeadTrack" },
      { property: "og:description", content: "Ajuste etapas do funil, origens de leads e o prazo de alerta para leads parados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <ConfigPage />
    </AppShell>
  ),
});

function ConfigPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { columns, settings } = useLeadTrackBase();
  const [newSource, setNewSource] = useState("");
  const [stalled, setStalled] = useState("");

  const { data: sources = [] } = useQuery({
    queryKey: ["all_sources"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sources").select("*").order("name");
      if (error) throw error;
      return data as { id: string; name: string; active: boolean }[];
    },
  });

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores acessam esta página.</p>;

  async function saveStalled() {
    const value = String(Number(stalled || settings["stalled_days"] || 5));
    const { error } = await supabase.from("settings").upsert({ key: "stalled_days", value }, { onConflict: "key" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Prazo de alerta salvo.");
    void qc.invalidateQueries({ queryKey: ["settings"] });
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSource.trim()) return;
    const { error } = await supabase.from("sources").insert({ name: newSource.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewSource("");
    void qc.invalidateQueries({ queryKey: ["all_sources"] });
    void qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function toggleSource(id: string, active: boolean) {
    await supabase.from("sources").update({ active }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["all_sources"] });
    void qc.invalidateQueries({ queryKey: ["sources"] });
  }

  async function updateColumn(id: string, patch: { min_interactions?: number; label?: string }) {
    const { error } = await supabase.from("kanban_columns").update(patch).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["kanban_columns"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Configurações</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerta de lead parado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stalled">Dias sem contato</Label>
            <Input
              id="stalled"
              type="number"
              min={1}
              className="w-32"
              value={stalled || (settings["stalled_days"] ?? "5")}
              onChange={(e) => setStalled(e.target.value)}
            />
          </div>
          <Button onClick={() => void saveStalled()}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapas do funil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {columns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
              <Input
                className="w-48"
                defaultValue={c.label}
                onBlur={(e) => e.target.value !== c.label && void updateColumn(c.id, { label: e.target.value })}
              />
              <Label className="text-xs text-muted-foreground">Mín. interações</Label>
              <Input
                type="number"
                min={0}
                className="w-20"
                defaultValue={c.min_interactions}
                onBlur={(e) =>
                  Number(e.target.value) !== c.min_interactions &&
                  void updateColumn(c.id, { min_interactions: Number(e.target.value) })
                }
              />
              {c.requires_loss && <span className="text-xs text-muted-foreground">exige motivo de perda</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Origens de leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <form className="flex gap-2" onSubmit={addSource}>
            <Input placeholder="Nova origem" value={newSource} onChange={(e) => setNewSource(e.target.value)} />
            <Button type="submit">Adicionar</Button>
          </form>
          <div className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <span className={s.active ? "" : "text-muted-foreground line-through"}>{s.name}</span>
                <Button size="sm" variant="outline" onClick={() => void toggleSource(s.id, !s.active)}>
                  {s.active ? "Desativar" : "Ativar"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
