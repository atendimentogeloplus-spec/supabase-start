import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, usePaged } from "@/lib/paginate";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { formatDateTime, type Lead } from "@/lib/leadtrack";

export const Route = createFileRoute("/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira geral | LeadTrack" },
      { name: "description", content: "Leads perdidos com motivo da perda e primeira vendedora que atendeu." },
      { property: "og:title", content: "Carteira geral | LeadTrack" },
      { property: "og:description", content: "Leads perdidos com motivo da perda e primeira vendedora que atendeu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <CarteiraPage />
    </AppShell>
  ),
});

type LostLead = Lead & { first_owner_id: string | null };

function CarteiraPage() {
  const { columns, profiles } = useLeadTrackBase();
  const [search, setSearch] = useState("");
  const lostKeys = columns.filter((c) => c.is_lost).map((c) => c.key);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads", "lost", lostKeys.join(",")],
    enabled: lostKeys.length > 0,
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) =>
        supabase.from("leads").select("*").in("status", lostKeys).order("updated_at", { ascending: false }).range(f, t),
      );
      if (error) throw error;
      return data as LostLead[];
    },
  });

  const term = search.trim().toLowerCase();
  const filtered = leads.filter(
    (l) => !term || [l.contact_name, l.company, l.phone, l.loss_reason].some((v) => v?.toLowerCase().includes(term)),
  );
  const pg = usePaged(filtered);
  const name = (id: string | null) => profiles.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Carteira geral</h1>
        <Input placeholder="Buscar por nome, empresa, motivo…" className="w-full sm:w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Contato</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Telefone</th>
              <th className="p-3">Motivo da perda</th>
              <th className="p-3">Primeira vendedora</th>
              <th className="p-3">Perdido em</th>
            </tr>
          </thead>
          <tbody>
            {pg.rows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="p-3">
                  <Link to="/leads/$leadId" params={{ leadId: l.id }} className="font-medium hover:underline">{l.contact_name}</Link>
                </td>
                <td className="p-3 text-muted-foreground">{l.company ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.phone ?? "—"}</td>
                <td className="p-3 whitespace-pre-wrap">{l.loss_reason ?? "—"}</td>
                <td className="p-3">{name(l.first_owner_id ?? l.owner_id)}</td>
                <td className="p-3 text-muted-foreground">{formatDateTime(l.updated_at)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum lead perdido.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  );
}
