import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Category, CLOSING_GROUPS, ClosingGroup, Transaction, TxStatus, TxType, formatBRL } from "./useFinanceData";
import { format, parseISO } from "date-fns";
import TransactionDialog from "./TransactionDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PAGE_SIZE = 20;
const PARCELA_RE = /^(.*)\s\((\d+)\/(\d+)\)\s*$/;

export default function Lancamentos({
  transactions, categories, userId, reload,
}: { transactions: Transaction[]; categories: Category[]; userId?: string; reload: () => void }) {
  const [typeFilter, setTypeFilter] = useState<"all" | TxType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TxStatus>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [groupFilter, setGroupFilter] = useState<"all" | ClosingGroup>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const groupByCat = useMemo(() => {
    const m = new Map<string, ClosingGroup | null | undefined>();
    categories.forEach(c => m.set(c.name, c.closing_group));
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (catFilter !== "all" && t.category !== catFilter) return false;
      if (groupFilter !== "all" && groupByCat.get(t.category) !== groupFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, typeFilter, statusFilter, catFilter, groupFilter, groupByCat, search, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const catColor = (name: string) => categories.find(c => c.name === name)?.color || "#64748b";

  async function handleDelete(scope: "one" | "future" = "one") {
    if (!deleting) return;
    const { error } = await supabase.from("fin_transactions").delete().eq("id", deleting.id);
    if (error) { toast.error(error.message); return; }

    if (scope === "future" && userId) {
      const m = deleting.description.match(PARCELA_RE);
      if (m) {
        const base = m[1];
        const total = m[3];
        const like = `${base} (%/${total})`;
        const delFuture = async (table: "fin_transactions" | "fin_payables" | "fin_receivables", dateCol: "date" | "due_date") => {
          await supabase.from(table).delete().eq("user_id", userId).like("description", like).gt(dateCol, deleting.date);
        };
        await delFuture("fin_transactions", "date");
        await delFuture("fin_payables", "due_date");
        await delFuture("fin_receivables", "due_date");
      }
    }

    toast.success(scope === "future" ? "Parcela atual e próximas excluídas" : "Lançamento excluído");
    setDeleting(null);
    reload();
  }

  const isRecurringDelete = !!deleting && PARCELA_RE.test(deleting.description);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lançamentos</CardTitle>
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Lançamento
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            <Select value={typeFilter} onValueChange={(v: any) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="realizado">Realizados</SelectItem>
                <SelectItem value="previsto">Previstos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={(v) => { setCatFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={(v: any) => { setGroupFilter(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Grupo de fechamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {CLOSING_GROUPS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
            <Input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} />
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar..." className="pl-8" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr>
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Descrição</th>
                  <th className="py-2 pr-3">Categoria</th>
                  <th className="py-2 pr-3">Pagamento</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(t => (
                  <tr key={t.id} className={`border-b ${t.status === "previsto" ? "opacity-70 italic" : ""}`}>
                    <td className="py-2 pr-3 whitespace-nowrap">{format(parseISO(t.date), "dd/MM/yy")}</td>
                    <td className="py-2 pr-3">{t.description}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline" style={{ borderColor: catColor(t.category), color: catColor(t.category) }}>
                        {t.category}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{t.payment_method}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${t.type === "entrada" ? "text-emerald-600" : "text-red-600"}`}>
                      {t.type === "entrada" ? "+" : "−"} {formatBRL(Number(t.amount))}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={t.status === "realizado" ? "default" : "secondary"}>{t.status}</Badge>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleting(t)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {pageItems.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">Nenhum lançamento encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">{filtered.length} resultado(s)</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        userId={userId}
        initial={editing}
        onSaved={reload}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.description}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {isRecurringDelete ? (
              <>
                <Button variant="secondary" onClick={() => handleDelete("one")}>Somente esta</Button>
                <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleDelete("future")}>Esta e as próximas</Button>
              </>
            ) : (
              <AlertDialogAction onClick={() => handleDelete("one")} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
