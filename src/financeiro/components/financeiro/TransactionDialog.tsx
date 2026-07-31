import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";

const PARCELA_RE = /^(.*)\s\((\d+)\/(\d+)\)\s*$/;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Category, CLOSING_GROUPS, ClosingGroup, PAYMENT_METHODS, Transaction, TxStatus, TxType } from "./useFinanceData";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: Category[];
  userId?: string;
  initial?: Transaction | null;
  onSaved: () => void;
}

export default function TransactionDialog({ open, onOpenChange, categories, userId, initial, onSaved }: Props) {
  const [type, setType] = useState<TxType>("entrada");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newCategoryGroup, setNewCategoryGroup] = useState<ClosingGroup | "__none__">("__none__");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [account, setAccount] = useState<string>("");
  const [status, setStatus] = useState<TxStatus>("realizado");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [scopeAsked, setScopeAsked] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [recurring, setRecurring] = useState(false);
  const [recFreq, setRecFreq] = useState<"mensal" | "semanal" | "indefinido">("mensal");
  const [recMode, setRecMode] = useState<"parcelas" | "indefinido">("parcelas");
  const [recCount, setRecCount] = useState("12");
  const [recStart, setRecStart] = useState("1");
  const [recEnd, setRecEnd] = useState("12");

  async function createCategory(name: string) {
    if (!userId || !name.trim()) return;
    if (newCategoryGroup === "__none__") {
      toast.error("Selecione o grupo no Fechamento para a nova categoria.");
      return;
    }
    const color = type === "entrada" ? "#16a34a" : "#dc2626";
    const { error } = await supabase.from("fin_categories").insert({
      name: name.trim(),
      type,
      color,
      user_id: userId,
      closing_group: newCategoryGroup,
    });
    if (error) { toast.error(error.message); return; }
    setCategory(name.trim());
    setNewCategory("");
    setNewCategoryGroup("__none__");
    onSaved();
    toast.success("Categoria criada");
  }

  useEffect(() => {
    if (open) {
      if (initial) {
        setType(initial.type);
        setDescription(initial.description);
        setAmount(String(initial.amount).replace(".", ","));
        setDate(initial.date);
        setCategory(initial.category);
        setPaymentMethod(initial.payment_method);
        setAccount((initial as any).account || "");
        setStatus(initial.status);
        setNotes(initial.notes || "");
        setRecurring(false);
      } else {
        setType("entrada");
        setDescription("");
        setAmount("");
        setDate(new Date().toISOString().slice(0, 10));
        setCategory("");
        setPaymentMethod("Dinheiro");
        setAccount("");
        setStatus("realizado");
        setNotes("");
        setRecurring(false);
        setRecFreq("mensal");
        setRecMode("parcelas");
        setRecCount("12");
        setRecStart("1");
        setRecEnd("12");
      }
    }
  }, [open, initial]);

  useEffect(() => {
    if (!initial && date > new Date().toISOString().slice(0, 10)) {
      setStatus("previsto");
    }
  }, [date, initial]);

  const filteredCats = categories.filter(c => c.type === type);

  async function handleSave(scope: "one" | "future" = "one") {
    if (!userId) return;
    const parsed = Number(amount.replace(/\./g, "").replace(",", "."));
    const finalDescription = description.trim();
    if (!finalDescription || !parsed || parsed <= 0 || !category) {
      toast.error("Preencha descrição, valor e categoria");
      return;
    }

    // Se estamos editando uma parcela recorrente e o usuário ainda não escolheu o escopo, pergunta
    if (initial && scope === "one") {
      const initMatch = initial.description.match(PARCELA_RE);
      const curMatch = finalDescription.match(PARCELA_RE);
      if (initMatch && curMatch && !scopeAsked) {
        setScopeAsked(true);
        setScopeDialogOpen(true);
        return;
      }
    }

    setSaving(true);
    const base = {
      description: finalDescription,
      amount: parsed,
      type,
      category,
      status,
      payment_method: paymentMethod,
      notes: notes.trim() || null,
      account: account || null,
      user_id: userId,
    };

    if (initial) {
      const res = await supabase.from("fin_transactions").update({ ...base, date }).eq("id", initial.id);
      if (res.error) { setSaving(false); toast.error(res.error.message); return; }

      if (scope === "future") {
        const initMatch = initial.description.match(PARCELA_RE);
        const curMatch = finalDescription.match(PARCELA_RE);
        if (initMatch && curMatch) {
          const oldBase = initMatch[1];
          const total = initMatch[3];
          const newBase = curMatch[1];
          const like = `${oldBase} (%/${total})`;

          const propagate = async (table: "fin_transactions" | "fin_payables" | "fin_receivables", dateCol: "date" | "due_date") => {
            const { data: rows } = await supabase.from(table).select("id, description, " + dateCol).eq("user_id", userId).like("description", like).gt(dateCol, date);
            if (!rows) return;
            for (const r of rows as any[]) {
              const m = (r.description as string).match(PARCELA_RE);
              if (!m) continue;
              const newDesc = `${newBase} (${m[2]}/${m[3]})`;
              const upd: any = {
                description: newDesc,
                amount: parsed,
                category,
                payment_method: paymentMethod,
                notes: notes.trim() || null,
              };
              if (table === "fin_transactions") { upd.type = type; upd.account = account || null; }
              await supabase.from(table).update(upd).eq("id", r.id);
            }
          };

          await propagate("fin_transactions", "date");
          await propagate("fin_payables", "due_date");
          await propagate("fin_receivables", "due_date");
        }
      }

      setSaving(false);
      setScopeAsked(false);
      toast.success(scope === "future" ? "Parcela atual e próximas atualizadas" : "Lançamento atualizado");
      onSaved();
      onOpenChange(false);
      return;
    }



    const dates: string[] = [date];
    let startInst = 1;
    let endInst = 1;
    if (recurring) {
      const [y, m, d] = date.split("-").map(Number);
      // "indefinido" gera 24 meses ou 104 semanas à frente
      const indef = recMode === "indefinido" || recFreq === "indefinido";
      const defaultN = recFreq === "semanal" ? 104 : 24;
      let n: number;
      if (indef) {
        n = defaultN;
        startInst = 1;
        endInst = n;
      } else {
        const s = Math.max(1, parseInt(recStart) || 1);
        const e = Math.max(s, parseInt(recEnd) || s);
        startInst = s;
        endInst = Math.min(s + 239, e);
        n = endInst - startInst + 1;
      }
      for (let i = 1; i < n; i++) {
        let iso: string;
        if (recFreq === "semanal") {
          const nd = new Date(y, m - 1, d);
          nd.setDate(nd.getDate() + i * 7);
          iso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
        } else {
          const nd = new Date(y, m - 1 + i, 1);
          const lastDay = new Date(nd.getFullYear(), nd.getMonth() + 1, 0).getDate();
          nd.setDate(Math.min(d, lastDay));
          iso = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}-${String(nd.getDate()).padStart(2, "0")}`;
        }
        dates.push(iso);
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const showParcela = recurring && recMode === "parcelas" && recFreq !== "indefinido" && dates.length > 1;
    const rows = dates.map((dt, idx) => ({
      ...base,
      description: showParcela ? `${base.description} (${startInst + idx}/${endInst})` : base.description,
      date: dt,
      status: (idx === 0 ? status : (dt > today ? "previsto" : status)) as TxStatus,
    }));

    const futureRows = rows.filter(r => r.date > today);
    const currentRows = rows.filter(r => r.date <= today);

    let futureErr: any = null;
    if (futureRows.length > 0) {
      if (type === "entrada") {
        const recvRows = futureRows.map(r => ({
          user_id: userId,
          description: r.description,
          amount: r.amount,
          due_date: r.date,
          category: r.category,
          payment_method: r.payment_method,
          notes: r.notes,
          status: "aberto",
        }));
        const res = await supabase.from("fin_receivables").insert(recvRows);
        futureErr = res.error;
      } else {
        const payRows = futureRows.map(r => ({
          user_id: userId,
          description: r.description,
          amount: r.amount,
          due_date: r.date,
          category: r.category,
          payment_method: r.payment_method,
          notes: r.notes,
          status: "aberto",
        }));
        const res = await supabase.from("fin_payables").insert(payRows);
        futureErr = res.error;
      }
    }

    let curErr: any = null;
    if (currentRows.length > 0) {
      const res = await supabase.from("fin_transactions").insert(currentRows);
      curErr = res.error;
    }

    setSaving(false);
    if (futureErr || curErr) { toast.error((futureErr || curErr).message); return; }
    toast.success(rows.length > 1 ? `${rows.length} lançamentos criados` : "Lançamento criado");
    onSaved();
    onOpenChange(false);
  }

  const isEntrada = type === "entrada";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg border-t-4 ${isEntrada ? "border-t-emerald-500" : "border-t-red-500"}`}>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={isEntrada ? "default" : "outline"}
                className={isEntrada ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                onClick={() => { setType("entrada"); setCategory(""); }}
              >ENTRADA</Button>
              <Button
                type="button"
                variant={!isEntrada ? "default" : "outline"}
                className={!isEntrada ? "bg-red-600 hover:bg-red-700 text-white" : ""}
                onClick={() => { setType("saida"); setCategory(""); }}
              >SAÍDA</Button>
            </div>

            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Venda gelo, conta de luz..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {filteredCats.map(c => (
                      <SelectItem key={c.id} value={c.name}>
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); createCategory(newCategory); } }}
                    placeholder="+ Criar nova categoria"
                    className="text-xs h-8"
                  />
                  <Button type="button" size="sm" variant="secondary" className="h-8" disabled={!newCategory.trim()} onClick={() => createCategory(newCategory)}>Criar</Button>
                </div>
                {newCategory.trim() && (
                  <div className="mt-2">
                    <Label className="text-xs">Grupo no Fechamento *</Label>
                    <Select value={newCategoryGroup} onValueChange={(v) => setNewCategoryGroup(v as any)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione o grupo..." /></SelectTrigger>
                      <SelectContent>
                        {CLOSING_GROUPS.filter(g => g.type === type).map(g => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div>
                <Label>Forma de Pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>



            <div>
              <Label>Status</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Button type="button" variant={status === "realizado" ? "default" : "outline"} onClick={() => setStatus("realizado")}>Realizado</Button>
                <Button type="button" variant={status === "previsto" ? "default" : "outline"} onClick={() => setStatus("previsto")}>Previsto</Button>
              </div>
            </div>

            {!initial && (
              <div className="rounded-md border p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} className="h-4 w-4" />
                  Repetir pagamento
                </label>
                {recurring && (
                  <div className="pl-6 space-y-3">
                    <div>
                      <Label className="text-xs">Frequência</Label>
                      <Select value={recFreq} onValueChange={(v: any) => { setRecFreq(v); if (v === "indefinido") setRecMode("indefinido"); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="indefinido">Indefinido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {recFreq !== "indefinido" && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" size="sm" variant={recMode === "parcelas" ? "default" : "outline"} onClick={() => setRecMode("parcelas")}>Nº de parcelas</Button>
                          <Button type="button" size="sm" variant={recMode === "indefinido" ? "default" : "outline"} onClick={() => setRecMode("indefinido")}>Indefinido</Button>
                        </div>
                        {recMode === "parcelas" && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-xs">Parcela inicial</Label>
                                <Input type="number" min={1} max={240} value={recStart} onChange={e => setRecStart(e.target.value)} />
                              </div>
                              <div>
                                <Label className="text-xs">Parcela final</Label>
                                <Input type="number" min={1} max={240} value={recEnd} onChange={e => setRecEnd(e.target.value)} />
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Ex.: 4 e 10 → serão criadas as parcelas 4/10 até 10/10 a partir da data acima.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {(recFreq === "indefinido" || recMode === "indefinido") && (
                      <p className="text-xs text-muted-foreground">
                        Serão gerados {recFreq === "semanal" ? "104 lançamentos semanais (~2 anos)" : "24 lançamentos mensais (2 anos)"} como previstos.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label>Observações</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => handleSave("one")} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={scopeDialogOpen} onOpenChange={(o) => { setScopeDialogOpen(o); if (!o) setScopeAsked(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar alteração em quais parcelas?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta é uma parcela recorrente. Você quer alterar somente esta ou também as próximas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => { setScopeDialogOpen(false); setScopeAsked(false); }}>Cancelar</Button>
            <Button variant="secondary" onClick={() => { setScopeDialogOpen(false); handleSave("one"); }}>Somente esta</Button>
            <Button onClick={() => { setScopeDialogOpen(false); handleSave("future"); }}>Esta e as próximas</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

