import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Category, formatBRL, PAYMENT_METHODS } from "./useFinanceData";

export interface Payable {
  id: string;
  description: string;
  supplier_name: string | null;
  amount: number;
  due_date: string;
  category: string | null;
  payment_method: string | null;
  notes: string | null;
  status: string;
}

interface Props {
  userId?: string;
  categories: Category[];
  reloadTransactions: () => Promise<void> | void;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ContasPagar({ userId, categories, reloadTransactions }: Props) {
  const [items, setItems] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    description: "",
    supplier_name: "",
    amount: "",
    due_date: todayStr(),
    category: "",
    payment_method: "Dinheiro",
    notes: "",
  });

  const saidaCats = categories.filter(c => c.type === "saida");

  async function load() {
    if (!userId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fin_payables" as any)
      .select("*")
      .eq("status", "aberto")
      .order("due_date", { ascending: true });
    if (error) toast.error("Erro ao carregar contas a pagar");
    setItems(((data || []) as unknown) as Payable[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [userId]);

  function resetForm() {
    setForm({
      description: "", supplier_name: "", amount: "", due_date: todayStr(),
      category: "", payment_method: "Dinheiro", notes: "",
    });
  }

  async function handleCreate() {
    if (!userId) return;
    if (!form.description.trim() || !form.amount || !form.due_date) {
      toast.error("Preencha descrição, valor e vencimento");
      return;
    }
    const { error } = await supabase.from("fin_payables" as any).insert({
      user_id: userId,
      description: form.description.trim(),
      supplier_name: form.supplier_name.trim() || null,
      amount: Number(form.amount),
      due_date: form.due_date,
      category: form.category || null,
      payment_method: form.payment_method || null,
      notes: form.notes.trim() || null,
      status: "aberto",
    });
    if (error) { toast.error("Erro ao criar conta"); return; }
    toast.success("Conta a pagar criada");
    setOpen(false);
    resetForm();
    load();
  }

  async function markPaid(r: Payable) {
    if (!userId) return;
    const today = todayStr();
    const { error: txErr } = await supabase.from("fin_transactions").insert({
      user_id: userId,
      description: r.description,
      amount: r.amount,
      type: "saida",
      category: r.category || "Outras Despesas",
      date: today,
      status: "realizado",
      payment_method: r.payment_method || "Dinheiro",
      notes: [r.notes, r.supplier_name ? `Fornecedor: ${r.supplier_name}` : null, "(origem: contas a pagar)"].filter(Boolean).join(" • "),
    });
    if (txErr) { toast.error("Erro ao lançar no fluxo"); return; }
    const { error: upErr } = await supabase
      .from("fin_payables" as any)
      .update({ status: "pago", paid_at: new Date().toISOString() })
      .eq("id", r.id);
    if (upErr) { toast.error("Erro ao baixar conta"); return; }
    toast.success("Pagamento lançado no fluxo");
    await Promise.all([load(), reloadTransactions()]);
  }

  async function remove(r: Payable) {
    if (!confirm(`Excluir "${r.description}"?`)) return;
    const { error } = await supabase.from("fin_payables" as any).delete().eq("id", r.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluído");
    load();
  }

  const today = todayStr();
  const totals = useMemo(() => {
    const total = items.reduce((a, r) => a + Number(r.amount), 0);
    const overdue = items.filter(r => r.due_date < today).reduce((a, r) => a + Number(r.amount), 0);
    return { total, overdue, count: items.length };
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Total em aberto</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatBRL(totals.total)}</div>
            <p className="text-xs text-muted-foreground">{totals.count} conta(s)</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Atrasado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{formatBRL(totals.overdue)}</div></CardContent></Card>
        <Card className="flex items-center justify-center">
          <CardContent className="pt-6">
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> Nova Conta a Pagar</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <div><Label>Descrição *</Label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
                  <div><Label>Fornecedor</Label>
                    <Input value={form.supplier_name} onChange={e => setForm({ ...form, supplier_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Valor (R$) *</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
                    <div><Label>Vencimento *</Label>
                      <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Categoria</Label>
                      <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {saidaCats.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select></div>
                    <div><Label>Forma de Pagamento</Label>
                      <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select></div>
                  </div>
                  <div><Label>Observações</Label>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Em aberto</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? <div className="py-6 text-center text-muted-foreground">Carregando...</div> :
            items.length === 0 ? <div className="py-6 text-center text-muted-foreground">Nenhuma conta a pagar.</div> :
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Vencimento</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Fornecedor</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map(r => {
                  const atrasado = r.due_date < today;
                  return (
                    <tr key={r.id} className={`border-b ${atrasado ? "bg-red-50 dark:bg-red-950/30" : ""}`}>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.due_date.split("-").reverse().join("/")}</td>
                      <td className="py-2 pr-3">{r.description}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.supplier_name || "—"}</td>
                      <td className="py-2 pr-3 text-right font-semibold">{formatBRL(Number(r.amount))}</td>
                      <td className="py-2 pr-3">
                        {atrasado ? (
                          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Atrasado</Badge>
                        ) : (
                          <Badge variant="outline">Em aberto</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="default" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => markPaid(r)}>
                            <Check className="h-3.5 w-3.5" /> Pago
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          }
        </CardContent>
      </Card>
    </div>
  );
}
