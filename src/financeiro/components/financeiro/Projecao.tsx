import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Category, PAYMENT_METHODS, Transaction, formatBRL } from "./useFinanceData";
import TransactionDialog from "./TransactionDialog";
import { eachDayOfInterval, format, startOfMonth, endOfMonth, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Plus, Check, Pencil, Trash2, ChevronLeft, ChevronRight, Landmark, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { OrderReceipt } from "@/components/OrderReceipt";

interface Receivable {
  id: string;
  description: string;
  client_name: string | null;
  amount: number;
  due_date: string;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
}

interface Payable {
  id: string;
  description: string;
  supplier_name: string | null;
  amount: number;
  due_date: string;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
}

interface ProjecaoProps {
  transactions: Transaction[];
  userId?: string;
  categories: Category[];
  reload: () => Promise<void> | void;
}

const isOverdueTag = (notes: string | null | undefined) =>
  !!notes && /origem:\s*(relatório|relatorio|pedido)\s*atrasado/i.test(notes);

const normalizeClientName = (value: string | null | undefined) =>
  (value || "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toIsoDate = (value: string) => String(value).slice(0, 10);

const PARCELA_RE = /^(.*)\s\((\d+)\/(\d+)\)\s*$/;

async function propagateFutureParcelas(params: {
  userId: string;
  oldDescription: string;
  newDescription: string;
  fromDate: string;
  updates: { amount: number; category: string | null; payment_method: string | null; notes: string | null };
}) {
  const { userId, oldDescription, newDescription, fromDate, updates } = params;
  const oldM = oldDescription.match(PARCELA_RE);
  const newM = newDescription.match(PARCELA_RE);
  if (!oldM || !newM) return;
  const oldBase = oldM[1];
  const total = oldM[3];
  const newBase = newM[1];
  const like = `${oldBase} (%/${total})`;

  const run = async (table: "fin_transactions" | "fin_payables" | "fin_receivables", dateCol: "date" | "due_date") => {
    const { data: rows } = await supabase.from(table).select(`id, description, ${dateCol}`).eq("user_id", userId).like("description", like).gt(dateCol, fromDate);
    if (!rows) return;
    for (const r of rows as any[]) {
      const m = (r.description as string).match(PARCELA_RE);
      if (!m) continue;
      const newDesc = `${newBase} (${m[2]}/${m[3]})`;
      await supabase.from(table).update({ description: newDesc, ...updates }).eq("id", r.id);
    }
  };
  await run("fin_transactions", "date");
  await run("fin_payables", "due_date");
  await run("fin_receivables", "due_date");
}

async function deleteFutureParcelas(params: { userId: string; description: string; fromDate: string }) {
  const { userId, description, fromDate } = params;
  const m = description.match(PARCELA_RE);
  if (!m) return;
  const base = m[1];
  const total = m[3];
  const like = `${base} (%/${total})`;
  const run = async (table: "fin_transactions" | "fin_payables" | "fin_receivables", dateCol: "date" | "due_date") => {
    await supabase.from(table).delete().eq("user_id", userId).like("description", like).gt(dateCol, fromDate);
  };
  await run("fin_transactions", "date");
  await run("fin_payables", "due_date");
  await run("fin_receivables", "due_date");
}

export default function Projecao({ transactions, userId, categories, reload }: ProjecaoProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [refMonth, setRefMonth] = useState<Date>(startOfMonth(today));
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [overduePacotesByClient, setOverduePacotesByClient] = useState<Record<string, number>>({});
  const [overdueInfoByReceivable, setOverdueInfoByReceivable] = useState<Record<string, { packages: number; date: string | null; salesCount: number }>>({});
  const [receiptData, setReceiptData] = useState<any | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  async function openReceiptForReceivable(r: Receivable) {
    const src = `${r.description || ""} ${r.notes || ""}`;
    const m = src.match(/#(\d+)/);
    if (!m) { toast.info("Este recebível não está vinculado a um pedido."); return; }
    setLoadingReceipt(true);
    const { data, error } = await supabase
      .from("sales")
      .select("id, created_at, order_number, batch_number, total, observations, driver_name, client_id, client_name, clients(name, cpf_cnpj, whatsapp, contact, address_street, address_number, address_neighborhood, address_city, address_state, address_zip, payment_type), sale_items(product_name, quantity, unit_price, subtotal, price_table_name)")
      .eq("order_number", Number(m[1]))
      .maybeSingle();
    setLoadingReceipt(false);
    if (error || !data) { toast.error("Pedido não encontrado."); return; }
    const client = (data as any).clients || { name: (data as any).client_name };
    setReceiptData({
      sale: { id: data.id, created_at: data.created_at, order_number: data.order_number, batch_number: (data as any).batch_number },
      client,
      items: ((data as any).sale_items || []).map((i: any) => ({ product_name: i.product_name, quantity: i.quantity, unit_price: Number(i.unit_price), subtotal: Number(i.subtotal), price_table_name: i.price_table_name || "" })),
      total: Number(data.total),
      driverName: (data as any).driver_name || null,
      observations: (data as any).observations || null,
    });
  }

  const [txOpen, setTxOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [recvOpen, setRecvOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [editingRecvId, setEditingRecvId] = useState<string | null>(null);
  const [editingPayId, setEditingPayId] = useState<string | null>(null);
  const [originalRecv, setOriginalRecv] = useState<{ description: string; due_date: string } | null>(null);
  const [originalPay, setOriginalPay] = useState<{ description: string; due_date: string } | null>(null);
  const [scopePayEditOpen, setScopePayEditOpen] = useState(false);
  const [scopeRecvEditOpen, setScopeRecvEditOpen] = useState(false);
  const [deletingRecv, setDeletingRecv] = useState<Receivable | null>(null);
  const [deletingPay, setDeletingPay] = useState<Payable | null>(null);
  const [recvForm, setRecvForm] = useState({
    description: "", client_name: "", amount: "", due_date: todayStr,
    category: "Vendas de Gelo", payment_method: "Pix", notes: "",
  });
  const [payForm, setPayForm] = useState({
    description: "", supplier_name: "", amount: "", due_date: todayStr,
    category: "", payment_method: "Dinheiro", notes: "",
  });
  const [savingRecv, setSavingRecv] = useState(false);
  const [savingPay, setSavingPay] = useState(false);

  function openEditRecv(r: Receivable) {
    setEditingRecvId(r.id);
    setOriginalRecv({ description: r.description || "", due_date: r.due_date });
    setRecvForm({
      description: r.description || "",
      client_name: r.client_name || "",
      amount: String(r.amount ?? ""),
      due_date: r.due_date,
      category: r.category || "Vendas de Gelo",
      payment_method: r.payment_method || "Pix",
      notes: r.notes || "",
    });
    setRecvOpen(true);
  }
  function openEditPay(p: Payable) {
    setEditingPayId(p.id);
    setOriginalPay({ description: p.description || "", due_date: p.due_date });
    setPayForm({
      description: p.description || "",
      supplier_name: p.supplier_name || "",
      amount: String(p.amount ?? ""),
      due_date: p.due_date,
      category: p.category || "",
      payment_method: p.payment_method || "Dinheiro",
      notes: p.notes || "",
    });
    setPayOpen(true);
  }
  async function handleDeleteRecv(scope: "one" | "future" = "one") {
    if (!deletingRecv) return;
    const target = deletingRecv;
    const { error } = await supabase.from("fin_receivables").delete().eq("id", target.id);
    if (error) { toast.error(error.message); return; }
    if (scope === "future" && userId) {
      await deleteFutureParcelas({ userId, description: target.description, fromDate: target.due_date });
    }
    toast.success(scope === "future" ? "Conta atual e próximas excluídas" : "Conta a receber excluída");
    setDeletingRecv(null);
    loadReceivables();
    reload();
  }
  async function handleDeletePay(scope: "one" | "future" = "one") {
    if (!deletingPay) return;
    const target = deletingPay;
    const { error } = await supabase.from("fin_payables" as any).delete().eq("id", target.id);
    if (error) { toast.error(error.message); return; }
    if (scope === "future" && userId) {
      await deleteFutureParcelas({ userId, description: target.description, fromDate: target.due_date });
    }
    toast.success(scope === "future" ? "Conta atual e próximas excluídas" : "Conta a pagar excluída");
    setDeletingPay(null);
    loadPayables();
    reload();
  }

  const loadReceivables = useCallback(async () => {
    if (!userId) return;
    await supabase.rpc("generate_boleto_receivables");
    const { data } = await supabase.from("fin_receivables").select("id,description,client_name,amount,due_date,category,payment_method,notes")
      .eq("status", "aberto").order("due_date");
    setReceivables((data || []) as Receivable[]);
  }, [userId]);

  const loadPayables = useCallback(() => {
    if (!userId) return;
    supabase.from("fin_payables" as any).select("id,description,supplier_name,amount,due_date,category,payment_method,notes")
      .eq("status", "aberto").order("due_date")
      .then(({ data }) => setPayables(((data || []) as unknown) as Payable[]));
  }, [userId]);

  const loadOverduePacotes = useCallback(async () => {
    const overdueItems = receivables.filter(r => r.due_date < todayStr || isOverdueTag(r.notes));
    if (overdueItems.length === 0) {
      setOverduePacotesByClient({});
      setOverdueInfoByReceivable({});
      return;
    }

    const { data } = await supabase
      .from("sales")
      .select("client_name, order_number, created_at, total, sale_items(quantity), clients(name)")
      .eq("is_overdue", true);

    const overdueSales = ((data || []) as any[]).map((s) => ({
      clientKey: normalizeClientName(s.clients?.name || s.client_name),
      orderNumber: s.order_number ? String(s.order_number) : "",
      date: toIsoDate(s.created_at),
      total: Number(s.total || 0),
      packages: (s.sale_items || []).reduce((a: number, i: any) => a + Number(i.quantity || 0), 0),
    }));

    const byReceivable: Record<string, { packages: number; date: string | null; salesCount: number }> = {};
    for (const r of overdueItems) {
      const clientKey = normalizeClientName(r.client_name);
      const searchable = `${r.description || ""} ${r.notes || ""}`;
      const orderMatch = searchable.match(/#(\d+)/);
      const periodMatch = r.description.match(/Atrasado\s+(\d{2})\/(\d{2})-(\d{2})\/(\d{2})\/(\d{4})/i);
      let matched = overdueSales.filter((s) => s.clientKey === clientKey);

      if (orderMatch) {
        matched = matched.filter((s) => s.orderNumber === orderMatch[1]);
      } else if (periodMatch) {
        const [, startDay, startMonth, endDay, endMonth, endYear] = periodMatch;
        const startYear = Number(startMonth) > Number(endMonth) ? Number(endYear) - 1 : Number(endYear);
        const startDate = `${startYear}-${startMonth}-${startDay}`;
        const endDate = `${endYear}-${endMonth}-${endDay}`;
        matched = matched.filter((s) => s.date >= startDate && s.date <= endDate);
      } else {
        const amount = Number(r.amount || 0);
        matched = matched.filter((s) => Math.abs(s.total - amount) < 0.01);
      }

      const packages = matched.reduce((sum, s) => sum + s.packages, 0);
      const date = matched.length === 1 ? matched[0].date : null;
      byReceivable[r.id] = { packages, date, salesCount: matched.length };
    }

    const byClient: Record<string, number> = {};
    for (const group of overdueItems) {
      const name = group.client_name?.trim() || "Sem cliente";
      byClient[name] = (byClient[name] || 0) + (byReceivable[group.id]?.packages || 0);
    }
    setOverduePacotesByClient(byClient);
    setOverdueInfoByReceivable(byReceivable);
  }, [receivables, todayStr]);

  useEffect(() => { loadReceivables(); loadPayables(); }, [loadReceivables, loadPayables]);
  useEffect(() => { loadOverduePacotes(); }, [loadOverduePacotes]);


  const [payingId, setPayingId] = useState<string | null>(null);
  async function markRecvPaid(r: Receivable) {
    if (!userId) return;
    setPayingId(r.id);
    const today = new Date().toISOString().slice(0, 10);
    const { error: txErr } = await supabase.from("fin_transactions").insert({
      user_id: userId,
      description: r.description,
      amount: r.amount,
      type: "entrada",
      category: r.category || "Vendas de Gelo",
      date: today,
      status: "realizado",
      payment_method: (r.payment_method || "Pix"),
      notes: [r.notes, r.client_name ? `Cliente: ${r.client_name}` : null, "(origem: contas a receber)"].filter(Boolean).join(" • "),
    });
    if (txErr) { setPayingId(null); toast.error("Erro ao lançar no fluxo"); return; }
    const { error: upErr } = await supabase
      .from("fin_receivables")
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", r.id);
    if (upErr) { setPayingId(null); toast.error("Erro ao baixar conta"); return; }

    // Se veio da geração automática de boleto, marca os pedidos do período como pagos
    const tagMatch = (r.notes || "").match(/\[auto-boleto:(mensal|quinzenal):(\d{4})-(\d{2})(?::H([12]))?:([0-9a-f-]{36})\]/i);
    if (tagMatch) {
      const [, kind, y, m, half, clientId] = tagMatch;
      const year = Number(y), month = Number(m);
      let startD: Date, endD: Date;
      if (kind === "mensal") {
        startD = new Date(year, month - 1, 1);
        endD = new Date(year, month, 0);
      } else if (half === "1") {
        startD = new Date(year, month - 1, 1);
        endD = new Date(year, month - 1, 15);
      } else {
        startD = new Date(year, month - 1, 16);
        endD = new Date(year, month, 0);
      }
      await supabase.from("sales").update({ is_paid: true })
        .eq("client_id", clientId).eq("is_paid", false)
        .gte("created_at", startD.toISOString())
        .lte("created_at", new Date(endD.getFullYear(), endD.getMonth(), endD.getDate(), 23, 59, 59, 999).toISOString());
    }

    setPayingId(null);
    toast.success("Pagamento lançado");
    loadReceivables();
    await reload();
  }

  async function markPayPaid(p: Payable) {
    if (!userId) return;
    setPayingId(p.id);
    const today = new Date().toISOString().slice(0, 10);
    const { error: txErr } = await supabase.from("fin_transactions").insert({
      user_id: userId,
      description: p.description,
      amount: p.amount,
      type: "saida",
      category: p.category || "Outras Despesas",
      date: today,
      status: "realizado",
      payment_method: p.payment_method || "Dinheiro",
      notes: [p.notes, p.supplier_name ? `Fornecedor: ${p.supplier_name}` : null, "(origem: contas a pagar)"].filter(Boolean).join(" • "),
    });
    if (txErr) { setPayingId(null); toast.error("Erro ao lançar no fluxo"); return; }
    const { error: upErr } = await supabase
      .from("fin_payables" as any)
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", p.id);
    setPayingId(null);
    if (upErr) { toast.error("Erro ao baixar conta"); return; }
    toast.success("Pagamento lançado");
    loadPayables();
    await reload();
  }

  async function markTxPaid(t: Transaction) {
    setPayingId(t.id);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("fin_transactions")
      .update({ status: "realizado", date: today })
      .eq("id", t.id);
    setPayingId(null);
    if (error) { toast.error("Erro ao marcar como pago"); return; }
    toast.success("Pagamento lançado");
    await reload();
  }

  async function handleDeleteTx() {
    if (!deletingTx) return;
    const { error } = await supabase.from("fin_transactions").delete().eq("id", deletingTx.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lançamento excluído");
    setDeletingTx(null);
    await reload();
  }

  const entradaCats = categories.filter(c => c.type === "entrada");
  const saidaCats = categories.filter(c => c.type === "saida");

  async function handleSaveRecv(scope: "one" | "future" = "one") {
    if (!userId) return;
    if (!recvForm.description.trim() || !recvForm.amount || !recvForm.due_date) {
      toast.error("Preencha descrição, valor e vencimento"); return;
    }
    const newDesc = recvForm.description.trim();
    if (editingRecvId && scope === "one" && originalRecv) {
      const oldM = originalRecv.description.match(PARCELA_RE);
      const newM = newDesc.match(PARCELA_RE);
      if (oldM && newM) { setScopeRecvEditOpen(true); return; }
    }
    setSavingRecv(true);
    const payload = {
      description: newDesc,
      client_name: recvForm.client_name.trim() || null,
      amount: Number(recvForm.amount),
      due_date: recvForm.due_date,
      category: recvForm.category || null,
      payment_method: recvForm.payment_method || null,
      notes: recvForm.notes.trim() || null,
    };
    const { error } = editingRecvId
      ? await supabase.from("fin_receivables").update(payload).eq("id", editingRecvId)
      : await supabase.from("fin_receivables").insert({ ...payload, user_id: userId, status: "aberto" });
    if (error) { setSavingRecv(false); toast.error("Erro ao salvar conta"); return; }

    if (editingRecvId && scope === "future" && originalRecv) {
      await propagateFutureParcelas({
        userId,
        oldDescription: originalRecv.description,
        newDescription: newDesc,
        fromDate: originalRecv.due_date,
        updates: { amount: payload.amount, category: payload.category, payment_method: payload.payment_method, notes: payload.notes },
      });
    }

    setSavingRecv(false);
    toast.success(editingRecvId ? (scope === "future" ? "Conta atual e próximas atualizadas" : "Conta atualizada") : "Conta a receber criada");
    setRecvOpen(false);
    setEditingRecvId(null);
    setOriginalRecv(null);
    setRecvForm({
      description: "", client_name: "", amount: "", due_date: todayStr,
      category: "Vendas de Gelo", payment_method: "Pix", notes: "",
    });
    loadReceivables();
    reload();
  }

  async function handleSavePay(scope: "one" | "future" = "one") {
    if (!userId) return;
    if (!payForm.description.trim() || !payForm.amount || !payForm.due_date) {
      toast.error("Preencha descrição, valor e vencimento"); return;
    }
    const newDesc = payForm.description.trim();
    if (editingPayId && scope === "one" && originalPay) {
      const oldM = originalPay.description.match(PARCELA_RE);
      const newM = newDesc.match(PARCELA_RE);
      if (oldM && newM) { setScopePayEditOpen(true); return; }
    }
    setSavingPay(true);
    const payload = {
      description: newDesc,
      supplier_name: payForm.supplier_name.trim() || null,
      amount: Number(payForm.amount),
      due_date: payForm.due_date,
      category: payForm.category || null,
      payment_method: payForm.payment_method || null,
      notes: payForm.notes.trim() || null,
    };
    const { error } = editingPayId
      ? await supabase.from("fin_payables" as any).update(payload).eq("id", editingPayId)
      : await supabase.from("fin_payables" as any).insert({ ...payload, user_id: userId, status: "aberto" });
    if (error) { setSavingPay(false); toast.error("Erro ao salvar conta"); return; }

    if (editingPayId && scope === "future" && originalPay) {
      await propagateFutureParcelas({
        userId,
        oldDescription: originalPay.description,
        newDescription: newDesc,
        fromDate: originalPay.due_date,
        updates: { amount: payload.amount, category: payload.category, payment_method: payload.payment_method, notes: payload.notes },
      });
    }

    setSavingPay(false);
    toast.success(editingPayId ? (scope === "future" ? "Conta atual e próximas atualizadas" : "Conta atualizada") : "Conta a pagar criada");
    setPayOpen(false);
    setEditingPayId(null);
    setOriginalPay(null);
    setPayForm({
      description: "", supplier_name: "", amount: "", due_date: todayStr,
      category: "", payment_method: "Dinheiro", notes: "",
    });
    loadPayables();
    reload();
  }



  const monthStart = startOfMonth(refMonth).toISOString().slice(0, 10);
  const monthEnd = endOfMonth(refMonth).toISOString().slice(0, 10);

  const saldoInicial = transactions
    .filter(t => t.status === "realizado" && t.date < monthStart)
    .reduce((a, t) => a + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);

  const overdueRecv = receivables.filter(r => r.due_date < todayStr || isOverdueTag(r.notes));
  const monthRecv = receivables.filter(r => !isOverdueTag(r.notes) && r.due_date >= todayStr && r.due_date >= monthStart && r.due_date <= monthEnd);
  const monthRecvTotal = monthRecv.reduce((a, r) => a + Number(r.amount), 0);
  const overdueTotal = overdueRecv.reduce((a, r) => a + Number(r.amount), 0);

  const overduePay = payables.filter(p => p.due_date < todayStr || isOverdueTag(p.notes));
  const monthPay = payables.filter(p => !isOverdueTag(p.notes) && p.due_date >= monthStart && p.due_date <= monthEnd);
  const monthPayTotal = monthPay.reduce((a, p) => a + Number(p.amount), 0);
  const overduePayTotal = overduePay.reduce((a, p) => a + Number(p.amount), 0);

  const monthTxNet = transactions
    .filter(t => t.date >= monthStart && t.date <= monthEnd)
    .reduce((a, t) => a + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);
  const saldoProjetado = saldoInicial + monthTxNet + monthRecvTotal - monthPayTotal;

  const [extratoTab, setExtratoTab] = useState<string | null>(null);
  const [expandedOverdue, setExpandedOverdue] = useState<Record<string, boolean>>({});

  const overdueRecvGroups = useMemo(() => {
    const map = new Map<string, { name: string; items: Receivable[]; total: number }>();
    for (const r of overdueRecv) {
      const name = r.client_name?.trim() || "Sem cliente";
      const key = `r:${name}`;
      const g = map.get(key) ?? { name, items: [], total: 0 };
      g.items.push(r);
      g.total += Number(r.amount);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([key, g]) => ({ key, ...g })).sort((a, b) => b.total - a.total);
  }, [overdueRecv]);

  const overduePayGroups = useMemo(() => {
    const map = new Map<string, { name: string; items: Payable[]; total: number }>();
    for (const p of overduePay) {
      const name = p.supplier_name?.trim() || "Sem fornecedor";
      const key = `p:${name}`;
      const g = map.get(key) ?? { name, items: [], total: 0 };
      g.items.push(p);
      g.total += Number(p.amount);
      map.set(key, g);
    }
    return Array.from(map.entries()).map(([key, g]) => ({ key, ...g })).sort((a, b) => b.total - a.total);
  }, [overduePay]);

  const days = eachDayOfInterval({ start: startOfMonth(refMonth), end: endOfMonth(refMonth) });

  const { rows, chart } = useMemo(() => {
    let acc = saldoInicial;
    const rowsArr = days.map(d => {
      const ds = d.toISOString().slice(0, 10);
      const dayTx = transactions.filter(t => t.date === ds);
      const dayRecv = receivables.filter(r => r.due_date === ds && r.due_date >= todayStr && !isOverdueTag(r.notes));
      const dayPay = payables.filter(p => p.due_date === ds && p.due_date >= todayStr && !isOverdueTag(p.notes));
      const recvAsTx = dayRecv.map(r => ({
        id: `r-${r.id}`, description: `${r.description}${r.client_name ? ` (${r.client_name})` : ""}`,
        amount: Number(r.amount), type: "entrada" as const, status: "previsto" as const,
        receivable: r as any,
      }));
      const payAsTx = dayPay.map(p => ({
        id: `p-${p.id}`, description: `${p.description}${p.supplier_name ? ` (${p.supplier_name})` : ""}`,
        amount: Number(p.amount), type: "saida" as const, status: "previsto" as const,
        payable: p as any,
      }));
      const combined: any[] = [...dayTx, ...recvAsTx, ...payAsTx];
      const ent = combined.filter(t => t.type === "entrada").reduce((a, t) => a + Number(t.amount), 0);
      const sai = combined.filter(t => t.type === "saida").reduce((a, t) => a + Number(t.amount), 0);
      const saldoDia = ent - sai;
      acc += saldoDia;
      return { date: ds, label: format(d, "dd/MM"), ent, sai, saldoDia, acc, txs: combined };
    });
    const chartArr = rowsArr.map(r => ({ day: r.label, saldo: r.acc, plano: saldoInicial }));
    return { rows: rowsArr, chart: chartArr };
  }, [transactions, receivables, payables, saldoInicial, refMonth]);


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 bg-card border rounded-xl p-2 sm:p-3">
        <Button variant="outline" size="icon" onClick={() => setRefMonth(m => addMonths(m, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-semibold capitalize">
            {format(refMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          {(refMonth.getMonth() !== today.getMonth() || refMonth.getFullYear() !== today.getFullYear()) && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRefMonth(startOfMonth(today))}>
              Hoje
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => setRefMonth(m => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {(() => {
        const balances: Record<string, number> = {};
        PAYMENT_METHODS.forEach(m => { balances[m] = 0; });
        transactions.filter(t => t.status === "realizado").forEach(t => {
          const key = PAYMENT_METHODS.includes(t.payment_method) ? t.payment_method : "Dinheiro";
          balances[key] += (t.type === "entrada" ? 1 : -1) * Number(t.amount);
        });
        const total = Object.values(balances).reduce((a, b) => a + b, 0);
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Contas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-lg border-2 border-emerald-500/40 p-3 bg-emerald-50 dark:bg-emerald-950/30 flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Saldo Atual</span>
                  <span className={`text-lg font-bold ${total >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(total)}</span>
                </div>
                {PAYMENT_METHODS.map(m => {
                  const v = balances[m] || 0;
                  return (
                    <div key={m} className="rounded-lg border p-3 bg-card flex flex-col gap-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m}</span>
                      <span className={`text-lg font-bold ${v >= 0 ? "" : "text-red-600"}`}>{formatBRL(v)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

        );
      })()}


      <div className="flex flex-wrap gap-2 justify-end">
        <Button onClick={() => { setEditingTx(null); setTxOpen(true); }} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4" /> Novo Lançamento
        </Button>
        <Button onClick={() => setRecvOpen(true)} variant="outline" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Conta a Receber
        </Button>
        <Button onClick={() => setPayOpen(true)} variant="outline" className="gap-2 border-red-300 text-red-700 hover:bg-red-50">
          <Plus className="h-4 w-4" /> Nova Conta a Pagar
        </Button>
      </div>

      <TransactionDialog
        open={txOpen}
        onOpenChange={(o) => { setTxOpen(o); if (!o) setEditingTx(null); }}
        categories={categories}
        userId={userId}
        initial={editingTx}
        onSaved={() => { reload(); loadReceivables(); loadPayables(); }}
      />

      <Dialog open={recvOpen} onOpenChange={(o) => { setRecvOpen(o); if (!o) setEditingRecvId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingRecvId ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Descrição *</Label>
              <Input value={recvForm.description} onChange={e => setRecvForm({ ...recvForm, description: e.target.value })} /></div>
            <div><Label>Cliente</Label>
              <Input value={recvForm.client_name} onChange={e => setRecvForm({ ...recvForm, client_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={recvForm.amount} onChange={e => setRecvForm({ ...recvForm, amount: e.target.value })} /></div>
              <div><Label>Vencimento *</Label>
                <Input type="date" value={recvForm.due_date} onChange={e => setRecvForm({ ...recvForm, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={recvForm.category} onValueChange={v => setRecvForm({ ...recvForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {entradaCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={recvForm.payment_method} onValueChange={v => setRecvForm({ ...recvForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
            <div><Label>Observações</Label>
              <Textarea value={recvForm.notes} onChange={e => setRecvForm({ ...recvForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecvOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleSaveRecv("one")} disabled={savingRecv}>{savingRecv ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={(o) => { setPayOpen(o); if (!o) setEditingPayId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingPayId ? "Editar Conta a Pagar" : "Nova Conta a Pagar"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Descrição *</Label>
              <Input value={payForm.description} onChange={e => setPayForm({ ...payForm, description: e.target.value })} /></div>
            <div><Label>Fornecedor</Label>
              <Input value={payForm.supplier_name} onChange={e => setPayForm({ ...payForm, supplier_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} /></div>
              <div><Label>Vencimento *</Label>
                <Input type="date" value={payForm.due_date} onChange={e => setPayForm({ ...payForm, due_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Categoria</Label>
                <Select value={payForm.category} onValueChange={v => setPayForm({ ...payForm, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {saidaCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select></div>
              <div><Label>Forma de Pagamento</Label>
                <Select value={payForm.payment_method} onValueChange={v => setPayForm({ ...payForm, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select></div>
            </div>
            <div><Label>Observações</Label>
              <Textarea value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={() => handleSavePay("one")} disabled={savingPay}>{savingPay ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo Inicial</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoInicial >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatBRL(saldoInicial)}</div>
            <p className="text-xs text-muted-foreground mt-1">Realizado até o mês</p>
          </CardContent>
        </Card>
        <Card role="button" tabIndex={0} onClick={() => setExtratoTab("receber")} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">A Receber no Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatBRL(monthRecvTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">{monthRecv.length} conta(s) prevista(s)</p>
          </CardContent>
        </Card>
        <Card role="button" tabIndex={0} onClick={() => setExtratoTab("pagar")} className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader className="pb-2"><CardTitle className="text-sm">A Pagar no Mês</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatBRL(monthPayTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">{monthPay.length} conta(s) prevista(s)</p>
          </CardContent>
        </Card>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setExtratoTab("atrasado")}
          className={`cursor-pointer hover:shadow-md transition-shadow ${(overdueTotal + overduePayTotal) > 0 ? "border-red-400" : ""}`}
        >
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1">
            {(overdueTotal + overduePayTotal) > 0 && <AlertTriangle className="h-4 w-4 text-red-600" />} Atrasado
          </CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(overdueTotal + overduePayTotal) > 0 ? "text-red-600" : ""}`}>{formatBRL(overdueTotal + overduePayTotal)}</div>
            <p className="text-xs text-muted-foreground mt-1">{overdueRecv.length + overduePay.length} conta(s) vencida(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo Projetado</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${saldoProjetado >= 0 ? "text-purple-700 dark:text-purple-400" : "text-red-600"}`}>{formatBRL(saldoProjetado)}</div>
            <p className="text-xs text-muted-foreground mt-1">Inicial + previsto do mês</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!extratoTab} onOpenChange={(o) => !o && setExtratoTab(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Extrato de Contas</DialogTitle></DialogHeader>
          <Tabs value={extratoTab ?? "receber"} onValueChange={setExtratoTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="receber">A Receber ({monthRecv.length})</TabsTrigger>
              <TabsTrigger value="pagar">A Pagar ({monthPay.length})</TabsTrigger>
              <TabsTrigger value="atrasado">Atrasado ({overdueRecv.length + overduePay.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="receber" className="max-h-[60vh] overflow-y-auto">
              {monthRecv.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta a receber no mês.</p>
              ) : (
                <ul className="divide-y">
                  {monthRecv.map(r => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{r.description}{r.client_name ? ` — ${r.client_name}` : ""}</div>
                        <div className="text-xs text-muted-foreground">Venc: {r.due_date.split("-").reverse().join("/")}</div>
                      </div>
                      <span className="font-semibold text-emerald-600 tabular-nums">{formatBRL(Number(r.amount))}</span>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={payingId === r.id} onClick={() => markRecvPaid(r)}>
                          <Check className="h-3.5 w-3.5" /> Pago
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRecv(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingRecv(r)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="pagar" className="max-h-[60vh] overflow-y-auto">
              {monthPay.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta a pagar no mês.</p>
              ) : (
                <ul className="divide-y">
                  {monthPay.map(p => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{p.description}{p.supplier_name ? ` — ${p.supplier_name}` : ""}</div>
                        <div className="text-xs text-muted-foreground">Venc: {p.due_date.split("-").reverse().join("/")}</div>
                      </div>
                      <span className="font-semibold text-red-600 tabular-nums">{formatBRL(Number(p.amount))}</span>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={payingId === p.id} onClick={() => markPayPaid(p)}>
                          <Check className="h-3.5 w-3.5" /> Pago
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPay(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingPay(p)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="atrasado" className="max-h-[60vh] overflow-y-auto">
              {overdueRecvGroups.length === 0 && overduePayGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma conta atrasada.</p>
              ) : (
                <ul className="divide-y">
                  {overdueRecvGroups.map(g => {
                    const expanded = !!expandedOverdue[g.key];
                    const single = g.items.length === 1;
                    return (
                      <li key={g.key} className="py-2 text-sm">
                        <div
                          className={`flex flex-wrap items-center justify-between gap-2 ${single ? "" : "cursor-pointer hover:bg-muted/50 rounded px-1"}`}
                          onClick={() => !single && setExpandedOverdue(s => ({ ...s, [g.key]: !s[g.key] }))}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            {!single && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                            <div
                              className={`min-w-0 ${single ? "cursor-pointer hover:underline" : ""}`}
                              onClick={(e) => { if (single) { e.stopPropagation(); openReceiptForReceivable(g.items[0]); } }}
                              title={single ? "Ver espelho do pedido" : undefined}
                            >
                              <div className="font-medium truncate">{g.name}</div>
                              <div className="text-xs text-red-600">
                                {(() => {
                                  const info = single ? overdueInfoByReceivable[g.items[0].id] : null;
                                  const pkgs = overduePacotesByClient[g.name];
                                  if (single) {
                                    const dateStr = info?.date
                                      ? info.date.split("-").reverse().join("/")
                                      : g.items[0].due_date.split("-").reverse().join("/");
                                    return `A receber · Pedido ${dateStr}${pkgs ? ` · ${pkgs} pacote(s)` : ""}`;
                                  }
                                  return `A receber · ${g.items.length} pedido(s) atrasado(s)${pkgs ? ` · ${pkgs} pacote(s)` : ""}`;
                                })()}
                              </div>
                            </div>
                          </div>
                          <span className="font-semibold text-emerald-600 tabular-nums">{formatBRL(g.total)}</span>
                          {single && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={payingId === g.items[0].id} onClick={() => markRecvPaid(g.items[0])}>
                                <Check className="h-3.5 w-3.5" /> Pago
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRecv(g.items[0])}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingRecv(g.items[0])}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                            </div>
                          )}
                        </div>
                        {!single && expanded && (
                          <ul className="mt-2 ml-6 divide-y border-l pl-3">
                            {g.items.map(r => {
                              const info = overdueInfoByReceivable[r.id];
                              const dateStr = info?.date
                                ? info.date.split("-").reverse().join("/")
                                : r.due_date.split("-").reverse().join("/");
                              return (
                              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                <div
                                  className="min-w-0 flex-1 cursor-pointer hover:underline"
                                  onClick={() => openReceiptForReceivable(r)}
                                  title="Ver espelho do pedido"
                                >
                                  <div className="truncate">{r.description}</div>
                                  <div className="text-xs text-red-600">
                                    Pedido {dateStr}{info?.packages ? ` · ${info.packages} pacote(s)` : ""}
                                  </div>
                                </div>
                                <span className="font-semibold text-emerald-600 tabular-nums">{formatBRL(Number(r.amount))}</span>
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={payingId === r.id} onClick={() => markRecvPaid(r)}>
                                    <Check className="h-3.5 w-3.5" /> Pago
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRecv(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingRecv(r)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                                </div>
                              </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                  {overduePayGroups.map(g => {
                    const expanded = !!expandedOverdue[g.key];
                    const single = g.items.length === 1;
                    return (
                      <li key={g.key} className="py-2 text-sm">
                        <div
                          className={`flex flex-wrap items-center justify-between gap-2 ${single ? "" : "cursor-pointer hover:bg-muted/50 rounded px-1"}`}
                          onClick={() => !single && setExpandedOverdue(s => ({ ...s, [g.key]: !s[g.key] }))}
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            {!single && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                            <div className="min-w-0">
                              <div className="font-medium truncate">{single ? `${g.name} — ${g.items[0].description}` : g.name}</div>
                              <div className="text-xs text-red-600">
                                {single
                                  ? `A pagar · Venc: ${g.items[0].due_date.split("-").reverse().join("/")}`
                                  : `A pagar · ${g.items.length} conta(s) atrasada(s)`}
                              </div>
                            </div>
                          </div>
                          <span className="font-semibold text-red-600 tabular-nums">{formatBRL(g.total)}</span>
                          {single && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={payingId === g.items[0].id} onClick={() => markPayPaid(g.items[0])}>
                                <Check className="h-3.5 w-3.5" /> Pago
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPay(g.items[0])}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingPay(g.items[0])}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                            </div>
                          )}
                        </div>
                        {!single && expanded && (
                          <ul className="mt-2 ml-6 divide-y border-l pl-3">
                            {g.items.map(p => (
                              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="truncate">{p.description}</div>
                                  <div className="text-xs text-red-600">Venc: {p.due_date.split("-").reverse().join("/")}</div>
                                </div>
                                <span className="font-semibold text-red-600 tabular-nums">{formatBRL(Number(p.amount))}</span>
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700" disabled={payingId === p.id} onClick={() => markPayPaid(p)}>
                                    <Check className="h-3.5 w-3.5" /> Pago
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPay(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeletingPay(p)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptData} onOpenChange={(o) => !o && setReceiptData(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Espelho do Pedido {receiptData?.sale?.order_number ? `#${receiptData.sale.order_number}` : ""}</DialogTitle>
          </DialogHeader>
          {receiptData && <OrderReceipt data={receiptData} />}
        </DialogContent>
      </Dialog>







      <Card>
        <CardHeader><CardTitle>Projeção — {format(refMonth, "MM/yyyy")}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={10} interval={4} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="plano" name="Saldo plano" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="saldo" name="Projeção" stroke="#2563eb" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Detalhamento Diário</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map(r => {
            const sem = r.txs.length === 0;
            const negativo = r.acc < 0;
            return (
              <div key={r.date} className={`rounded-md border ${negativo ? "border-red-300 bg-red-50/60 dark:bg-red-950/20" : "bg-card"}`}>
                <div className={`px-3 py-2 font-semibold ${sem ? "text-muted-foreground" : ""}`}>{r.label}</div>
                {r.txs.length > 0 && (
                  <ul className="divide-y divide-border/60 border-t bg-muted/30">
                    {r.txs.map((t: any) => (
                      <li key={t.id} className={`flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-sm ${t.status === "previsto" ? "italic opacity-70" : ""}`}>
                        <span className="truncate min-w-0 flex-1">{t.description}</span>
                        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                          <Select
                            value={t.payment_method || t.receivable?.payment_method || t.payable?.payment_method || ""}
                            onValueChange={async (v) => {
                              let err: any = null;
                              if (t.receivable) {
                                ({ error: err } = await supabase.from("fin_receivables").update({ payment_method: v }).eq("id", t.receivable.id));
                                if (!err) loadReceivables();
                              } else if (t.payable) {
                                ({ error: err } = await supabase.from("fin_payables" as any).update({ payment_method: v }).eq("id", t.payable.id));
                                if (!err) loadPayables();
                              } else {
                                ({ error: err } = await supabase.from("fin_transactions").update({ payment_method: v }).eq("id", t.id));
                                if (!err) await reload();
                              }
                              if (err) toast.error("Erro ao alterar conta");
                              else toast.success("Conta alterada");
                            }}
                          >
                            <SelectTrigger className="h-6 w-24 text-[11px] not-italic px-2 py-0">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span className={`tabular-nums whitespace-nowrap font-medium ${t.type === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                            {t.type === "entrada" ? "+" : "−"} {formatBRL(Number(t.amount))}
                          </span>
                          {t.receivable && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 not-italic"
                                disabled={payingId === t.receivable.id}
                                onClick={() => markRecvPaid(t.receivable)}
                              >
                                <Check className="h-3.5 w-3.5" /> Pago
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 not-italic" onClick={() => openEditRecv(t.receivable)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 not-italic" onClick={() => setDeletingRecv(t.receivable)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </>
                          )}
                          {t.payable && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 not-italic"
                                disabled={payingId === t.payable.id}
                                onClick={() => markPayPaid(t.payable)}
                              >
                                <Check className="h-3.5 w-3.5" /> Pago
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 not-italic" onClick={() => openEditPay(t.payable)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 not-italic" onClick={() => setDeletingPay(t.payable)}>
                                <Trash2 className="h-3.5 w-3.5 text-red-600" />
                              </Button>
                            </>
                          )}
                           {!t.receivable && !t.payable && (
                             <>
                               {t.status === "previsto" && (
                                 <Button
                                   size="sm"
                                   className="h-7 gap-1 bg-emerald-600 hover:bg-emerald-700 not-italic"
                                   disabled={payingId === t.id}
                                   onClick={() => markTxPaid(t as Transaction)}
                                 >
                                   <Check className="h-3.5 w-3.5" /> Pago
                                 </Button>
                               )}
                               <Button size="icon" variant="ghost" className="h-7 w-7 not-italic" onClick={() => { setEditingTx(t as Transaction); setTxOpen(true); }}>
                                 <Pencil className="h-3.5 w-3.5" />
                               </Button>
                               <Button size="icon" variant="ghost" className="h-7 w-7 not-italic" onClick={() => setDeletingTx(t as Transaction)}>
                                 <Trash2 className="h-3.5 w-3.5 text-red-600" />
                               </Button>
                             </>
                           )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className={`flex flex-wrap items-center justify-end gap-x-5 gap-y-1 px-3 py-2 text-xs sm:text-sm tabular-nums border-t ${sem ? "text-muted-foreground" : ""}`}>
                  <span className="text-emerald-600">Entradas: {r.ent ? formatBRL(r.ent) : "—"}</span>
                  <span className="text-red-600">Saídas: {r.sai ? formatBRL(r.sai) : "—"}</span>
                  <span className={r.saldoDia >= 0 ? "" : "text-red-600"}>Saldo dia: {r.saldoDia ? formatBRL(r.saldoDia) : "—"}</span>
                  <span className={`font-semibold ${negativo ? "text-red-600" : "text-blue-600"}`}>Projetado: {formatBRL(r.acc)}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingTx} onOpenChange={(o) => !o && setDeletingTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingTx?.description}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTx} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingRecv} onOpenChange={(o) => !o && setDeletingRecv(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a receber?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingRecv?.description}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deletingRecv && PARCELA_RE.test(deletingRecv.description) ? (
              <>
                <Button variant="secondary" onClick={() => handleDeleteRecv("one")}>Somente esta</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeleteRecv("future")}>Esta e as próximas</Button>
              </>
            ) : (
              <AlertDialogAction onClick={() => handleDeleteRecv("one")} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingPay} onOpenChange={(o) => !o && setDeletingPay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a pagar?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingPay?.description}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deletingPay && PARCELA_RE.test(deletingPay.description) ? (
              <>
                <Button variant="secondary" onClick={() => handleDeletePay("one")}>Somente esta</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDeletePay("future")}>Esta e as próximas</Button>
              </>
            ) : (
              <AlertDialogAction onClick={() => handleDeletePay("one")} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={scopeRecvEditOpen} onOpenChange={setScopeRecvEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar alteração em quais parcelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é uma parcela recorrente. Você quer alterar somente esta ou também as próximas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setScopeRecvEditOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => { setScopeRecvEditOpen(false); setOriginalRecv(null); handleSaveRecv("one"); }}>Somente esta</Button>
            <Button onClick={() => { setScopeRecvEditOpen(false); handleSaveRecv("future"); }}>Esta e as próximas</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={scopePayEditOpen} onOpenChange={setScopePayEditOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar alteração em quais parcelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é uma parcela recorrente. Você quer alterar somente esta ou também as próximas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setScopePayEditOpen(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={() => { setScopePayEditOpen(false); setOriginalPay(null); handleSavePay("one"); }}>Somente esta</Button>
            <Button onClick={() => { setScopePayEditOpen(false); handleSavePay("future"); }}>Esta e as próximas</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

