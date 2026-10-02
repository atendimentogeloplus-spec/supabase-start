import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, usePaged } from "@/lib/paginate";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/leadtrack";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de alterações | LeadTrack" },
      { name: "description", content: "Quem cadastrou, alterou ou excluiu cada registro do sistema." },
      { property: "og:title", content: "Histórico de alterações | LeadTrack" },
      { property: "og:description", content: "Quem cadastrou, alterou ou excluiu cada registro do sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <HistoricoPage />
    </AppShell>
  ),
});

const TABLES: Record<string, string> = {
  stock_movements: "Movimentação de estoque",
  purchase_orders: "Pedido de compra",
  products: "Produto",
  clients: "Cliente",
  leads: "Lead",
  suppliers: "Fornecedor",
  stock_minimums: "Estoque mínimo",
  user_roles: "Função de usuário",
};
const ACTIONS: Record<string, string> = { INSERT: "Cadastrou", UPDATE: "Alterou", DELETE: "Excluiu" };

type Row = { id: string; user_id: string | null; table_name: string; action: string; label: string | null; detail: Record<string, unknown> | null; created_at: string };

function describe(r: Row): string {
  const d = r.detail ?? {};
  if (r.table_name === "stock_movements" && r.action === "INSERT") {
    const kind = d["kind"] === "entrada" ? "Entrada" : "Saída";
    const mod = d["modality"] === "guarda" ? "Guarda" : "Lisos";
    return `${kind} de ${d["quantity"]} (${mod})${d["note"] ? ` — ${d["note"]}` : ""}`;
  }
  if (r.action === "UPDATE") {
    const keys = Object.keys(d);
    return keys.length ? `Campos: ${keys.join(", ")}` : "";
  }
  return "";
}

function HistoricoPage() {
  const { isAdmin } = useAuth();
  const { profiles } = useLeadTrackBase();
  const [search, setSearch] = useState("");
  const [table, setTable] = useState("");
  const [user, setUser] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["audit_log"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("audit_log").select("*").order("created_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as Row[];
    },
  });

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores podem ver o histórico.</p>;

  const name = (id: string | null) => (id ? profiles.find((p) => p.id === id)?.name ?? "—" : "Sistema");
  const term = search.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    (!table || r.table_name === table) &&
    (!user || r.user_id === user) &&
    (!term || [r.label, describe(r), name(r.user_id)].some((v) => v?.toLowerCase().includes(term))),
  );
  const pg = usePaged(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Histórico de alterações</h1>
        <Input placeholder="Buscar…" className="w-full sm:w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={table} onChange={(e) => setTable(e.target.value)}>
          <option value="">Tudo</option>
          {Object.entries(TABLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">Todos os usuários</option>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-3">Data</th><th className="p-3">Usuário</th><th className="p-3">Ação</th><th className="p-3">Onde</th><th className="p-3">Registro</th><th className="p-3">Detalhe</th></tr>
          </thead>
          <tbody>
            {pg.rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap text-muted-foreground">{formatDateTime(r.created_at)}</td>
                <td className="p-3">{name(r.user_id)}</td>
                <td className="p-3">{ACTIONS[r.action] ?? r.action}</td>
                <td className="p-3">{TABLES[r.table_name] ?? r.table_name}</td>
                <td className="p-3">{r.label ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{describe(r)}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma alteração registrada ainda.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  );
}
