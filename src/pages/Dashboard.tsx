import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  DollarSign, ShoppingCart, TrendingUp, Package, Users,
  ArrowUpRight, ArrowDownRight, Minus, ChevronLeft, ChevronRight, AlertTriangle, Lock,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { format, getMonth, getYear, setMonth, setYear, subMonths, addMonths } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import FinancialCard from "@/components/dashboard/FinancialCard";
import YtdProfitCard from "@/components/dashboard/YtdProfitCard";
import MonthProfitCard from "@/components/dashboard/MonthProfitCard";
import MonthlyProfitChart from "@/components/dashboard/MonthlyProfitChart";

function fmtBR(n: number, decimals = 2): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtInt(n: number): string {
  return n.toLocaleString("pt-BR");
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PIE_FALLBACK_COLORS = [
  "hsl(45, 90%, 55%)",
  "hsl(270, 60%, 55%)",
  "hsl(0, 70%, 55%)",
  "hsl(180, 50%, 45%)",
  "hsl(210, 70%, 55%)",
];

function getProductColor(name: string, index: number) {
  const lower = name.toLowerCase();
  if (lower.includes("cubo")) return "#4169E1";
  if (lower.includes("maciço") || lower.includes("macico")) return "#1a1a1a";
  if (lower.includes("caixa")) return "#22c55e";
  return PIE_FALLBACK_COLORS[index % PIE_FALLBACK_COLORS.length];
}

function CompareIndicator({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  if (previous === 0 && current === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (previous === 0) return <span className="text-xs text-green-600 flex items-center gap-0.5"><ArrowUpRight className="h-3 w-3" />Novo</span>;
  const pct = ((current - previous) / previous) * 100;
  const icon = pct > 0 ? <ArrowUpRight className="h-3 w-3" /> : pct < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />;
  const color = pct > 0 ? "text-green-600" : pct < 0 ? "text-red-500" : "text-muted-foreground";
  return <span className={`text-xs flex items-center gap-0.5 ${color}`}>{icon}{Math.abs(pct).toFixed(1)}%{suffix}</span>;
}

const DASHBOARD_PIN = "1856";

const defaultStats = {
  todayTotal: 0, todayCount: 0, todayPackages: 0,
  monthTotal: 0, monthCount: 0, monthPackages: 0, monthClients: 0, monthTicket: 0,
  prevMonthTotal: 0, prevMonthCount: 0, prevMonthPackages: 0, prevMonthClients: 0, prevMonthTicket: 0,
  yearTotal: 0, yearCount: 0, yearPackages: 0,
  prevYearTotal: 0, prevYearCount: 0, prevYearPackages: 0,
  ytdTotal: 0, ytdCount: 0, ytdPackages: 0,
  ytdPrevTotal: 0, ytdPrevCount: 0, ytdPrevPackages: 0, ytdLabel: "",
  mtdTotal: 0, mtdCount: 0, mtdPackages: 0,
  mtdPrevTotal: 0, mtdPrevCount: 0, mtdPrevPackages: 0, mtdDay: 0,
  topProducts: [] as any[], weekDays: [] as any[], weekTotal: 0, weekPackages: 0,
  monthlyComparison: [] as any[],
  monthLossQty: 0, lossProducts: [] as any[],
  topClients: [] as any[], quarterLabel: "",
};

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekOffset, setWeekOffset] = useState(0);


  const selMonth = getMonth(selectedDate);
  const selYear = getYear(selectedDate);
  const canLoadData = !authLoading && !!session?.user;

  const { data: rawStats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats", selYear, selMonth, session?.user?.id],
    queryFn: async () => {
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_selected_year: selYear,
        p_selected_month: selMonth,
        p_today: todayStr,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: canLoadData,
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
  });

  // Weekly chart with navigation (independent from dashboard month selector)
  const weekRange = (() => {
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    base.setDate(base.getDate() + weekOffset * 7);
    // Monday as start of week
    const day = base.getDay(); // 0=Sun..6=Sat
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);
    return { start: monday, end: sunday };
  })();

  const { data: weekSalesRaw } = useQuery({
    queryKey: ["dashboard-week", weekRange.start.toISOString(), session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, total, created_at, sale_items(quantity)")
        .gte("created_at", weekRange.start.toISOString())
        .lt("created_at", weekRange.end.toISOString());
      if (error) throw error;
      return data || [];
    },
    enabled: canLoadData,
    staleTime: 1000 * 60 * 2,
  });

  const weekData = (() => {
    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    // Build Mon..Sun
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekRange.start);
      d.setDate(weekRange.start.getDate() + i);
      return { date: d, name: dayNames[d.getDay()], total: 0, pacotes: 0 };
    });
    for (const sale of (weekSalesRaw || []) as any[]) {
      const dt = new Date(sale.created_at);
      const idx = Math.floor((dt.getTime() - weekRange.start.getTime()) / (24 * 60 * 60 * 1000));
      if (idx >= 0 && idx < 7) {
        buckets[idx].total += Number(sale.total) || 0;
        buckets[idx].pacotes += ((sale.sale_items || []) as any[]).reduce(
          (s, it) => s + (Number(it.quantity) || 0), 0,
        );
      }
    }
    const total = buckets.reduce((s, b) => s + b.total, 0);
    const pacotes = buckets.reduce((s, b) => s + b.pacotes, 0);
    const fmtD = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const lastDay = new Date(weekRange.end);
    lastDay.setDate(weekRange.end.getDate() - 1);
    const label = weekOffset === 0
      ? "Semana atual"
      : `${fmtD(weekRange.start)} – ${fmtD(lastDay)}`;
    return { days: buckets, total, pacotes, label };
  })();

  const stats = rawStats
    ? {
        todayTotal: Number(rawStats.todayTotal) || 0,
        todayCount: Number(rawStats.todayCount) || 0,
        todayPackages: Number(rawStats.todayPackages) || 0,
        monthTotal: Number(rawStats.monthTotal) || 0,
        monthCount: Number(rawStats.monthCount) || 0,
        monthPackages: Number(rawStats.monthPackages) || 0,
        monthClients: Number(rawStats.monthClients) || 0,
        monthTicket: Number(rawStats.monthPackages) > 0
          ? Number(rawStats.monthTotal) / Number(rawStats.monthPackages) : 0,
        prevMonthTotal: Number(rawStats.prevMonthTotal) || 0,
        prevMonthCount: Number(rawStats.prevMonthCount) || 0,
        prevMonthPackages: Number(rawStats.prevMonthPackages) || 0,
        prevMonthClients: Number(rawStats.prevMonthClients) || 0,
        prevMonthTicket: Number(rawStats.prevMonthPackages) > 0
          ? Number(rawStats.prevMonthTotal) / Number(rawStats.prevMonthPackages) : 0,
        yearTotal: Number(rawStats.yearTotal) || 0,
        yearCount: Number(rawStats.yearCount) || 0,
        yearPackages: Number(rawStats.yearPackages) || 0,
        prevYearTotal: Number(rawStats.prevYearTotal) || 0,
        prevYearCount: Number(rawStats.prevYearCount) || 0,
        prevYearPackages: Number(rawStats.prevYearPackages) || 0,
        ytdTotal: Number(rawStats.ytdTotal) || 0,
        ytdCount: Number(rawStats.ytdCount) || 0,
        ytdPackages: Number(rawStats.ytdPackages) || 0,
        ytdPrevTotal: Number(rawStats.ytdPrevTotal) || 0,
        ytdPrevCount: Number(rawStats.ytdPrevCount) || 0,
        ytdPrevPackages: Number(rawStats.ytdPrevPackages) || 0,
        ytdLabel: rawStats.ytdLabel || "",
        topProducts: (rawStats.topProducts || []) as any[],
        weekDays: ((rawStats.weekDays || []) as any[]).map((d: any) => ({
          ...d,
          total: Number(d.total) || 0,
          pacotes: Number(d.pacotes) || 0,
        })),
        weekTotal: ((rawStats.weekDays || []) as any[]).reduce((s: number, d: any) => s + (Number(d.total) || 0), 0),
        weekPackages: ((rawStats.weekDays || []) as any[]).reduce((s: number, d: any) => s + (Number(d.pacotes) || 0), 0),
        monthlyComparison: ((rawStats.monthlyComparison || []) as any[]).map((m: any) => ({
          ...m,
          atual: Number(m.atual) || 0,
          anterior: Number(m.anterior) || 0,
          pacotesAtual: Number(m.pacotesAtual) || 0,
          pacotesAnterior: Number(m.pacotesAnterior) || 0,
          pedidosAtual: Number(m.pedidosAtual) || 0,
          pedidosAnterior: Number(m.pedidosAnterior) || 0,
        })),
        mtdTotal: Number(rawStats.mtdTotal) || 0,
        mtdCount: Number(rawStats.mtdCount) || 0,
        mtdPackages: Number(rawStats.mtdPackages) || 0,
        mtdPrevTotal: Number(rawStats.mtdPrevTotal) || 0,
        mtdPrevCount: Number(rawStats.mtdPrevCount) || 0,
        mtdPrevPackages: Number(rawStats.mtdPrevPackages) || 0,
        mtdDay: Number(rawStats.mtdDay) || 0,
        monthLossQty: Number(rawStats.monthLossQty) || 0,
        lossProducts: (rawStats.lossProducts || []) as any[],
        topClients: (rawStats.topClients || []) as any[],
        quarterLabel: (() => {
          const pqStart = Number(rawStats.pqStartMonth) || 0;
          const pqYear = Number(rawStats.prevQuarterYear) || selYear;
          return `${MONTHS[pqStart]}, ${MONTHS[pqStart + 1]} e ${MONTHS[pqStart + 2]} ${pqYear}`;
        })(),
      }
    : defaultStats;

  const years = (() => {
    const currentYear = getYear(today);
    const arr: number[] = [];
    for (let y = currentYear - 5; y <= currentYear; y++) arr.push(y);
    return arr;
  })();


  if (statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Faturamento Diário</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarIcon className="h-4 w-4" />
          <span className="font-medium">{format(selectedDate, "dd/MM/yyyy")}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        <Button variant="outline" size="sm" onClick={() => setSelectedDate(subMonths(selectedDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Select value={String(selMonth)} onValueChange={(v) => setSelectedDate(setMonth(selectedDate, Number(v)))}>
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selYear)} onValueChange={(v) => setSelectedDate(setYear(selectedDate, Number(v)))}>
          <SelectTrigger className="h-9 w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setSelectedDate(addMonths(selectedDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {(selMonth !== getMonth(today) || selYear !== getYear(today)) && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(today)}>
            Hoje
          </Button>
        )}
      </div>

      {/* Modern KPI Cards following the provided image reference */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-blue-600 text-white border-none shadow-md overflow-hidden relative">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-blue-100 uppercase tracking-wider">Vendas Hoje</span>
              <ShoppingCart className="h-5 w-5 text-blue-200/50" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">R$ {fmtBR(stats.todayTotal)}</div>
              <p className="text-[10px] text-blue-100/80 mt-1">{stats.todayCount} pedidos · {fmtInt(stats.todayPackages)} pacotes</p>
            </div>
          </CardContent>
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <ShoppingCart className="h-16 w-16" />
          </div>
        </Card>

        <Card className="bg-zinc-900 text-white border-none shadow-md overflow-hidden relative">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Faturamento</span>
              <DollarSign className="h-5 w-5 text-zinc-600" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">R$ {fmtBR(stats.monthTotal)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <CompareIndicator current={stats.monthTotal} previous={stats.prevMonthTotal} />
                <span className="text-[10px] text-zinc-500">vs anterior</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">Ano anterior: R$ {fmtBR(stats.prevMonthTotal)}</p>
            </div>
          </CardContent>
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <DollarSign className="h-16 w-16" />
          </div>
        </Card>

        <Card className="bg-[#0a1733] text-white border-none shadow-md overflow-hidden relative">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">Pacotes Mês</span>
              <Package className="h-5 w-5 text-blue-300/50" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">{fmtInt(stats.monthPackages)}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <CompareIndicator current={stats.monthPackages} previous={stats.prevMonthPackages} />
                <span className="text-[10px] text-blue-200/80">unidades</span>
              </div>
              <p className="text-[10px] text-blue-200/80 mt-0.5">Ano anterior: {fmtInt(stats.prevMonthPackages)}</p>
            </div>
          </CardContent>
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <Package className="h-16 w-16" />
          </div>
        </Card>

        <Card className="bg-cyan-500 text-white border-none shadow-md overflow-hidden relative">
          <CardContent className="p-4 flex flex-col justify-between h-full">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-cyan-100 uppercase tracking-wider">Faturamento Ano</span>
              <TrendingUp className="h-5 w-5 text-cyan-200/50" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">R$ {fmtBR(stats.yearTotal)}</div>
              <p className="text-[10px] text-cyan-100/80 mt-1">{fmtInt(stats.yearPackages)} pacotes</p>
            </div>
          </CardContent>
          <div className="absolute -right-2 -bottom-2 opacity-10">
            <TrendingUp className="h-16 w-16" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="col-span-2 md:col-span-4">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
              <div>
                <div className="text-lg font-bold">R$ {fmtBR(stats.monthTicket)}</div>
                <CompareIndicator current={stats.monthTicket} previous={stats.prevMonthTicket} />
                <p className="text-[10px] text-muted-foreground mt-0.5">Geral do mês</p>
                <p className="text-[10px] text-muted-foreground">Ano anterior: R$ {fmtBR(stats.prevMonthTicket)}</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Por produto</div>
                {stats.topProducts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sem vendas este mês</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1.5">
                    {stats.topProducts.map((p: any, i: number) => {
                      const ticket = Number(p.qty) > 0 ? Number(p.revenue) / Number(p.qty) : 0;
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 text-xs border-b border-border/50 pb-1">
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="text-[10px] text-muted-foreground">{fmtInt(p.qty)} un</div>
                          </div>
                          <div className="font-bold whitespace-nowrap">R$ {fmtBR(ticket)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Clientes Mês</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{stats.monthClients}</div>
            <CompareIndicator current={stats.monthClients} previous={stats.prevMonthClients} />
            <p className="text-[10px] text-muted-foreground mt-0.5">Ano anterior: {fmtInt(stats.prevMonthClients)}</p>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-destructive uppercase">Perdas Mês</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-destructive">{stats.monthLossQty}</div>
            {stats.lossProducts.length > 0 && (
              <p className="text-[10px] text-muted-foreground truncate">{stats.lossProducts[0].name}: {stats.lossProducts[0].qty}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-50 dark:bg-amber-950/10">
          <CardHeader className="flex flex-row items-center justify-between pb-1 space-y-0">
            <CardTitle className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Projeção YTD ({stats.ytdLabel})</CardTitle>
            <TrendingUp className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-amber-600 font-medium">{selYear}</span>
                <CompareIndicator current={stats.ytdTotal} previous={stats.ytdPrevTotal} />
              </div>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-300">R$ {fmtBR(stats.ytdTotal)}</div>
            </div>
            
            <div className="pt-2 border-t border-amber-200/50 dark:border-amber-500/20">
              <div className="flex items-baseline justify-between">
                <span className="text-[10px] text-amber-600/70 font-medium">{selYear - 1}</span>
              </div>
              <div className="text-sm font-semibold text-amber-600/80">R$ {fmtBR(stats.ytdPrevTotal)}</div>
            </div>

            <div className="pt-2 border-t border-amber-200/50 dark:border-amber-500/20 grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-amber-600 block">Pacotes {selYear}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-amber-700">{fmtInt(stats.ytdPackages)}</span>
                  <CompareIndicator current={stats.ytdPackages} previous={stats.ytdPrevPackages} />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-amber-600/70 block">Pacotes {selYear - 1}</span>
                <span className="text-sm font-semibold text-amber-600/80">{fmtInt(stats.ytdPrevPackages)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolução do Mês (MTD) */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">
            Evolução do Mês — Dia 1 a {stats.mtdDay} de {MONTHS[selMonth]}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{selYear} vs {selYear - 1} (mesmo período)</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
              <div className="text-xl font-bold">R$ {fmtBR(stats.mtdTotal)}</div>
              <div className="text-sm text-muted-foreground">vs R$ {fmtBR(stats.mtdPrevTotal)}</div>
              <CompareIndicator current={stats.mtdTotal} previous={stats.mtdPrevTotal} suffix={` vs ${selYear - 1}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pedidos</p>
              <div className="text-xl font-bold">{fmtInt(stats.mtdCount)}</div>
              <div className="text-sm text-muted-foreground">vs {fmtInt(stats.mtdPrevCount)}</div>
              <CompareIndicator current={stats.mtdCount} previous={stats.mtdPrevCount} suffix={` vs ${selYear - 1}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pacotes</p>
              <div className="text-xl font-bold">{fmtInt(stats.mtdPackages)}</div>
              <div className="text-sm text-muted-foreground">vs {fmtInt(stats.mtdPrevPackages)}</div>
              <CompareIndicator current={stats.mtdPackages} previous={stats.mtdPrevPackages} suffix={` vs ${selYear - 1}`} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Faturamento da Semana (movido pra cima do Financeiro) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Faturamento da Semana</CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[110px] text-center">{weekData.label}</span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => setWeekOffset((o) => Math.min(0, o + 1))}
                disabled={weekOffset >= 0}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
            <span>Total: <strong className="text-foreground">R$ {fmtBR(weekData.total)}</strong></span>
            <span>Pacotes: <strong className="text-foreground">{fmtInt(weekData.pacotes)}</strong></span>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weekData.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `R$${fmtBR(v)}`} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d: any = payload[0].payload;
                  return (
                    <div className="rounded-md border bg-background px-3 py-2 shadow-sm text-xs">
                      <div className="font-semibold mb-1">{label}</div>
                      <div>Faturamento: <strong>R$ {fmtBR(Number(d.total || 0))}</strong></div>
                      <div>Pacotes: <strong>{fmtInt(Number(d.pacotes || 0))} un</strong></div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Faturamento" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <FinancialCard year={selYear} month={selMonth} today={today} />

      <YtdProfitCard year={selYear} />
      <MonthProfitCard year={selYear} month={selMonth} />
      <MonthlyProfitChart year={selYear} />




      {/* Principais Produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" /> Principais Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma venda este mês</p>
            ) : (
              <div className="space-y-4">
                {stats.topProducts.map((p: any, i: number) => {
                  const maxQty = Math.max(...stats.topProducts.map((x: any) => x.qty));
                  const percent = (p.qty / maxQty) * 100;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium truncate pr-2">{p.name}</span>
                        <span className="font-bold whitespace-nowrap">R$ {fmtBR(Number(p.revenue))}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${percent}%`,
                              backgroundColor: getProductColor(p.name, i)
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium w-8 text-right">
                          {fmtInt(p.qty)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pl-0.5">
                        <span>Ticket médio</span>
                        <span className="font-semibold text-foreground">
                          R$ {fmtBR(Number(p.qty) > 0 ? Number(p.revenue) / Number(p.qty) : 0)}
                          <span className="text-muted-foreground font-normal"> / un</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo Mensal — {selYear} vs {selYear - 1}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.monthlyComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `R$${fmtBR(v)}`} />
              <Tooltip formatter={(v: number, name: string) => [`R$ ${fmtBR(v)}`, name === "atual" ? String(selYear) : String(selYear - 1)]} />
              <Legend formatter={(value) => (value === "atual" ? String(selYear) : String(selYear - 1))} />
              <Bar dataKey="atual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="anterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Packages Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparativo de Pacotes — {selYear} vs {selYear - 1}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.monthlyComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number, name: string) => [`${fmtInt(v)} un`, name === "pacotesAtual" ? String(selYear) : String(selYear - 1)]} />
              <Legend formatter={(value) => (value === "pacotesAtual" ? String(selYear) : String(selYear - 1))} />
              <Bar dataKey="pacotesAtual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pacotesAnterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Orders Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pedidos Emitidos — {selYear} vs {selYear - 1}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.monthlyComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number, name: string) => [`${fmtInt(v)} pedidos`, name === "pedidosAtual" ? String(selYear) : String(selYear - 1)]} />
              <Legend formatter={(value) => (value === "pedidosAtual" ? String(selYear) : String(selYear - 1))} />
              <Bar dataKey="pedidosAtual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pedidosAnterior" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 10 Clientes do Trimestre */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Top 10 Clientes — {stats.quarterLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma venda neste trimestre</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">#</th>
                    <th className="text-left py-2 px-2 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Faturamento</th>
                    <th className="text-right py-2 px-2 font-medium text-muted-foreground">Pacotes</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topClients.map((c: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 px-2 font-medium">{c.name}</td>
                      <td className="py-2 px-2 text-right">R$ {fmtBR(Number(c.revenue))}</td>
                      <td className="py-2 px-2 text-right">{fmtInt(Number(c.packages))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
