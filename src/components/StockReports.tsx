import { useState } from "react";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtNum } from "@/lib/leadtrack";

type Product = { id: string; name: string; unit: string };
type Client = { id: string; name: string };
type Movement = { id: string; product_id: string; kind: "entrada" | "saida"; modality: "lisos" | "guarda"; client_id: string | null; quantity: number; note: string | null; created_at: string };
type Order = {
  id: string; number: string; supplier: string | null; client_id: string | null; status: string; created_at: string;
  expected_date: string | null; purchase_order_items: { product_id: string; quantity: number; delivered_qty?: number }[];
};

const ORDER_STATUS: Record<string, string> = { a_enviar: "A Enviar", enviado: "Enviado/Em produção", parcial: "Entrega parcial", entregue: "Entregue" };
const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const today = () => new Date().toISOString().slice(0, 10);

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch("/icon-512.png")).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
  } catch { return null; }
}

/** Período: diário, semanal (seg–dom), mensal ou total, a partir de uma data de referência. */
export function periodRange(period: string, ref: string): { from: Date | null; to: Date | null; label: string } {
  if (period === "total") return { from: null, to: null, label: "Todo o período" };
  const d = new Date(ref + "T00:00:00");
  let from = new Date(d), to = new Date(d);
  if (period === "semanal") { const w = (d.getDay() + 6) % 7; from.setDate(d.getDate() - w); to = new Date(from); to.setDate(from.getDate() + 6); }
  if (period === "mensal") { from = new Date(d.getFullYear(), d.getMonth(), 1); to = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  to.setHours(23, 59, 59, 999);
  const label = period === "diario" ? `Dia ${from.toLocaleDateString("pt-BR")}` : `${from.toLocaleDateString("pt-BR")} a ${to.toLocaleDateString("pt-BR")}`;
  return { from, to, label };
}

async function makePdf(title: string, subtitle: string, sections: { title: string; head: string[]; body: string[][] }[], file: string) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();
  doc.setFillColor(232, 221, 203); doc.rect(0, 0, w, 30, "F");
  if (logo) doc.addImage(logo, "PNG", 10, 4, 22, 22);
  doc.setTextColor(40, 30, 20); doc.setFontSize(16); doc.text(title, 38, 14);
  doc.setFontSize(9); doc.text(subtitle, 38, 21);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - 10, 14, { align: "right" });
  let y = 38;
  for (const s of sections) {
    doc.setFontSize(12); doc.setTextColor(40, 30, 20); doc.text(s.title, 10, y);
    autoTable(doc, {
      startY: y + 3, head: [s.head], body: s.body.length ? s.body : [["Nenhum registro", ...s.head.slice(1).map(() => "")]],
      styles: { fontSize: 8 }, headStyles: { fillColor: [176, 110, 52] }, margin: { left: 10, right: 10 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }
  doc.save(file);
}

function makeCsv(sections: { title: string; head: string[]; body: string[][] }[], file: string) {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  for (const s of sections) { lines.push(esc(s.title), s.head.map(esc).join(";"), ...s.body.map((r) => r.map(esc).join(";")), ""); }
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = file; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function FormatButtons({ busy, run }: { busy: boolean; run: (f: "pdf" | "csv") => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button className="sm:flex-1" disabled={busy} onClick={() => run("pdf")}><FileDown className="h-4 w-4" />{busy ? "Gerando…" : "Baixar PDF"}</Button>
      <Button className="sm:flex-1" variant="outline" disabled={busy} onClick={() => run("csv")}>Baixar Excel (CSV)</Button>
    </div>
  );
}

/* ---------------- Relatório de estoque (Saídas e Gestão) ---------------- */
export function StockReportButton({ products, clients, movements, defaultModality = "lisos" }: { products: Product[]; clients: Client[]; movements: Movement[]; defaultModality?: "lisos" | "guarda" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("mensal");
  const [ref, setRef] = useState(today());
  const [mod, setMod] = useState<"lisos" | "guarda" | "ambos">(defaultModality);
  const [withList, setWithList] = useState(true);
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cname = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "—" : "—");

  async function run(fmt: "pdf" | "csv") {
    setBusy(true);
    try {
      const { from, to, label } = periodRange(period, ref || today());
      const mods = mod === "ambos" ? ["lisos", "guarda"] : [mod];
      const sections: { title: string; head: string[]; body: string[][] }[] = [];
      for (const m of mods) {
        const list = movements.filter((x) => x.modality === m);
        const rows = new Map<string, { pid: string; cid: string | null; ini: number; ent: number; sai: number }>();
        for (const x of list) {
          const t = new Date(x.created_at);
          if (to && t > to) continue;
          const key = `${m === "guarda" ? x.client_id ?? "" : ""}|${x.product_id}`;
          const r = rows.get(key) ?? { pid: x.product_id, cid: m === "guarda" ? x.client_id : null, ini: 0, ent: 0, sai: 0 };
          const q = Number(x.quantity);
          if (from && t < from) r.ini += x.kind === "entrada" ? q : -q;
          else if (x.kind === "entrada") r.ent += q; else r.sai += q;
          rows.set(key, r);
        }
        const body = [...rows.values()]
          .filter((r) => r.ini || r.ent || r.sai)
          .sort((a, b) => cname(a.cid).localeCompare(cname(b.cid)) || pname(a.pid).localeCompare(pname(b.pid)))
          .map((r) => [...(m === "guarda" ? [cname(r.cid)] : []), pname(r.pid), fmtNum(r.ini), fmtNum(r.ent), fmtNum(r.sai), fmtNum(r.ini + r.ent - r.sai)]);
        const tot = [...rows.values()].reduce((s, r) => ({ ini: s.ini + r.ini, ent: s.ent + r.ent, sai: s.sai + r.sai }), { ini: 0, ent: 0, sai: 0 });
        body.push([...(m === "guarda" ? [""] : []), "TOTAL", fmtNum(tot.ini), fmtNum(tot.ent), fmtNum(tot.sai), fmtNum(tot.ini + tot.ent - tot.sai)]);
        const name = m === "lisos" ? "Lisos" : "Guarda";
        sections.push({ title: `Estoque de ${name} — saldo e movimentação`, head: [...(m === "guarda" ? ["Cliente"] : []), "Produto", "Saldo inicial", "Entradas", "Saídas", "Saldo final"], body });
        if (withList) {
          const mv = list.filter((x) => { const t = new Date(x.created_at); return (!from || t >= from) && (!to || t <= to); })
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((x) => [new Date(x.created_at).toLocaleString("pt-BR"), x.kind === "entrada" ? "Entrada" : "Saída", pname(x.product_id), ...(m === "guarda" ? [cname(x.client_id)] : []), fmtNum(x.quantity), x.note ?? ""]);
          sections.push({ title: `Movimentações de ${name} no período`, head: ["Data", "Tipo", "Produto", ...(m === "guarda" ? ["Cliente"] : []), "Qtd", "Obs."], body: mv });
        }
      }
      const file = `relatorio-estoque-${today()}.${fmt}`;
      if (fmt === "pdf") await makePdf("Relatório de Estoque", label, sections, file);
      else makeCsv(sections, file);
      setOpen(false);
    } catch (e) {
      toast.error("Não foi possível gerar o relatório.");
      console.error(e);
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(true)}><FileDown className="h-4 w-4" />Relatório</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Relatório de estoque</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Estoque</Label>
              <select className={sel} value={mod} onChange={(e) => setMod(e.target.value as typeof mod)}>
                <option value="lisos">Lisos</option><option value="guarda">Guarda</option><option value="ambos">Lisos e Guarda</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Período</Label>
                <select className={sel} value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value="diario">Diário</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option><option value="total">Total</option>
                </select>
              </div>
              {period !== "total" && (
                <div className="space-y-1.5">
                  <Label>{period === "diario" ? "Dia" : period === "semanal" ? "Semana do dia" : "Mês do dia"}</Label>
                  <Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withList} onChange={(e) => setWithList(e.target.checked)} />
              Incluir a lista de entradas e saídas do período
            </label>
            <p className="text-xs text-muted-foreground">Mostra, por produto, o saldo no início do período, as entradas, as saídas e o saldo no final.</p>
            <FormatButtons busy={busy} run={(f) => void run(f)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------- Relatório de pedidos ---------------- */
export function OrdersReportButton({ products, clients, orders }: { products: Product[]; clients: Client[]; orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState<string[]>(Object.keys(ORDER_STATUS));
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cname = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "—" : "—");

  async function run(fmt: "pdf" | "csv") {
    if (!chosen.length) return void toast.error("Escolha ao menos um status.");
    setBusy(true);
    try {
      const list = orders.filter((o) => chosen.includes(o.status)).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const body = list.map((o) => [
        o.number, fmtDate(o.created_at), o.expected_date ? fmtDate(o.expected_date + "T12:00:00") : "—", o.supplier ?? "—", cname(o.client_id),
        o.purchase_order_items.map((i) => `${fmtNum(i.quantity)} × ${pname(i.product_id)}${i.delivered_qty ? ` (entregue ${fmtNum(i.delivered_qty)})` : ""}`).join("; "),
        ORDER_STATUS[o.status] ?? o.status,
      ]);
      const all = chosen.length === Object.keys(ORDER_STATUS).length;
      const sub = `${all ? "Todos os pedidos" : chosen.map((s) => ORDER_STATUS[s]).join(", ")} • ${list.length} pedido(s)`;
      const sections = [{ title: "Pedidos", head: ["Pedido", "Data", "Previsão", "Fornecedor", "Cliente", "Itens", "Status"], body }];
      const file = `relatorio-pedidos-${today()}.${fmt}`;
      if (fmt === "pdf") await makePdf("Relatório de Pedidos", sub, sections, file);
      else makeCsv(sections, file);
      setOpen(false);
    } catch (e) {
      toast.error("Não foi possível gerar o relatório.");
      console.error(e);
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="outline" className="w-full md:w-auto" onClick={() => setOpen(true)}><FileDown className="h-4 w-4" />Relatório</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Relatório de pedidos</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Status incluídos</Label>
            <div className="space-y-2">
              {Object.entries(ORDER_STATUS).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={chosen.includes(k)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, k] : c.filter((x) => x !== k)))} />
                  {label}
                </label>
              ))}
            </div>
            <button type="button" className="text-xs underline text-muted-foreground" onClick={() => setChosen(Object.keys(ORDER_STATUS))}>Marcar todos</button>
            <FormatButtons busy={busy} run={(f) => void run(f)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
