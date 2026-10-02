import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { fetchAll, usePaged } from "@/lib/paginate";

export const Route = createFileRoute("/lixeira")({
  head: () => ({
    meta: [
      { title: "Lixeira | LeadTrack" },
      { name: "description", content: "Leads e clientes excluídos nos últimos 30 dias, com opção de restaurar." },
      { property: "og:title", content: "Lixeira | LeadTrack" },
      { property: "og:description", content: "Leads e clientes excluídos nos últimos 30 dias, com opção de restaurar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <LixeiraPage />
    </AppShell>
  ),
});

type Item = { id: string; table_name: string; label: string | null; deleted_by: string | null; deleted_at: string };

function LixeiraPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const { profiles } = useLeadTrackBase();
  const { data: items = [] } = useQuery({
    queryKey: ["trash"],
    enabled: isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data, error } = await fetchAll((f, t) =>
        supabase.from("trash").select("id,table_name,label,deleted_by,deleted_at").gte("deleted_at", since).order("deleted_at", { ascending: false }).range(f, t),
      );
      if (error) throw error;
      return data as Item[];
    },
  });
  const pg = usePaged(items);

  async function restore(i: Item) {
    const { error } = await supabase.rpc("restore_from_trash", { _id: i.id });
    if (error) return toast.error(error.message);
    toast.success(`${i.table_name === "leads" ? "Lead" : "Cliente"} restaurado.`);
    void qc.invalidateQueries();
  }

  async function purge(i: Item) {
    if (!window.confirm("Excluir definitivamente? Não será possível desfazer.")) return;
    const { error } = await supabase.from("trash").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["trash"] });
  }

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores acessam a Lixeira.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Lixeira</h1>
        <p className="text-sm text-muted-foreground">Leads e clientes excluídos ficam aqui por 30 dias.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-2">Tipo</th><th className="p-2">Nome</th><th className="p-2">Excluído por</th>
              <th className="p-2">Excluído em</th><th className="p-2">Expira em</th><th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {pg.rows.map((i) => {
              const days = Math.max(0, 30 - Math.floor((Date.now() - new Date(i.deleted_at).getTime()) / 864e5));
              return (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{i.table_name === "leads" ? "Lead" : "Cliente"}</td>
                  <td className="p-2 font-medium">{i.label ?? "—"}</td>
                  <td className="p-2">{profiles.find((p) => p.id === i.deleted_by)?.name ?? "—"}</td>
                  <td className="p-2">{new Date(i.deleted_at).toLocaleString("pt-BR")}</td>
                  <td className="p-2">{days} dias</td>
                  <td className="p-2 text-right whitespace-nowrap">
                    <Button size="sm" onClick={() => void restore(i)}>Restaurar</Button>{" "}
                    <Button size="sm" variant="ghost" onClick={() => void purge(i)}>Excluir de vez</Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">A lixeira está vazia.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  );
}
