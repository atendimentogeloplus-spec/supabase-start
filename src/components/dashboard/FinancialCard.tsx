import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, PiggyBank,
} from "lucide-react";

function fmtBR(n: number, decimals = 2) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pad(n: number) { return String(n).padStart(2, "0"); }

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <span className="text-[10px] text-muted-foreground">—</span>;
  if (previous === 0) return <span className="text-[10px] text-emerald-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />Novo</span>;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const Icon = pct > 0 ? ArrowUpRight : pct < 0 ? ArrowDownRight : Minus;
  const color = pct > 0 ? "text-emerald-600" : pct < 0 ? "text-red-500" : "text-muted-foreground";
  return <span className={`text-[10px] flex items-center gap-0.5 ${color}`}><Icon className="h-3 w-3" />{Math.abs(pct).toFixed(1)}%</span>;
}

interface Props { year: number; month: number; today: Date }

export default function FinancialCard({ year, month, today }: Props) {
  const monthStart = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevStart = `${prevYear}-${pad(prevMonth + 1)}-01`;
  const prevLast = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prevEnd = `${prevYear}-${pad(prevMonth + 1)}-${pad(prevLast)}`;
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const { data, isLoading } = useQuery({
    queryKey: ["fin-dash-card", year, month],
    queryFn: async () => {
      const [txCur, txPrev, recv] = await Promise.all([
        supabase.from("fin_transactions").select("type,amount,date,status").gte("date", monthStart).lte("date", monthEnd),
        supabase.from("fin_transactions").select("type,amount,status").gte("date", prevStart).lte("date", prevEnd),
        supabase.from("fin_receivables").select("amount,due_date,status"),
      ]);
      return {
        cur: (txCur.data || []) as { type: string; amount: number; date: string; status: string }[],
        prev: (txPrev.data || []) as { type: string; amount: number; status: string }[],
        recv: (recv.data || []) as { amount: number; due_date: string; status: string }[],
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  const cur = data?.cur || [];
  const prev = data?.prev || [];
  const recv = data?.recv || [];

  const realizado = (arr: typeof cur) => arr.filter(t => t.status === "realizado");
  const receitas = realizado(cur).filter(t => t.type === "entrada").reduce((a, t) => a + Number(t.amount), 0);
  const despesas = realizado(cur).filter(t => t.type === "saida").reduce((a, t) => a + Number(t.amount), 0);
  const resultado = receitas - despesas;
  const margem = receitas > 0 ? (resultado / receitas) * 100 : 0;

  const prevReceitas = prev.filter(t => t.status === "realizado" && t.type === "entrada").reduce((a, t) => a + Number(t.amount), 0);
  const prevDespesas = prev.filter(t => t.status === "realizado" && t.type === "saida").reduce((a, t) => a + Number(t.amount), 0);
  const prevResultado = prevReceitas - prevDespesas;

  const previstoEntradas = cur.filter(t => t.status === "previsto" && t.type === "entrada").reduce((a, t) => a + Number(t.amount), 0);
  const previstoSaidas = cur.filter(t => t.status === "previsto" && t.type === "saida").reduce((a, t) => a + Number(t.amount), 0);

  const aberto = recv.filter(r => r.status === "aberto");
  const atrasado = aberto.filter(r => r.due_date < todayStr).reduce((a, r) => a + Number(r.amount), 0);
  const atrasadoQtd = aberto.filter(r => r.due_date < todayStr).length;
  const aReceberMes = aberto.filter(r => r.due_date >= monthStart && r.due_date <= monthEnd).reduce((a, r) => a + Number(r.amount), 0);

  // Daily evolution chart
  const chart = (() => {
    const days = Array.from({ length: lastDay }, (_, i) => {
      const ds = `${year}-${pad(month + 1)}-${pad(i + 1)}`;
      return { day: pad(i + 1), ds, ent: 0, sai: 0, saldo: 0 };
    });
    realizado(cur).forEach(t => {
      const d = days.find(x => x.ds === t.date);
      if (!d) return;
      if (t.type === "entrada") d.ent += Number(t.amount);
      else d.sai += Number(t.amount);
    });
    let acc = 0;
    days.forEach(d => { acc += d.ent - d.sai; d.saldo = acc; });
    return days;
  })();

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-emerald-50/30 dark:to-emerald-950/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" /> Financeiro — {new Date(year, month, 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Carregando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Receitas</span>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold text-emerald-600">R$ {fmtBR(receitas)}</div>
                <div className="flex items-center justify-between mt-1">
                  <Delta current={receitas} previous={prevReceitas} />
                  <span className="text-[10px] text-muted-foreground">ant: R${fmtBR(prevReceitas, 0)}</span>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Despesas</span>
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div className="text-lg font-bold text-red-500">R$ {fmtBR(despesas)}</div>
                <div className="flex items-center justify-between mt-1">
                  <Delta current={despesas} previous={prevDespesas} />
                  <span className="text-[10px] text-muted-foreground">ant: R${fmtBR(prevDespesas, 0)}</span>
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Resultado</span>
                  <PiggyBank className={`h-3.5 w-3.5 ${resultado >= 0 ? "text-blue-600" : "text-red-500"}`} />
                </div>
                <div className={`text-lg font-bold ${resultado >= 0 ? "text-blue-600" : "text-red-500"}`}>R$ {fmtBR(resultado)}</div>
                <div className="flex items-center justify-between mt-1">
                  <Delta current={resultado} previous={prevResultado} />
                  <span className="text-[10px] text-muted-foreground">margem {margem.toFixed(1)}%</span>
                </div>
              </div>

              <div className={`rounded-lg border p-3 ${atrasado > 0 ? "border-red-300 bg-red-50/40 dark:bg-red-950/10" : "bg-card"}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">A Receber</span>
                  {atrasado > 0
                    ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    : <Wallet className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
                <div className="text-lg font-bold">R$ {fmtBR(aReceberMes)}</div>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] ${atrasado > 0 ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>
                    {atrasado > 0 ? `Atrasado: R$ ${fmtBR(atrasado)} (${atrasadoQtd})` : "Sem atrasos"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Previsto entradas</span>
                <span className="font-semibold text-emerald-700">R$ {fmtBR(previstoEntradas)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Previsto saídas</span>
                <span className="font-semibold text-red-600">R$ {fmtBR(previstoSaidas)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Saldo projetado</span>
                <span className={`font-semibold ${resultado + previstoEntradas - previstoSaidas >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  R$ {fmtBR(resultado + previstoEntradas - previstoSaidas)}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground">Ticket médio receita/dia</span>
                <span className="font-semibold">R$ {fmtBR(receitas / Math.max(1, today.getDate() === 0 ? lastDay : (year === today.getFullYear() && month === today.getMonth() ? today.getDate() : lastDay)))}</span>
              </div>
            </div>

            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart}>
                  <defs>
                    <linearGradient id="finEnt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="finSai" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" fontSize={10} interval={2} />
                  <YAxis fontSize={10} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `R$ ${fmtBR(v)}`} labelFormatter={(l) => `Dia ${l}`} />
                  <Area type="monotone" dataKey="ent" name="Entradas" stroke="#10b981" fill="url(#finEnt)" strokeWidth={2} />
                  <Area type="monotone" dataKey="sai" name="Saídas" stroke="#ef4444" fill="url(#finSai)" strokeWidth={2} />
                  <Area type="monotone" dataKey="saldo" name="Saldo acumulado" stroke="#2563eb" fill="transparent" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
