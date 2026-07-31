import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowRight, ArrowRightLeft, Trash2 } from "lucide-react";
import { PAYMENT_METHODS, formatBRL } from "./useFinanceData";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TRF_TAG = "#TRF:";

interface TransferRow {
  token: string;
  date: string;
  amount: number;
  from: string;
  to: string;
  ids: string[];
}

export default function Transferencias({ userId, reload }: { userId?: string; reload: () => Promise<void> | void }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState("Caixa");
  const [to, setTo] = useState("Inter");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [deleting, setDeleting] = useState<TransferRow | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("fin_transactions")
      .select("id,date,amount,type,payment_method,notes")
      .eq("user_id", userId)
      .eq("category", "Transferência")
      .order("date", { ascending: false })
      .limit(500);
    const map = new Map<string, TransferRow>();
    (data || []).forEach((t: any) => {
      const idx = (t.notes || "").indexOf(TRF_TAG);
      if (idx < 0) return;
      const token = (t.notes as string).slice(idx + TRF_TAG.length).split(/\s/)[0];
      const existing = map.get(token) || { token, date: t.date, amount: Number(t.amount), from: "", to: "", ids: [] as string[] };
      if (t.type === "saida") existing.from = t.payment_method;
      else existing.to = t.payment_method;
      existing.ids.push(t.id);
      existing.date = t.date;
      existing.amount = Number(t.amount);
      map.set(token, existing);
    });
    setRows(Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date)));
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  async function ensureCategory() {
    if (!userId) return;
    await supabase.from("fin_categories").upsert(
      [
        { user_id: userId, name: "Transferência", type: "entrada", color: "#6366f1" },
        { user_id: userId, name: "Transferência", type: "saida", color: "#6366f1" },
      ],
      { onConflict: "user_id,name,type", ignoreDuplicates: true }
    );
  }

  async function handleSave() {
    if (!userId) return;
    const val = Number(amount);
    if (!val || val <= 0) { toast.error("Informe um valor válido"); return; }
    if (from === to) { toast.error("Origem e destino devem ser diferentes"); return; }
    setSaving(true);
    await ensureCategory();
    const token = crypto.randomUUID();
    const desc = `Transferência ${from} → ${to}`;
    const notes = `${TRF_TAG}${token}`;
    const { error } = await supabase.from("fin_transactions").insert([
      { user_id: userId, description: desc, amount: val, type: "saida", category: "Transferência", date, status: "realizado", payment_method: from, notes },
      { user_id: userId, description: desc, amount: val, type: "entrada", category: "Transferência", date, status: "realizado", payment_method: to, notes },
    ]);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar transferência"); return; }
    toast.success("Transferência registrada");
    setAmount("");
    await load();
    await reload();
  }

  async function handleDelete() {
    if (!deleting) return;
    const { error } = await supabase.from("fin_transactions").delete().in("id", deleting.ids);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Transferência excluída");
    setDeleting(null);
    await load();
    await reload();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" /> Nova Transferência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label>De</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Para</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <ArrowRight className="h-4 w-4" /> {saving ? "Salvando..." : "Transferir"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            A transferência ajusta o saldo de cada conta em <b>Visão Geral</b>, sem alterar o saldo total.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Últimas Transferências</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma transferência registrada</p>
          ) : (
            <div className="divide-y">
              {rows.map(r => (
                <div key={r.token} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted-foreground w-16 shrink-0">{format(parseISO(r.date), "dd/MM/yy")}</span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <span className="font-medium">{r.from || "—"}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium">{r.to || "—"}</span>
                  </div>
                  <span className="tabular-nums font-semibold">{formatBRL(r.amount)}</span>
                  <Button size="icon" variant="ghost" onClick={() => setDeleting(r)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transferência?</AlertDialogTitle>
            <AlertDialogDescription>
              A transferência de {deleting && formatBRL(deleting.amount)} ({deleting?.from} → {deleting?.to}) será removida e os saldos das contas voltarão ao estado anterior.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
