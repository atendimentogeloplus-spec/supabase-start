import { usePaged } from "@/lib/paginate";
import { Pager } from "@/components/Pager";
import { fetchAll } from "@/lib/paginate";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StockDashboard, type StockMinimum } from "@/components/StockDashboard";

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
  stock_confirmed_at: string | null; stock_modality: string | null; created_at: string; expected_date: string | null;
  purchase_order_items: OrderItem[];
};
type Movement = {
  id: string; product_id: string; kind: "entrada" | "saida"; modality: "lisos" | "guarda";
  client_id: string | null; quantity: number; note: string | null; created_at: string;
};
type Forecast = { client_id: string; mode: "auto" | "manual"; manual_date: string | null };

const STATUS: Record<string, string> = { a_enviar: "A Enviar", enviado: "Enviado/Em produção", entregue: "Entregue" };
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
  const minimums = useQuery({ queryKey: ["stock_minimums"], queryFn: async () => {
    const { data, error } = await fetchAll((f, t) => supabase.from("stock_minimums" as never).select("*").range(f, t));
    if (error) throw error; return data as unknown as StockMinimum[];
  } });
  return {
    products: products.data ?? [], clients: clients.data ?? [], orders: orders.data ?? [],
    movements: movements.data ?? [], forecasts: forecasts.data ?? [], minimums: minimums.data ?? [],
  };
}

function EstoquePage() {
  const { isAdmin, isStockist, role } = useAuth();
  const isRep = role === "rep_internal" || role === "rep_external";
  const d = useStockData();
  if (!isAdmin && !isStockist && !isRep) return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  return (
    <div className="space-y-4">
      <h1 className="hidden text-xl font-semibold md:block">Estoque</h1>
      {(isStockist || isRep) && <p className="rounded-md bg-muted p-2 text-sm text-muted-foreground">Acesso somente para visualização.</p>}
      <Tabs defaultValue={isStockist ? "saldos" : "painel"}>
        <TabsList className="-mx-3 flex h-auto w-[calc(100%+1.5rem)] justify-start overflow-x-auto [&>*]:shrink-0 rounded-none px-3 [scrollbar-width:none] md:mx-0 md:w-auto md:flex-wrap md:rounded-md md:px-1">
          {!isStockist && <TabsTrigger value="painel">Painel</TabsTrigger>}
          {!isStockist && <TabsTrigger value="pedidos">Pedidos</TabsTrigger>}
          <TabsTrigger value="saldos">Saídas</TabsTrigger>
          <TabsTrigger value="gestao">Gestão do estoque</TabsTrigger>
          {!isStockist && <TabsTrigger value="clientes">Previsão por cliente</TabsTrigger>}
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
          {!isStockist && <TabsTrigger value="produtos">Produtos</TabsTrigger>}
        </TabsList>
        {!isStockist && <TabsContent value="painel"><StockDashboard {...d} /></TabsContent>}
        {!isStockist && <TabsContent value="pedidos"><Orders {...d} /></TabsContent>}
        <TabsContent value="saldos"><Balances {...d} /></TabsContent>
        <TabsContent value="gestao"><StockManagement {...d} /></TabsContent>
        {!isStockist && <TabsContent value="clientes"><ClientForecasts {...d} /></TabsContent>}
        <TabsContent value="movs"><MovementList {...d} /></TabsContent>
        {!isStockist && <TabsContent value="produtos"><Products products={d.products} /></TabsContent>}
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
  const [tab, setTab] = useState("todos");
  const today = new Date().toLocaleDateString("en-CA");
  const isLate = (o: Order) => !!o.expected_date && o.status !== "entregue" && o.expected_date < today;
  const count = (k: string) => k === "todos" ? orders.length : k === "atrasados" ? orders.filter(isLate).length : orders.filter((o) => o.status === k).length;
  const shown = tab === "todos" ? orders : tab === "atrasados" ? orders.filter(isLate) : orders.filter((o) => o.status === tab);
  async function setExpected(o: Order, v: string) {
    const { error } = await supabase.from("purchase_orders").update({ expected_date: v || null }).eq("id", o.id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  }
  const ordersPg = usePaged(shown);
  const [confirming, setConfirming] = useState<Order | null>(null);
  const [editing, setEditing] = useState<Order | null>(null);
  async function removeOrder(o: Order) {
    if (o.stock_confirmed_at) return toast.error("Este pedido já teve entrada no estoque e não pode ser excluído.");
    if (!window.confirm(`Excluir o pedido ${o.number}? Essa ação não pode ser desfeita.`)) return;
    const { error: e1 } = await supabase.from("purchase_order_items").delete().eq("order_id", o.id);
    if (e1) return toast.error(e1.message);
    const { error } = await supabase.from("purchase_orders").delete().eq("id", o.id);
    if (error) return toast.error(error.message);
    toast.success("Pedido excluído.");
    void qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  }
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
      <div className="flex flex-wrap items-center gap-2">
        <Button className="w-full md:w-auto" onClick={() => setOpen(true)}>Novo pedido</Button>
        <div className="flex w-full gap-1 overflow-x-auto rounded-md bg-muted p-1 [scrollbar-width:none] [&>*]:shrink-0 [&>*]:whitespace-nowrap md:ml-auto md:w-auto md:flex-wrap">
          {[["todos", "Todos"], ...Object.entries(STATUS), ["atrasados", "Em atraso"]].map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)}
              className={`rounded px-3 py-1 text-sm ${tab === k ? "bg-background font-medium shadow-sm" : k === "atrasados" ? "text-destructive" : "text-muted-foreground"}`}>
              {label} ({count(k)})
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-2">Pedido</th><th className="p-2">Fornecedor</th><th className="p-2">Cliente</th>
            <th className="p-2">Itens</th><th className="p-2">Previsão</th><th className="p-2">Status</th><th className="p-2">Estoque</th><th className="p-2" />
          </tr></thead>
          <tbody>
            {ordersPg.rows.map((o) => (
              <tr key={o.id} className={`border-t align-top ${isLate(o) ? "bg-destructive/5" : ""}`}>
                <td className="p-2 font-medium">{o.number}<div className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</div></td>
                <td className="p-2">{o.supplier ?? "—"}</td>
                <td className="p-2">{cname(o.client_id)}</td>
                <td className="p-2">{o.purchase_order_items.map((i) => <div key={i.id}>{i.quantity} × {pname(i.product_id)}</div>)}</td>
                <td className="p-2">
                  <Input type="date" className="h-8 w-36" value={o.expected_date ?? ""} onChange={(e) => void setExpected(o, e.target.value)} />
                  {isLate(o) && <span className="mt-1 inline-block rounded bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground">Em atraso</span>}
                </td>
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
                <td className="p-2 whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(o)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void removeOrder(o)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager {...ordersPg} />
      <NewOrderDialog open={open} onClose={() => setOpen(false)} products={products} clients={clients} />
      <NewOrderDialog open={!!editing} order={editing} onClose={() => setEditing(null)} products={products} clients={clients} />
      {confirming && (
        <ConfirmDialog order={confirming} clients={clients} movements={movements} onClose={() => setConfirming(null)} />
      )}
    </div>
  );
}

function NewOrderDialog({ open, onClose, products, clients, order }: { open: boolean; onClose: () => void; products: Product[]; clients: Client[]; order?: Order | null }) {
  const qc = useQueryClient();
  const [number, setNumber] = useState(""); const [supplier, setSupplier] = useState(""); const [clientId, setClientId] = useState(""); const [expected, setExpected] = useState("");
  const [items, setItems] = useState<{ product_id: string; quantity: string }[]>([{ product_id: "", quantity: "" }]);
  const [newSupplier, setNewSupplier] = useState(false);
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("suppliers").select("name").order("name").range(f, t));
      if (error) throw error;
      return (data as { name: string }[]).map((s) => s.name);
    },
  });
  const locked = !!order?.stock_confirmed_at;
  useEffect(() => {
    if (!open) return;
    if (order) {
      setNumber(order.number); setSupplier(order.supplier ?? ""); setClientId(order.client_id ?? ""); setExpected(order.expected_date ?? "");
      setItems(order.purchase_order_items.length ? order.purchase_order_items.map((i) => ({ product_id: i.product_id, quantity: String(i.quantity) })) : [{ product_id: "", quantity: "" }]);
      return;
    }
    let alive = true;
    (async () => {
      const year = new Date().getFullYear();
      // Numeração sequencial anual: em 2026 começa em 600 (a partir de 01/10); nos demais anos começa em 1.
      const since = year === 2026 ? "2026-10-01T00:00:00-03:00" : `${year}-01-01T00:00:00-03:00`;
      const start = year === 2026 ? 600 : 1;
      const { data } = await supabase.from("purchase_orders").select("number").gte("created_at", since);
      const nums = (data ?? []).map((o) => Number(String(o.number).trim())).filter((n) => Number.isInteger(n) && n >= start);
      const next = nums.length ? Math.max(...nums) + 1 : start;
      if (alive) setNumber((cur) => cur || String(next));
    })();
    return () => { alive = false; };
  }, [open, order]);
  function reset() { setNumber(""); setSupplier(""); setNewSupplier(false); setClientId(""); setExpected(""); setItems([{ product_id: "", quantity: "" }]); }
  async function save() {
    const valid = items.filter((i) => i.product_id && Number(i.quantity) > 0);
    if (!number.trim()) return toast.error("Informe o número do pedido.");
    if (!locked && valid.length === 0) return toast.error("Adicione ao menos um item.");
    const fields = { number: number.trim().slice(0, 50), supplier: supplier.trim() || null, client_id: clientId || null, expected_date: expected || null };
    if (fields.supplier && !suppliers.some((s) => s.toLowerCase() === fields.supplier!.toLowerCase())) {
      await supabase.from("suppliers").insert({ name: fields.supplier });
      void qc.invalidateQueries({ queryKey: ["suppliers"] });
    }
    let orderId = order?.id;
    if (order) {
      const { error } = await supabase.from("purchase_orders").update(fields).eq("id", order.id);
      if (error) return toast.error(error.message);
      if (!locked) {
        const { error: ed } = await supabase.from("purchase_order_items").delete().eq("order_id", order.id);
        if (ed) return toast.error(ed.message);
      }
    } else {
      const { data, error } = await supabase.from("purchase_orders").insert(fields).select("id").single();
      if (error || !data) return toast.error(error?.message ?? "Erro");
      orderId = data.id;
    }
    if (!locked) {
      const { error: e2 } = await supabase.from("purchase_order_items").insert(valid.map((i) => ({ order_id: orderId!, product_id: i.product_id, quantity: Number(i.quantity) })));
      if (e2) return toast.error(e2.message);
    }
    toast.success(order ? "Pedido atualizado." : "Pedido criado.");
    reset();
    void qc.invalidateQueries({ queryKey: ["purchase_orders"] }); onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{order ? `Editar pedido ${order.number}` : "Novo pedido de compra"}</DialogTitle></DialogHeader>
        {locked && <p className="text-xs text-muted-foreground">A entrada no estoque já foi confirmada, por isso os itens não podem ser alterados.</p>}
        <div className="space-y-2">
          <Input placeholder="Número do pedido" value={number} onChange={(e) => setNumber(e.target.value)} />
          {newSupplier ? (
            <div className="flex gap-2">
              <Input autoFocus placeholder="Nome do novo fornecedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              <Button type="button" variant="outline" onClick={() => { setNewSupplier(false); setSupplier(""); }}>Cancelar</Button>
            </div>
          ) : (
            <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={supplier}
              onChange={(e) => { if (e.target.value === "__new__") { setNewSupplier(true); setSupplier(""); } else setSupplier(e.target.value); }}>
              <option value="">Fornecedor...</option>
              {supplier && !suppliers.includes(supplier) && <option value={supplier}>{supplier}</option>}
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="__new__">+ Novo fornecedor</option>
            </select>
          )}
          <select className={sel} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sem cliente vinculado</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="block text-sm">Data prevista de entrega
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </label>
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2">
              <select className={sel} disabled={locked} value={it.product_id} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, product_id: e.target.value } : x))}>
                <option value="">Produto…</option>
                {products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <Input type="number" min="0" placeholder="Qtd" className="w-24" disabled={locked} value={it.quantity} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
            </div>
          ))}
          {!locked && <Button variant="outline" size="sm" onClick={() => setItems([...items, { product_id: "", quantity: "" }])}>+ Item</Button>}
          {products.length === 0 && <p className="text-xs text-muted-foreground">Cadastre produtos na aba Produtos.</p>}
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button><Button onClick={() => void save()}>Salvar</Button></div>
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
  const view = rows.filter((r) => r.mod === modality);
  const isG = modality === "guarda";
  return (
    <div className="space-y-4">
      <ModPicker value={modality} onChange={setModality} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md border bg-primary/10 p-3">
          <div className="text-sm text-muted-foreground">Estoque de {MOD[modality]}</div>
          <div className="mt-1 text-2xl font-semibold">{view.reduce((s, r) => s + r.v, 0)}</div>
          <div className="text-xs text-muted-foreground">{view.length} {view.length === 1 ? "item com saldo" : "itens com saldo"}</div>
        </div>
        {isG && (
          <div className="rounded-md border bg-card p-3">
            <div className="text-sm text-muted-foreground">Clientes com saldo</div>
            <div className="mt-1 text-2xl font-semibold">{new Set(view.map((r) => r.cid)).size}</div>
          </div>
        )}
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Registrar saída</p>
        <div className="grid gap-2 sm:grid-cols-5">
          <div className="flex items-center rounded-md border px-3 text-sm text-muted-foreground">{MOD[modality]}</div>
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
      {isG ? <Table head={["Cliente", "Produto", "Saldo"]} rows={view.map((r) => [cname(r.cid), pname(r.pid), String(r.v)])} />
        : <Table head={["Produto", "Saldo"]} rows={view.map((r) => [pname(r.pid), String(r.v)])} />}
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
  const [mod, setMod] = useState<"lisos" | "guarda">("lisos");
  const list = movements.filter((m) => m.modality === mod);
  const base = (m: Movement) => [new Date(m.created_at).toLocaleString("pt-BR"), m.kind === "entrada" ? "Entrada" : "Saída", pname(m.product_id), String(m.quantity)];
  return (
    <div className="space-y-3">
      <ModPicker value={mod} onChange={setMod} />
      {mod === "guarda"
        ? <Table head={["Data", "Tipo", "Produto", "Qtd", "Cliente", "Obs."]} rows={list.map((m) => [...base(m), cname(m.client_id), m.note ?? ""])} />
        : <Table head={["Data", "Tipo", "Produto", "Qtd", "Obs."]} rows={list.map((m) => [...base(m), m.note ?? ""])} />}
    </div>
  );
}

function ModPicker({ value, onChange }: { value: "lisos" | "guarda"; onChange: (v: "lisos" | "guarda") => void }) {
  return (
    <div className="flex w-full rounded-md bg-muted p-1 text-sm sm:w-auto sm:inline-flex">
      {(["lisos", "guarda"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={`flex-1 rounded px-4 py-1.5 sm:flex-none ${value === m ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>
          Estoque de {m === "lisos" ? "Lisos" : "Guarda"}
        </button>
      ))}
    </div>
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

/* ---------------- Gestão do estoque ---------------- */
function StockManagement({ products, clients, movements }: Data) {
  const [mod, setMod] = useState<"lisos" | "guarda">("lisos");
  const [cid, setCid] = useState("");
  const [q, setQ] = useState("");
  const pname = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const punit = (id: string) => products.find((p) => p.id === id)?.unit ?? "";
  const cname = (id: string) => (id ? clients.find((c) => c.id === id)?.name ?? "—" : "—");

  const all = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movements) {
      const key = `${m.modality}|${m.client_id ?? ""}|${m.product_id}`;
      map.set(key, (map.get(key) ?? 0) + (m.kind === "entrada" ? Number(m.quantity) : -Number(m.quantity)));
    }
    return [...map.entries()].map(([k, v]) => { const [mod, cid, pid] = k.split("|"); return { mod, cid, pid, v }; })
      .filter((r) => r.v !== 0);
  }, [movements]);

  const s = q.trim().toLowerCase();
  const rows = all.filter((r) => r.mod === mod && (mod === "lisos" || !cid || r.cid === cid) && (!s || pname(r.pid).toLowerCase().includes(s)))
    .sort((a, b) => a.mod.localeCompare(b.mod) || cname(a.cid).localeCompare(cname(b.cid)) || pname(a.pid).localeCompare(pname(b.pid)));

  const byClient = new Map<string, { qty: number; items: number }>();
  for (const r of rows.filter((r) => r.mod === "guarda")) {
    const c = byClient.get(r.cid) ?? { qty: 0, items: 0 };
    c.qty += r.v; c.items += 1; byClient.set(r.cid, c);
  }
  const byProduct = new Map<string, { lisos: number; guarda: number }>();
  for (const r of rows) {
    const p = byProduct.get(r.pid) ?? { lisos: 0, guarda: 0 };
    if (r.mod === "lisos") p.lisos += r.v; else p.guarda += r.v;
    byProduct.set(r.pid, p);
  }
  const total = (m: string) => rows.filter((r) => r.mod === m).reduce((t, r) => t + r.v, 0);
  const guardaClients = clients.filter((c) => all.some((r) => r.mod === "guarda" && r.cid === c.id));

  return (
    <div className="space-y-5">
      <ModPicker value={mod} onChange={(v) => { setMod(v); setCid(""); }} />
      <div className="grid gap-2 sm:grid-cols-3">
        {mod === "guarda" && (
          <select className={sel} value={cid} onChange={(e) => setCid(e.target.value)}>
            <option value="">Todos os clientes</option>{guardaClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <Input placeholder="Buscar produto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border bg-primary/10 p-3">
          <div className="text-sm text-muted-foreground">Estoque de {MOD[mod]}</div>
          <div className="mt-1 text-2xl font-semibold">{total(mod)}</div>
        </div>
        <div className="rounded-md border bg-card p-3">
          <div className="text-sm text-muted-foreground">Produtos com saldo</div>
          <div className="mt-1 text-2xl font-semibold">{byProduct.size}</div>
        </div>
        {mod === "guarda" && (
          <div className="rounded-md border bg-card p-3">
            <div className="text-sm text-muted-foreground">Clientes com saldo</div>
            <div className="mt-1 text-2xl font-semibold">{byClient.size}</div>
          </div>
        )}
      </div>
      {mod === "guarda" && (
        <section className="space-y-2"><h2 className="font-semibold">Guarda por cliente ({byClient.size} clientes)</h2>
          <Table head={["Cliente", "Produtos", "Quantidade"]}
            rows={[...byClient.entries()].sort((a, b) => b[1].qty - a[1].qty).map(([c, v]) => [cname(c), String(v.items), String(v.qty)])} />
        </section>
      )}
      <section className="space-y-2"><h2 className="font-semibold">Por produto</h2>
        <Table head={["Produto", "Quantidade"]}
          rows={[...byProduct.entries()].map(([p, v]) => [`${pname(p)} ${punit(p) ? `(${punit(p)})` : ""}`, String(mod === "lisos" ? v.lisos : v.guarda)])} />
      </section>
      {mod === "guarda" && (
        <section className="space-y-2"><h2 className="font-semibold">Detalhado por cliente</h2>
          <Table head={["Cliente", "Produto", "Saldo"]}
            rows={rows.map((r) => [cname(r.cid), pname(r.pid), String(r.v)])} />
        </section>
      )}
    </div>
  );
}
