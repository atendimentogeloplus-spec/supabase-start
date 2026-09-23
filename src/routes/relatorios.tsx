import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Pager } from "@/components/Pager";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll, usePaged } from "@/lib/paginate";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { daysSince, formatCurrency, type Lead } from "@/lib/leadtrack";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown } from "lucide-react";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios | LeadTrack" },
      { name: "description", content: "Relatórios de leads com filtros e exportação em PDF." },
      { property: "og:title", content: "Relatórios | LeadTrack" },
      { property: "og:description", content: "Relatórios de leads com filtros e exportação em PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ReportsPage />
    </AppShell>
  ),
});

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch("/icon-512.png")).blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function ReportsPage() {
  const { columns, profiles, sources } = useLeadTrackBase();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("leads").select("*").order("updated_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as Lead[];
    },
  });

  const colName = (k: string) => columns.find((c) => c.key === k)?.label ?? k;
  const ownerName = (id: string | null) => profiles.find((p) => p.id === id)?.name || "—";
  const sourceName = (id: string | null) => sources.find((s) => s.id === id)?.name || "—";

  const filtered = leads.filter((l) => {
    const term = search.trim().toLowerCase();
    if (term && ![l.contact_name, l.company, l.phone, l.email].some((v) => v?.toLowerCase().includes(term))) return false;
    if (status && l.status !== status) return false;
    if (owner && l.owner_id !== owner) return false;
    if (source && l.source_id !== source) return false;
    const d = l.created_at.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  const pg = usePaged(filtered);
  const total = filtered.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);

  async function generatePdf() {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape" });
      const w = doc.internal.pageSize.getWidth();
      const logo = await loadLogo();
      doc.setFillColor(232, 221, 203);
      doc.rect(0, 0, w, 32, "F");
      if (logo) doc.addImage(logo, "PNG", 10, 4, 24, 24);
      doc.setTextColor(40, 30, 20);
      doc.setFontSize(18);
      doc.text("Relatório de Leads", 40, 15);
      doc.setFontSize(9);
      const filters = [
        status && `Etapa: ${colName(status)}`,
        owner && `Responsável: ${ownerName(owner)}`,
        source && `Origem: ${sourceName(source)}`,
        from && `De: ${from.split("-").reverse().join("/")}`,
        to && `Até: ${to.split("-").reverse().join("/")}`,
        search && `Busca: "${search}"`,
      ].filter(Boolean).join("  •  ") || "Sem filtros";
      doc.text(filters, 40, 22);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - 10, 15, { align: "right" });
      doc.text(`${filtered.length} leads  •  Total estimado ${formatCurrency(total)}`, w - 10, 22, { align: "right" });
      autoTable(doc, {
        startY: 38,
        head: [["Contato", "Empresa", "Telefone", "Etapa", "Responsável", "Origem", "Valor", "Criado", "Dias s/ contato"]],
        body: filtered.map((l) => [
          l.contact_name,
          l.company ?? "—",
          l.phone ?? "—",
          colName(l.status),
          ownerName(l.owner_id),
          sourceName(l.source_id),
          formatCurrency(l.estimated_value),
          new Date(l.created_at).toLocaleDateString("pt-BR"),
          String(daysSince(l.last_interaction_at ?? l.created_at)),
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [120, 90, 55] },
        alternateRowStyles: { fillColor: [247, 242, 234] },
        didDrawPage: () => {
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(`Página ${doc.getNumberOfPages()}`, w - 10, doc.internal.pageSize.getHeight() - 6, { align: "right" });
        },
      });
      doc.save(`relatorio-leads-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <Button onClick={generatePdf} disabled={busy || filtered.length === 0}>
          <FileDown className="mr-2 h-4 w-4" /> {busy ? "Gerando..." : "Gerar PDF"}
        </Button>
      </div>
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 lg:col-span-2">
          <Label>Busca</Label>
          <Input placeholder="Nome, empresa, telefone ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Etapa</Label>
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {columns.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Responsável</Label>
          <select className={sel} value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Todos</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name || p.email}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Origem</Label>
          <select className={sel} value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Todas</option>
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label>De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label>Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{filtered.length} leads • Total estimado {formatCurrency(total)}</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Contato", "Empresa", "Etapa", "Responsável", "Origem", "Valor", "Criado"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
          </thead>
          <tbody>
            {pg.rows.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2">{l.contact_name}</td>
                <td className="px-3 py-2">{l.company ?? "—"}</td>
                <td className="px-3 py-2">{colName(l.status)}</td>
                <td className="px-3 py-2">{ownerName(l.owner_id)}</td>
                <td className="px-3 py-2">{sourceName(l.source_id)}</td>
                <td className="px-3 py-2">{formatCurrency(l.estimated_value)}</td>
                <td className="px-3 py-2">{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Nenhum lead encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...pg} />
    </div>
  );
}
