import { usePaged } from "@/lib/paginate";
import { Pager } from "@/components/Pager";
import { fetchAll } from "@/lib/paginate";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque | LeadTrack" },
      { name: "description", content: "Pedidos de compra, estoque de Lisos e de Guarda e previsão de reposição por cliente." },
      { property: "og:title", content: "Estoque | LeadTrack" },
      { property: "og:description", content: "Pedidos de compra, estoque de Lisos e de Guarda e previsão de reposição por cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <EstoquePage />
    </AppShell>
  ),
});

type Product = { id: string; name: string; sku: string | null; unit: string; active: boolean };
type Client = { id: string; name: string };
type OrderItem = { id: string; product_id: string; quantity: number };
type Order = {
  id: string; number: string; supplier: string | null; client_id: string | null; status: string;
  stock_confirmed_at: string | null; stock_modality: string | null; created_at: string;
  purchase_order_items: OrderItem[];
};
type Movement = {
  id: string; product_id: string; kind: "entrada" | "saida"; modality: "lisos" | "guarda";
  client_id: string | null; quantity: number; note: string | null; created_at: string;
};
type Forecast = { client_id: string; mode: "auto" | "manual"; manual_date: string | null };

const STATUS: Record<string, string> = { enviado: "Enviado", em_producao: "Em Produção", entregue: "Entregue" };
const MOD: Record<string, string> = { lisos: "Lisos", guarda: "Guarda" };
const sel = "w-full rounded-md border bg-background px-2 py-2 text-sm";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
const DAY = 86400000;

function useStockData() {
  const products = useQuery({ queryKey: ["products"], queryFn: async () => {
    const { data, error } = await fetchAll((f, t) => supabase.from("products").select("*").order("name").range(f, t));
    if (error) throw error; return data as Product[];
  } });
  const clients = useQuery({ queryKey: ["clients-min"], queryFn: async () => {
    const { data, error } = await fetchAll((f, t) => supabase.from("clients").select("id,name").order("name").range(f, t));
    if (error) throw error; return data as Client[];
  } });
  const orders = useQuery({ queryKey: ["purchase_orders"], queryFn: async () => {
    const { data, error } = await fetchAll((f, t) => supabase.from("purchase_orders").select("*, purchase_order_items(id,product_id,quantity)").order("created_at", { ascending: false }).range(f, t));
    if (error) throw error; return data as unknown as Order[];
  } });
  const movements = useQuery({ queryKey: ["stock_movements"], queryFn: async () => {
    const { data, error } = await fetchAll((f, t) => supabase.from("stock_movements").select("*").order("created_at", { ascending: false }).range(f, t));
    if (error) throw error; return data as Movement[];
  } });
  const forecasts = useQuery({ queryKey: ["client_forecasts"], queryFn: async () => {
    const { data, error } = await fetchAll((f, t) => supabase.from("client_forecasts").select("*").range(f, t));
    if (error) throw error; return data as Forecast[];
  } });
  return {
    products: products.data ?? [], clients: clients.data ?? [], orders: orders.data ?? [],
    movements: movements.data ?? [], forecasts: forecasts.data ?? [],
  };
}

function EstoquePage() {
  const { isAdmin } = useAuth();
  const d = useStockData();
  if (!isAdmin) return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Estoque</h1>
      <Tabs defaultValue="pedidos">
        <TabsList className="flex-wrap">
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
          <TabsTrigger value="saldos">Saldos</TabsTrigger>
          <TabsTrigger value="clientes">Previsão por cliente</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="pedidos"><Orders {...d} /></TabsContent>
        <TabsContent value="saldos"><Balances {...d} /></TabsContent>
        <TabsContent value="clientes"><ClientForecasts {...d} /></TabsContent>
        <TabsContent value="movs"><MovementList {...d} /></TabsContent>
        <TabsContent value="produtos"><Products products={d.products} /></TabsContent>
      </Tabs>
    </div>
  );
}

type Data = ReturnType<typeof useStockData>;

/* ---------------- Produtos ---------------- */
function Products({ products }: { products: Product[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState(""); const [sku, setSku] = useState(""); const [unit, setUnit] = useState("un");
  async function add() {
    if (!name.trim()) return toast.error("Informe o nome.");
    const { error } = await supabase.from("products").insert({ name: name.trim().slice(0, 150), sku: sku.trim() || null, unit: unit.trim() || "un" });
    if (error) return toast.error(error.message);
    setName(""); setSku(""); void qc.invalidateQueries({ queryKey: ["products"] });
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Nome do produto" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Input placeholder="Código" value={sku} onChange={(e) => setSku(e.target.value)} className="w-32" />
        <Input placeholder="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-24" />
        <Button onClick={() => void add()}>Adicionar</Button>
      </div>
      <Table head={["Produto", "Código", "Unidade"]} rows={products.map((p) => [p.name, p.sku ?? "—", p.unit])} />
    </div>
  );
}

/* ---------------- Pedidos ---------------- */
function Orders({ products, clients, orders, movements }: Data) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ordersPg = usePaged(orders);
  const [confirming, setConfirming] = useState<Order | null>(null);
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cname = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";

  async function setStatus(o: Order, status: string) {
    const { error } = await supabase.from("purchase_orders").update({ status }).eq("id", o.id);
    if (error) return toast.error(error.message);
    await qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    if (status === "entregue" && !o.stock_confirmed_at) setConfirming({ ...o, status });
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => setOpen(true)}>Novo pedido</Button>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-2">Pedido</th><th className="p-2">Fornecedor</th><th className="p-2">Cliente</th>
            <th className="p-2">Itens</th><th className="p-2">Status</th><th className="p-2">Estoque</th>
          </tr></thead>
          <tbody>
            {ordersPg.rows.map((o) => (
              <tr key={o.id} className="border-t align-top">
                <td className="p-2 font-medium">{o.number}<div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div></td>
                <td className="p-2">{o.supplier ?? "—"}</td>
                <td className="p-2">{cname(o.client_id)}</td>
                <td className="p-2">{o.purchase_order_items.map((i) => <div key={i.id}>{i.quantity} × {pname(i.product_id)}</div>)}</td>
                <td className="p-2">
                  <select className={sel} value={o.status} disabled={!!o.stock_confirmed_at} onChange={(e) => void setStatus(o, e.target.value)}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="p-2">
                  {o.stock_confirmed_at ? (
                    <span className="text-xs">Entrada em {MOD[o.stock_modality ?? ""]} · {fmtDate(o.stock_confirmed_at)}</span>
                  ) : o.status === "entregue" ? (
                    <Button size="sm" onClick={() => setConfirming(o)}>Confirmar entrada</Button>
                  ) : <span className="text-xs text-muted-foreground">Aguardando entrega</span>}
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...ordersPg} />
      <NewOrderDialog open={open} onClose={() => setOpen(false)} products={products} clients={clients} />
      {confirming && (
        <ConfirmDialog order={confirming} clients={clients} movements={movements} onClose={() => setConfirming(null)} />
      )}
    </div>
  );
}

function NewOrderDialog({ open, onClose, products, clients }: { open: boolean; onClose: () => void; products: Product[]; clients: Client[] }) {
  const qc = useQueryClient();
  const [number, setNumber] = useState(""); const [supplier, setSupplier] = useState(""); const [clientId, setClientId] = useState("");
  const [items, setItems] = useState<{ product_id: string; quantity: string }[]>([{ product_id: "", quantity: "" }]);
  async function save() {
    const valid = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (!number.trim()) return toast.error("Informe o número do pedido.");
    if (valid.length === 0) return toast.error("Adicione ao menos um item.");
    const { data, error } = await supabase.from("purchase_orders")
      .insert({ number: number.trim().slice(0, 50), supplier: supplier.trim() || null, client_id: clientId || null }).select("id").single();
    if (error || !data) return toast.error(error?.message ?? "Erro");
    const { error: e2 } = await supabase.from("purchase_order_items").insert(valid.map((i) => ({ order_id: data.id, product_id: i.product_id, quantity: Number(i.quantity) })));
    if (e2) return toast.error(e2.message);
    toast.success("Pedido criado.");
    setNumber(""); setSupplier(""); setClientId(""); setItems([{ product_id: "", quantity: "" }]);
    void qc.invalidateQueries({ queryKey: ["purchase_orders"] }); onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo pedido de compra</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Número do pedido" value={number} onChange={(e) => setNumber(e.target.value)} />
          <Input placeholder="Fornecedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <select className={sel} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sem cliente vinculado</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <select className={sel} value={it.product_id} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, product_id: e.target.value } : x))}>
                <option value="">Produto…</option>
                {products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input type="number" min="0" placeholder="Qtd" className="w-24" value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setItems([...items, { product_id: "", quantity: "" }])}>+ Item</Button>
          {products.length === 0 && <p className="text-xs text-muted-foreground">Cadastre produtos na aba Produtos.</p>}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => void save()}>Salvar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmDialog({ order, clients, movements, onClose }: { order: Order; clients: Client[]; movements: Movement[]; onClose: () => void }) {
  const qc = useQueryClient();
  const usesGuarda = !!order.client_id && movements.some((m) => m.modality === "guarda" && m.client_id === order.client_id);
  const [modality, setModality] = useState<"lisos" | "guarda">(usesGuarda ? "guarda" : "lisos");
  const [clientId, setClientId] = useState(order.client_id ?? "");
  async function confirm() {
    const { error } = await supabase.rpc("confirm_order_stock", { _order_id: order.id, _modality: modality, _client_id: (modality === "guarda" ? clientId : null) as string });
    if (error) return toast.error(error.message);
    toast.success("Entrada confirmada.");
    void qc.invalidateQueries({ queryKey: ["purchase_orders"] });
    void qc.invalidateQueries({ queryKey: ["stock_movements"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Confirmar entrada do pedido {order.number}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Escolha para qual estoque os itens vão.</p>
        {usesGuarda && <p className="text-xs text-primary">Este cliente já usa Estoque de Guarda — opção pré-selecionada.</p>}
        <div className="space-y-2">
          {(["lisos", "guarda"] as const).map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="radio" checked={modality === m} onChange={() => setModality(m)} /> Estoque de {MOD[m]}
            </label>
          ))}
          {modality === "guarda" && (
            <select className={sel} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Selecione o cliente…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Agora não</Button><Button onClick={() => void confirm()}>Confirmar entrada</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Saldos + saída ---------------- */
function Balances({ products, clients, movements }: Data) {
  const qc = useQueryClient();
  const [modality, setModality] = useState<"lisos" | "guarda">("lisos");
  const [clientId, setClientId] = useState(""); const [productId, setProductId] = useState("");
  const [qty, setQty] = useState(""); const [note, setNote] = useState("");

  const rows = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movements) {
      const key = `${m.modality}|${m.client_id ?? ""}|${m.product_id}`;
      map.set(key, (map.get(key) ?? 0) + (m.kind === "entrada" ? m.quantity : -m.quantity));
    }
    return [...map.entries()].map(([k, v]) => { const [mod, cid, pid] = k.split("|"); return { mod, cid, pid, v }; })
      .filter((r) => r.v !== 0);
  }, [movements]);

  async function exit() {
    if (!productId || !(Number(qty) > 0)) return toast.error("Informe produto e quantidade.");
    const { error } = await supabase.rpc("register_stock_exit", {
      _product_id: productId, _modality: modality, _client_id: (modality === "guarda" ? clientId : null) as string,
      _quantity: Number(qty), _note: (note.trim().slice(0, 300) || null) as string,
    });
    if (error) return toast.error(error.message);
    toast.success("Saída registrada."); setQty(""); setNote("");
    void qc.invalidateQueries({ queryKey: ["stock_movements"] });
  }

  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cname = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Registrar saída</p>
        <div className="grid gap-2 sm:grid-cols-5">
          <select className={sel} value={modality} onChange={(e) => setModality(e.target.value as "lisos" | "guarda")}>
            <option value="lisos">Estoque de Lisos</option><option value="guarda">Estoque de Guarda</option>
          </select>
          {modality === "guarda" ? (
            <select className={sel} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Cliente…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : <div />}
          <select className={sel} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Produto…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Input type="number" min="0" placeholder="Quantidade" value={qty} onChange={(e) => setQty(e.target.value)} />
          <Button onClick={() => void exit()}>Registrar saída</Button>
        </div>
        <Input placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {modality === "guarda" && <p className="text-xs text-muted-foreground">A saída da Guarda alimenta o Estoque Separado e a previsão do cliente.</p>}
      </div>
      <Table head={["Estoque", "Cliente", "Produto", "Saldo"]}
        rows={rows.map((r) => [MOD[r.mod], r.cid ? cname(r.cid) : "—", pname(r.pid), String(r.v)])} />
    </div>
  );
}

/* ---------------- Previsão por cliente ---------------- */
function autoForecast(exits: Movement[]) {
  const days = [...new Set(exits.map((m) => new Date(m.created_at).toISOString().slice(0, 10)))].sort();
  if (days.length < 2) return null;
  const t = days.map((d) => new Date(d).getTime());
  const avg = (t[t.length - 1] - t[0]) / (t.length - 1);
  return new Date(t[t.length - 1] + avg);
}

function ClientForecasts({ products, clients, movements, forecasts }: Data) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const guardaClients = clients.filter((c) => movements.some((m) => m.modality === "guarda" && m.client_id === c.id));

  async function saveForecast(clientId: string, mode: "auto" | "manual", manual_date: string | null) {
    const { error } = await supabase.from("client_forecasts").upsert({ client_id: clientId, mode, manual_date });
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["client_forecasts"] });
  }

  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-2">Cliente</th><th className="p-2">Enviado ao cliente (Separado)</th><th className="p-2">Última remessa</th>
            <th className="p-2">Previsão</th><th className="p-2">Modo</th><th className="p-2" />
          </tr></thead>
          <tbody>
            {guardaClients.map((c) => {
              const exits = movements.filter((m) => m.modality === "guarda" && m.kind === "saida" && m.client_id === c.id);
              const f = forecasts.find((x) => x.client_id === c.id) ?? { client_id: c.id, mode: "auto" as const, manual_date: null };
              const date = f.mode === "manual" ? (f.manual_date ? new Date(f.manual_date + "T12:00:00") : null) : autoForecast(exits);
              const left = date ? Math.ceil((date.getTime() - Date.now()) / DAY) : null;
              const total = exits.reduce((s, m) => s + m.quantity, 0);
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-2 font-medium">{c.name}</td>
                  <td className="p-2">{total}</td>
                  <td className="p-2">{exits[0] ? fmtDate(exits[0].created_at) : "—"}</td>
                  <td className="p-2">
                    {date ? <>{date.toLocaleDateString("pt-BR")} <span className={left! <= 3 ? "text-destructive" : "text-muted-foreground"}>({left! <= 0 ? "vencida" : `${left} dias`})</span></>
                      : <span className="text-muted-foreground">{f.mode === "auto" ? "Histórico insuficiente" : "Sem data"}</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <select className={sel} value={f.mode} onChange={(e) => void saveForecast(c.id, e.target.value as "auto" | "manual", f.manual_date)}>
                        <option value="auto">Automática</option><option value="manual">Manual</option>
                      </select>
                      {f.mode === "manual" && <Input type="date" value={f.manual_date ?? ""} onChange={(e) => void saveForecast(c.id, "manual", e.target.value || null)} />}
                    </div>
                  </td>
                  <td className="p-2"><Button size="sm" variant="outline" onClick={() => setSelected(c.id)}>Histórico</Button></td>
                </tr>
              );
            })}
            {guardaClients.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum cliente com Estoque de Guarda.</td></tr>}
          </tbody>
        </table>
      </div>
      {selected && (
        <Dialog open onOpenChange={(v) => !v && setSelected(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Histórico — {clients.find((c) => c.id === selected)?.name}</DialogTitle></DialogHeader>
            <Table head={["Data", "Tipo", "Produto", "Qtd", "Obs."]}
              rows={movements.filter((m) => m.client_id === selected).map((m) => [fmtDate(m.created_at), m.kind === "entrada" ? "Entrada" : "Saída", pname(m.product_id), String(m.quantity), m.note ?? ""])} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/* ---------------- Movimentações ---------------- */
function MovementList({ products, clients, movements }: Data) {
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const cname = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "—";
  return (
    <Table head={["Data", "Tipo", "Estoque", "Produto", "Qtd", "Cliente", "Obs."]}
      rows={movements.map((m) => [new Date(m.created_at).toLocaleString("pt-BR"), m.kind === "entrada" ? "Entrada" : "Saída", MOD[m.modality], pname(m.product_id), String(m.quantity), cname(m.client_id), m.note ?? ""])} />
  );
}

function Table({ head, rows: all }: { head: string[]; rows: string[][] }) {
  const pg = usePaged(all);
  const rows = pg.rows;
  return (
    <div>
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left"><tr>{head.map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={head.length} className="p-4 text-center text-muted-foreground">Nada por aqui.</td></tr>}
        </tbody>
      </table>
    </div>
    <Pager {...pg} />
    </div>
  );
}
