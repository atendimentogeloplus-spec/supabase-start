import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Clock, FileDown, PackageSearch, Send, Truck } from "lucide-react";

type Product = { id: string; name: string; unit: string };
type Client = { id: string; name: string };
type Order = {
  id: string; number: string; supplier: string | null; client_id: string | null; status: string;
  stock_confirmed_at: string | null; created_at: string;
  purchase_order_items: { id: string; product_id: string; quantity: number }[];
};
type Movement = { product_id: string; kind: string; modality: string; client_id: string | null; quantity: number };
export type StockMinimum = { id: string; product_id: string; modality: string; client_id: string | null; min_qty: number };

const sel = "w-full rounded-md border bg-background px-2 py-2 text-sm";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const STATUS: Record<string, string> = { a_enviar: "A enviar", enviado: "Enviado", em_producao: "Em Produção", entregue: "Entregue" };

async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch("/icon-512.png")).blob();
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(blob); });
  } catch { return null; }
}

export function StockDashboard({ products, clients, orders, movements, minimums }: {
  products: Product[]; clients: Client[]; orders: Order[]; movements: Movement[]; minimums: StockMinimum[];
}) {
  const qc = useQueryClient();
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cname = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? "—" : "—");
  const items = (o: Order) => o.purchase_order_items.map((i) => `${i.quantity} × ${pname(i.product_id)}`).join(", ");

  const toSend = orders.filter((o) => o.status === "a_enviar");
  const inProgress = orders.filter((o) => o.status === "enviado" || o.status === "em_producao");
  const awaitingEntry = orders.filter((o) => o.status === "entregue" && !o.stock_confirmed_at);

  const balance = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movements) {
      const k = `${m.modality}|${m.client_id ?? ""}|${m.product_id}`;
      map.set(k, (map.get(k) ?? 0) + (m.kind === "entrada" ? Number(m.quantity) : -Number(m.quantity)));
    }
    return map;
  }, [movements]);

  const levels = minimums.map((m) => {
    const cur = balance.get(`${m.modality}|${m.client_id ?? ""}|${m.product_id}`) ?? 0;
    const level = cur <= m.min_qty ? "abaixo" : cur <= m.min_qty * 1.2 ? "proximo" : "ok";
    return { ...m, cur, level };
  });
  const alerts = levels.filter((l) => l.level !== "ok").sort((a, b) => a.cur / (a.min_qty || 1) - b.cur / (b.min_qty || 1));
  const lisosAlerts = alerts.filter((a) => a.modality === "lisos");
  const guardaAlerts = alerts.filter((a) => a.modality === "guarda");

  // form de mínimo
  const [mod, setMod] = useState<"lisos" | "guarda">("lisos");
  const [cid, setCid] = useState(""); const [pid, setPid] = useState(""); const [qty, setQty] = useState("");
  async function saveMin() {
    if (!pid || !(Number(qty) >= 0) || qty === "") return toast.error("Informe produto e quantidade mínima.");
    if (mod === "guarda" && !cid) return toast.error("Selecione o cliente.");
    const client_id = mod === "guarda" ? cid : null;
    const existing = minimums.find((m) => m.product_id === pid && m.modality === mod && m.client_id === client_id);
    const { error } = existing
      ? await supabase.from("stock_minimums").update({ min_qty: Number(qty) }).eq("id", existing.id)
      : await supabase.from("stock_minimums").insert({ product_id: pid, modality: mod, client_id, min_qty: Number(qty) });
    if (error) return toast.error(error.message);
    toast.success("Estoque mínimo salvo."); setQty("");
    void qc.invalidateQueries({ queryKey: ["stock_minimums"] });
  }
  async function removeMin(id: string) {
    const { error } = await supabase.from("stock_minimums").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["stock_minimums"] });
  }

  const [busy, setBusy] = useState(false);
  async function pdf() {
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();
      const w = doc.internal.pageSize.getWidth();
      const logo = await loadLogo();
      doc.setFillColor(232, 221, 203); doc.rect(0, 0, w, 32, "F");
      if (logo) doc.addImage(logo, "PNG", 10, 4, 24, 24);
      doc.setTextColor(40, 30, 20); doc.setFontSize(18); doc.text("Painel de Estoque", 40, 15);
      doc.setFontSize(9);
      doc.text(`A enviar: ${toSend.length}  •  Enviados/Em produção: ${inProgress.length}  •  Aguardando entrada: ${awaitingEntry.length}  •  Alertas de mínimo: ${alerts.length}`, 40, 22);
      doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, w - 10, 15, { align: "right" });
      let y = 40;
      const section = (title: string, head: string[], body: string[][]) => {
        doc.setFontSize(12); doc.setTextColor(40, 30, 20); doc.text(title, 10, y);
        autoTable(doc, {
          startY: y + 3, head: [head], body: body.length ? body : [[`Nenhum registro`, ...head.slice(1).map(() => "")]],
          styles: { fontSize: 8 }, headStyles: { fillColor: [176, 110, 52] }, margin: { left: 10, right: 10 },
        });
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
      };
      const oRow = (o: Order) => [o.number, fmtDate(o.created_at), o.supplier ?? "—", cname(o.client_id), items(o), STATUS[o.status] ?? o.status];
      const oHead = ["Pedido", "Data", "Fornecedor", "Cliente", "Itens", "Status"];
      section("Pedidos a enviar", oHead, toSend.map(oRow));
      section("Pedidos enviados / em produção", oHead, inProgress.map(oRow));
      section("Entregues aguardando confirmação de entrada", oHead, awaitingEntry.map(oRow));
      const aRow = (a: (typeof alerts)[number]) => [pname(a.product_id), cname(a.client_id), String(a.cur), String(a.min_qty), a.level === "abaixo" ? "Abaixo do mínimo" : "Próximo do mínimo"];
      section("Estoque de Lisos próximo do mínimo", ["Produto", "Cliente", "Saldo", "Mínimo", "Situação"], lisosAlerts.map(aRow));
      section("Estoque de Guarda (clientes) próximo do mínimo", ["Produto", "Cliente", "Saldo", "Mínimo", "Situação"], guardaAlerts.map(aRow));
      doc.save(`painel-estoque-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error("Não foi possível gerar o PDF.");
      console.error(e);
    } finally { setBusy(false); }
  }

  const card = (icon: React.ReactNode, label: string, value: number, tone = "") => (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );

  const orderTable = (list: Order[]) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-2">Pedido</th><th className="p-2">Fornecedor</th><th className="p-2">Cliente</th><th className="p-2">Itens</th><th className="p-2">Status</th>
        </tr></thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id} className="border-t align-top">
              <td className="p-2 font-medium">{o.number}<div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div></td>
              <td className="p-2">{o.supplier ?? "—"}</td><td className="p-2">{cname(o.client_id)}</td>
              <td className="p-2">{items(o)}</td><td className="p-2">{STATUS[o.status]}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const alertTable = (list: typeof alerts, showClient: boolean) => (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>
          <th className="p-2">Produto</th>{showClient && <th className="p-2">Cliente</th>}<th className="p-2">Saldo</th><th className="p-2">Mínimo</th><th className="p-2">Situação</th>
        </tr></thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-2">{pname(a.product_id)}</td>{showClient && <td className="p-2">{cname(a.client_id)}</td>}
              <td className="p-2">{a.cur}</td><td className="p-2">{a.min_qty}</td>
              <td className={`p-2 font-medium ${a.level === "abaixo" ? "text-destructive" : "text-warning"}`}>{a.level === "abaixo" ? "Abaixo do mínimo" : "Próximo do mínimo"}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={showClient ? 5 : 4} className="p-3 text-center text-muted-foreground">Tudo em ordem.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button onClick={() => void pdf()} disabled={busy}><FileDown className="mr-2 h-4 w-4" />{busy ? "Gerando…" : "Gerar relatório PDF"}</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {card(<Send className="h-4 w-4" />, "Pedidos a enviar", toSend.length)}
        {card(<Truck className="h-4 w-4" />, "Enviados / em produção", inProgress.length)}
        {card(<Clock className="h-4 w-4" />, "Aguardando entrada", awaitingEntry.length)}
        {card(<AlertTriangle className="h-4 w-4" />, "Alertas de estoque mínimo", alerts.length, alerts.length ? "text-destructive" : "")}
      </div>

      <section className="space-y-2"><h2 className="font-semibold">Pedidos a enviar</h2>{orderTable(toSend)}</section>
      <section className="space-y-2"><h2 className="font-semibold">Pedidos enviados / em produção</h2>{orderTable(inProgress)}</section>
      {awaitingEntry.length > 0 && (
        <section className="space-y-2"><h2 className="font-semibold">Entregues aguardando confirmação de entrada</h2>{orderTable(awaitingEntry)}</section>
      )}

      <section className="space-y-2"><h2 className="flex items-center gap-2 font-semibold"><PackageSearch className="h-4 w-4" />Estoque de Lisos próximo do mínimo</h2>{alertTable(lisosAlerts, false)}</section>
      <section className="space-y-2"><h2 className="flex items-center gap-2 font-semibold"><PackageSearch className="h-4 w-4" />Estoque dos clientes (Guarda) próximo do mínimo</h2>{alertTable(guardaAlerts, true)}</section>

      <section className="space-y-2 rounded-md border p-3">
        <h2 className="font-semibold">Definir estoque mínimo</h2>
        <p className="text-xs text-muted-foreground">O alerta aparece quando o saldo fica até 20% acima do mínimo, e fica vermelho quando chega no mínimo.</p>
        <div className="grid gap-2 sm:grid-cols-5">
          <select className={sel} value={mod} onChange={(e) => setMod(e.target.value as "lisos" | "guarda")}>
            <option value="lisos">Estoque de Lisos</option><option value="guarda">Estoque de Guarda</option>
          </select>
          {mod === "guarda" ? (
            <select className={sel} value={cid} onChange={(e) => setCid(e.target.value)}>
              <option value="">Cliente…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <div />}
          <select className={sel} value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">Produto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input type="number" min="0" placeholder="Mínimo" value={qty} onChange={(e) => setQty(e.target.value)} />
          <Button onClick={() => void saveMin()}>Salvar mínimo</Button>
        </div>
        {levels.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left"><tr><th className="p-2">Estoque</th><th className="p-2">Cliente</th><th className="p-2">Produto</th><th className="p-2">Saldo</th><th className="p-2">Mínimo</th><th className="p-2" /></tr></thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-2">{l.modality === "lisos" ? "Lisos" : "Guarda"}</td><td className="p-2">{cname(l.client_id)}</td>
                    <td className="p-2">{pname(l.product_id)}</td><td className="p-2">{l.cur}</td><td className="p-2">{l.min_qty}</td>
                    <td className="p-2 text-right">
                      {l.level === "ok" && <CheckCircle2 className="mr-2 inline h-4 w-4 text-success" />}
                      <Button size="sm" variant="ghost" onClick={() => void removeMin(l.id)}>Remover</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
