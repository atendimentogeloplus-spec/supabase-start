import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Category, PAYMENT_METHODS, Transaction, formatBRL } from "./useFinanceData";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Wallet, Sparkles, ChevronLeft, ChevronRight, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Period = "week" | "month" | "next30";

export default function VisaoGeral({
  transactions, categories, onViewAll,
}: { transactions: Transaction[]; categories: Category[]; onViewAll: () => void }) {
  const [period, setPeriod] = useState<Period>("month");
  const today = new Date();
  const [refMonth, setRefMonth] = useState<Date>(startOfMonth(today));
  const [openReceivables, setOpenReceivables] = useState<{ amount: number; due_date: string }[]>([]);

  useEffect(() => {
    supabase.from("fin_receivables")
      .select("amount,due_date")
      .eq("status", "aberto")
      .then(({ data }) => setOpenReceivables((data || []) as any));
  }, []);

  const monthStart = startOfMonth(refMonth);
  const monthEnd = endOfMonth(refMonth);
  const monthStartStr = format(monthStart, "yyyy-MM-dd");
  const monthEndStr = format(monthEnd, "yyyy-MM-dd");

  const monthTx = transactions.filter(t => t.date >= monthStartStr && t.date <= monthEndStr);

  const totalEntradas = monthTx.filter(t => t.type === "entrada" && t.status === "realizado").reduce((a, t) => a + Number(t.amount), 0);
  const totalSaidas = monthTx.filter(t => t.type === "saida" && t.status === "realizado").reduce((a, t) => a + Number(t.amount), 0);
  const saldoMes = totalEntradas - totalSaidas;

  const saldoAnterior = transactions
    .filter(t => t.status === "realizado" && t.date < monthStartStr)
    .reduce((a, t) => a + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);

  const recvMesTotal = openReceivables
    .filter(r => r.due_date >= monthStartStr && r.due_date <= monthEndStr)
    .reduce((a, r) => a + Number(r.amount), 0);

  const saldoMesProjetado = monthTx
    .reduce((a, t) => a + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);
  const saldoProjetado = saldoAnterior + saldoMesProjetado + recvMesTotal;

  const accountBalances = useMemo(() => {
    const map: Record<string, number> = {};
    PAYMENT_METHODS.forEach(m => { map[m] = 0; });
    transactions
      .filter(t => t.status === "realizado")
      .forEach(t => {
        const key = PAYMENT_METHODS.includes(t.payment_method) ? t.payment_method : "Dinheiro";
        map[key] += (t.type === "entrada" ? 1 : -1) * Number(t.amount);
      });
    return map;
  }, [transactions]);
  const saldoTotalContas = Object.values(accountBalances).reduce((a, b) => a + b, 0);

  const { chartData } = useMemo(() => {
    let from: Date, to: Date;
    if (period === "week") { from = startOfWeek(today, { weekStartsOn: 1 }); to = endOfWeek(today, { weekStartsOn: 1 }); }
    else if (period === "next30") { from = today; to = addDays(today, 30); }
    else { from = monthStart; to = monthEnd; }

    const days = eachDayOfInterval({ start: from, end: to });
    let acc = transactions
      .filter(t => t.status === "realizado" && parseISO(t.date) < from)
      .reduce((a, t) => a + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);

    const data = days.map(d => {
      const ds = d.toISOString().slice(0, 10);
      const dayTx = transactions.filter(t => t.date === ds);
      const ent = dayTx.filter(t => t.type === "entrada").reduce((a, t) => a + Number(t.amount), 0);
      const sai = dayTx.filter(t => t.type === "saida").reduce((a, t) => a + Number(t.amount), 0);
      const entPrev = dayTx.filter(t => t.type === "entrada" && t.status === "previsto").reduce((a, t) => a + Number(t.amount), 0);
      const saiPrev = dayTx.filter(t => t.type === "saida" && t.status === "previsto").reduce((a, t) => a + Number(t.amount), 0);
      acc += ent - sai;
      return {
        day: format(d, "dd/MM"),
        entradas: ent - entPrev,
        saidas: sai - saiPrev,
        entradasPrev: entPrev,
        saidasPrev: saiPrev,
        saldo: acc,
      };
    });
    return { chartData: data };
  }, [transactions, period, refMonth]);

  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const catColor = (name: string) => categories.find(c => c.name === name)?.color || "#64748b";

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCard title="Saldo Anterior" value={saldoAnterior} icon={<Wallet />} tone={saldoAnterior >= 0 ? "blue" : "red"} />
        <SummaryCard title="Entradas (mês)" value={totalEntradas} icon={<TrendingUp />} tone="emerald" />
        <SummaryCard title="Saídas (mês)" value={totalSaidas} icon={<TrendingDown />} tone="red" />
        <SummaryCard title="Saldo do Mês" value={saldoMes} icon={<Wallet />} tone={saldoMes >= 0 ? "blue" : "red"} />
        <SummaryCard title="Saldo Projetado" value={saldoProjetado} icon={<Sparkles />} tone={saldoProjetado >= 0 ? "purple" : "red"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" /> Contas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg border-2 border-emerald-500/40 p-3 bg-emerald-50 dark:bg-emerald-950/30 flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Saldo Atual</span>
              <span className={`text-lg font-bold ${saldoTotalContas >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatBRL(saldoTotalContas)}</span>
            </div>
            {PAYMENT_METHODS.map(m => {
              const v = accountBalances[m] || 0;
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


      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Fluxo de Caixa</CardTitle>
          <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana atual</SelectItem>
              <SelectItem value="month">Mês atual</SelectItem>
              <SelectItem value="next30">Próximos 30 dias</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="entradas" stackId="e" name="Entradas" fill="#16a34a" />
                <Bar dataKey="entradasPrev" stackId="e" name="Entradas (previstas)" fill="#16a34a" fillOpacity={0.4} />
                <Bar dataKey="saidas" stackId="s" name="Saídas" fill="#dc2626" />
                <Bar dataKey="saidasPrev" stackId="s" name="Saídas (previstas)" fill="#dc2626" fillOpacity={0.4} />
                <Line type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#2563eb" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lançamentos Recentes</CardTitle>
          <Button variant="outline" size="sm" onClick={onViewAll}>Ver todos</Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Descrição</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3">Pagamento</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(t => (
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
                  <td className="py-2">
                    <Badge variant={t.status === "realizado" ? "default" : "secondary"}>{t.status}</Badge>
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum lançamento ainda</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: "emerald" | "red" | "blue" | "purple" }) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    red: "from-red-500/10 to-red-500/5 text-red-700 dark:text-red-400 border-red-500/20",
    blue: "from-blue-500/10 to-blue-500/5 text-blue-700 dark:text-blue-400 border-blue-500/20",
    purple: "from-purple-500/10 to-purple-500/5 text-purple-700 dark:text-purple-400 border-purple-500/20",
  };
  return (
    <Card className={`bg-gradient-to-br border ${tones[tone]}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <div className="text-xl lg:text-2xl font-bold">{formatBRL(value)}</div>
      </CardContent>
    </Card>
  );
}
