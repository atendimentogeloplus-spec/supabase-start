import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FileText, Printer, Search, ChevronDown, X, Calendar as CalendarIcon, Truck, ZoomIn, ZoomOut, Trophy, MessageCircle, AlertTriangle, PiggyBank } from "lucide-react";
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, startOfMonth, startOfWeek, endOfWeek, subWeeks, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoGeloplus from "@/assets/logo-geloplus.jpg";
import { Badge } from "@/components/ui/badge";
import { fetchAllSales } from "@/lib/fetchAllSales";
import { useAuth } from "@/hooks/useAuth";
import { printElement } from "@/lib/print";
import { toast } from "sonner";
import { shareReportOnWhatsApp } from "@/lib/whatsappReport";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const AUTO_REPORT_PRINT_ID = "auto-report-print";
const MANUAL_REPORT_PRINT_ID = "manual-report-print";

export default function Reports() {
  const { session, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [activeTab, setActiveTab] = useState("manual");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [periodicStatusFilter, setPeriodicStatusFilter] = useState("todos");
  const [avulsoStatusFilter, setAvulsoStatusFilter] = useState("todos");
  const [avulsoSortBy, setAvulsoSortBy] = useState("cliente");
  const [avulsoStartDate, setAvulsoStartDate] = useState<Date | undefined>(undefined);
  const [avulsoEndDate, setAvulsoEndDate] = useState<Date | undefined>(undefined);
  const [manualTrigger, setManualTrigger] = useState(0);
  const [autoReportData, setAutoReportData] = useState<{ client: any; sales: any[]; start: string; end: string } | null>(null);
  const [driverStartDate, setDriverStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [driverEndDate, setDriverEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [topStartDate, setTopStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [topEndDate, setTopEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodMode, setPeriodMode] = useState<"anterior" | "atual" | "custom">("atual");
  const [customStartDate, setCustomStartDate] = useState<string>(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [selectedPeriodTypes, setSelectedPeriodTypes] = useState<Array<"mensal" | "quinzenal" | "semanal">>(["mensal", "quinzenal", "semanal"]);
  const autoPreviewContentRef = useRef<HTMLDivElement | null>(null);
  const [autoPreviewScale, setAutoPreviewScale] = useState(1);
  const [autoZoomOverride, setAutoZoomOverride] = useState<number | null>(null);
  const [manualReportZoom, setManualReportZoom] = useState(1);
  const canLoadData = !authLoading && !!session?.user;

  // 60-day sales for auto/fechamento and drivers
  const {
    data: sales = [],
    isLoading: salesLoading,
    isFetching: salesFetching,
    error: salesError,
  } = useQuery({
    queryKey: ["reports-sales", session?.user?.id],
    queryFn: async () => fetchAllSales("*, sale_items(*), clients(name, cpf_cnpj)"),
    enabled: canLoadData,
  });

  // Sale IDs / order numbers that are currently provisioned (open receivable)
  const { data: provisionedInfo = { ids: new Set<string>(), orders: new Set<number>() } } = useQuery({
    queryKey: ["reports-provisioned-sales", session?.user?.id],
    queryFn: async () => {
      const [linksRes, recvRes] = await Promise.all([
        supabase
          .from("fin_receivable_sales")
          .select("sale_id, fin_receivables!inner(status)")
          .eq("fin_receivables.status", "aberto"),
        supabase
          .from("fin_receivables")
          .select("notes")
          .eq("status", "aberto")
          .ilike("notes", "%pedidos #%"),
      ]);
      if (linksRes.error) throw linksRes.error;
      const ids = new Set<string>((linksRes.data || []).map((r: any) => r.sale_id));
      const orders = new Set<number>();
      (recvRes.data || []).forEach((r: any) => {
        const m = String(r.notes || "").match(/pedidos #([\d,\s]+)/i);
        if (m) m[1].split(",").map((n) => Number(n.trim())).filter(Boolean).forEach((n) => orders.add(n));
      });
      return { ids, orders };
    },
    enabled: canLoadData,
  });

  const isSaleProvisioned = useCallback(
    (s: any) => provisionedInfo.ids.has(s.id) || (s.order_number != null && provisionedInfo.orders.has(Number(s.order_number))),
    [provisionedInfo]
  );



  // On-demand manual report query (any date range)
  const {
    data: manualSales = [],
    isFetching: manualFetching,
    error: manualError,
  } = useQuery({
    queryKey: ["reports-manual", manualTrigger, startDate, endDate, selectedClients, statusFilter],
    queryFn: async () => {
      const since = new Date(startDate + "T00:00:00").toISOString();
      const until = new Date(endDate + "T23:59:59.999").toISOString();
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from("sales")
          .select("*, sale_items(*), clients(name, cpf_cnpj)")
          .gte("created_at", since)
          .lte("created_at", until)
          .order("order_number", { ascending: true })
          .range(from, from + PAGE - 1);
        if (selectedClients.length > 0) {
          q = q.in("client_id", selectedClients);
        }
        if (statusFilter === "pagos") {
          q = q.eq("is_paid", true).eq("is_overdue", false);
        } else if (statusFilter === "pendentes") {
          q = q.eq("is_paid", false).eq("is_overdue", false);
        } else if (statusFilter === "atrasados") {
          q = q.eq("is_overdue", true);
        }
        const { data, error } = await q;
        if (error) throw error;
        if (!data?.length) break;
        allData.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return allData;
    },
    enabled: manualTrigger > 0,
  });

  // Top 10 clients by revenue in date range
  const {
    data: topClientsData = [],
    isFetching: topFetching,
  } = useQuery({
    queryKey: ["reports-top10", topStartDate, topEndDate, session?.user?.id],
    queryFn: async () => {
      const since = new Date(topStartDate + "T00:00:00").toISOString();
      const until = new Date(topEndDate + "T23:59:59.999").toISOString();
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("sales")
          .select("id, client_id, client_name, total, sale_items(quantity)")
          .gte("created_at", since)
          .lte("created_at", until)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data?.length) break;
        allData.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const groups: Record<string, { name: string; revenue: number; packages: number; orders: number }> = {};
      allData.forEach((s: any) => {
        const key = s.client_id || s.client_name || "sem-cliente";
        const name = s.client_name || "Sem cliente";
        if (!groups[key]) groups[key] = { name, revenue: 0, packages: 0, orders: 0 };
        groups[key].revenue += Number(s.total) || 0;
        groups[key].orders += 1;
        groups[key].packages += ((s.sale_items as any[]) || []).reduce((t: number, i: any) => t + (i.quantity || 0), 0);
      });
      return Object.values(groups).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    },
    enabled: canLoadData,
  });

  const {
    data: clients = [],
    isLoading: clientsLoading,
    error: clientsError,
  } = useQuery({
    queryKey: ["clients", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("name");
      return data || [];
    },
    enabled: canLoadData,
  });

  const isReportsLoading = authLoading || (canLoadData && (salesLoading || clientsLoading));
  const reportsError = salesError || clientsError;

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const toggleClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Manual report uses on-demand data
  const filtered = manualSales;

  const totalGeral = filtered.reduce((s, sale: any) => s + Number(sale.total), 0);
  const totalPedidos = filtered.length;
  const totalPacotes = filtered.reduce((s, sale: any) => {
    return s + ((sale.sale_items as any[])?.reduce((t: number, i: any) => t + i.quantity, 0) || 0);
  }, 0);

  // Group sales by client
  const groupedByClient = useMemo(() => {
    const groups: Record<string, { name: string; cpf_cnpj: string | null; sales: any[] }> = {};
    filtered.forEach((sale: any) => {
      const clientId = sale.client_id;
      const clientName = (sale.clients as any)?.name || "Sem cliente";
      const cpf = (sale.clients as any)?.cpf_cnpj || null;
      if (!groups[clientId]) {
        groups[clientId] = { name: clientName, cpf_cnpj: cpf, sales: [] };
      }
      groups[clientId].sales.push(sale);
    });
    Object.values(groups).forEach((g) => {
      g.sales.sort((a: any, b: any) => (a.order_number ?? 0) - (b.order_number ?? 0));
    });
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const hasMultipleClients = groupedByClient.length > 1;

  const selectedClientNames = clients
    .filter((c) => selectedClients.includes(c.id))
    .map((c) => ({ name: c.name, cpf_cnpj: c.cpf_cnpj }));

  // Auto period reports: clients with semanal/quinzenal/mensal
  const periodicClients = useMemo(() => {
    return clients.filter((c: any) => c.payment_type && c.payment_type !== "avulso");
  }, [clients]);

  // Avulso reports: clients with "avulso" or no payment type
  const avulsoClients = useMemo(() => {
    return clients.filter((c: any) => !c.payment_type || c.payment_type === "avulso");
  }, [clients]);

  // Group sales by client for performance
  const salesByClient = useMemo(() => {
    const groups: Record<string, any[]> = {};
    sales.forEach((s: any) => {
      if (!s.client_id) return;
      if (!groups[s.client_id]) groups[s.client_id] = [];
      groups[s.client_id].push(s);
    });
    return groups;
  }, [sales]);


  const getClientPeriod = (paymentType: string, mode: "anterior" | "atual" | "custom" = periodMode): { start: Date; end: Date; label: string } => {
    const now = new Date();
    if (mode === "custom") {
      const startStr = customStartDate && /^\d{4}-\d{2}-\d{2}$/.test(customStartDate) ? customStartDate : format(now, "yyyy-MM-dd");
      const endStr = customEndDate && /^\d{4}-\d{2}-\d{2}$/.test(customEndDate) ? customEndDate : format(now, "yyyy-MM-dd");
      const start = new Date(startStr + "T00:00:00");
      const end = new Date(endStr + "T23:59:59");
      return { start, end, label: "Período personalizado" };
    }
    switch (paymentType) {
      case "semanal": {
        if (mode === "atual") {
          const start = startOfWeek(now, { weekStartsOn: 1 });
          const end = endOfWeek(now, { weekStartsOn: 1 });
          return { start, end, label: "Semana atual" };
        }
        const lastWeek = subWeeks(now, 1);
        const start = startOfWeek(lastWeek, { weekStartsOn: 1 });
        const end = endOfWeek(lastWeek, { weekStartsOn: 1 });
        return { start, end, label: "Semana anterior" };
      }
      case "quinzenal": {
        const day = now.getDate();
        const year = now.getFullYear();
        const month = now.getMonth();
        if (mode === "atual") {
          if (day <= 15) {
            return { start: new Date(year, month, 1), end: new Date(year, month, 15, 23, 59, 59), label: "1ª quinzena atual" };
          }
          const lastDay = new Date(year, month + 1, 0).getDate();
          return { start: new Date(year, month, 16), end: new Date(year, month, lastDay, 23, 59, 59), label: "2ª quinzena atual" };
        }
        if (day <= 15) {
          // Estamos na 1ª quinzena → período anterior = 2ª quinzena do mês passado
          const prevMonth = month === 0 ? 11 : month - 1;
          const prevYear = month === 0 ? year - 1 : year;
          const lastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
          return { start: new Date(prevYear, prevMonth, 16), end: new Date(prevYear, prevMonth, lastDay, 23, 59, 59), label: "2ª quinzena anterior" };
        } else {
          // Estamos na 2ª quinzena → período anterior = 1ª quinzena deste mês
          return { start: new Date(year, month, 1), end: new Date(year, month, 15, 23, 59, 59), label: "1ª quinzena" };
        }
      }
      case "mensal": {
        if (mode === "atual") {
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          return { start, end, label: format(start, "MMMM/yyyy", { locale: ptBR }) + " (atual)" };
        }
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start = new Date(prevYear, prevMonth, 1);
        const end = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59);
        return { start, end, label: format(start, "MMMM/yyyy", { locale: ptBR }) };
      }
      case "avulso":
      default: {
        const start = mode === "atual" 
          ? startOfMonth(now) 
          : startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
        const end = mode === "atual" 
          ? endOfDay(now) 
          : endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
        return { 
          start, 
          end, 
          label: format(start, "MMMM/yyyy", { locale: ptBR }) + (mode === "atual" ? " (atual)" : "") 
        };
      }
    }
  };

  const getClientSalesForPeriod = (clientId: string, paymentType: string) => {
    const { start, end } = getClientPeriod(paymentType);
    const clientSales = salesByClient[clientId] || [];
    const since = startOfDay(start).getTime();
    const until = endOfDay(end).getTime();

    return clientSales
      .filter((s: any) => {
        const d = new Date(s.created_at).getTime();
        return d >= since && d <= until;
      })
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  // Memoized report summaries for periodic clients
  const periodicReportSummaries = useMemo(() => {
    return periodicClients.map((c: any) => {
      const pt = c.payment_type as string;
      const { start, end, label } = getClientPeriod(pt);
      const clientSales = salesByClient[c.id] || [];
      const since = startOfDay(start).getTime();
      const until = endOfDay(end).getTime();

      const periodSales = clientSales
        .filter((s: any) => {
          const d = new Date(s.created_at).getTime();
          return d >= since && d <= until;
        })
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const periodTotal = periodSales.reduce((s: number, x: any) => s + Number(x.total), 0);
      const periodPacotes = periodSales.reduce((s: number, x: any) =>
        s + ((x.sale_items as any[])?.reduce((t: number, i: any) => t + i.quantity, 0) || 0), 0);
      const allPaid = periodSales.length === 0 || periodSales.every((s: any) => s.is_paid);
      const anyOverdue = periodSales.some((s: any) => s.is_overdue);
      const anyProvisioned = periodSales.some((s: any) => isSaleProvisioned(s));
      const anyOpen = periodSales.some((s: any) => !s.is_paid && !s.is_overdue && !isSaleProvisioned(s));

      return {
        ...c,
        periodSales,
        periodTotal,
        periodPacotes,
        allPaid,
        anyOverdue,
        anyOpen,
        anyProvisioned,
        periodStart: start,
        periodEnd: end,
        periodLabel: label
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodicClients, salesByClient, periodMode, customStartDate, customEndDate, isSaleProvisioned]);

  const avulsoReportSummaries = useMemo(() => {
    const now = new Date();
    
    // Use custom dates if provided, otherwise fallback to periodMode
    const start = avulsoStartDate ? startOfDay(avulsoStartDate) : (periodMode === "atual" 
      ? startOfMonth(now) 
      : startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
    
    const end = avulsoEndDate ? endOfDay(avulsoEndDate) : (periodMode === "atual" 
      ? endOfDay(now) 
      : endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)));
    
    const label = avulsoStartDate && avulsoEndDate 
      ? `${format(start, "dd/MM")} a ${format(end, "dd/MM/yy")}`
      : format(start, "MMMM/yyyy", { locale: ptBR });

    let summaries = avulsoClients.map((c: any) => {
      const clientSales = salesByClient[c.id] || [];
      const since = start.getTime();
      const until = end.getTime();

      // Filter sales for the period
      const allPeriodSales = clientSales
        .filter((s: any) => {
          const d = new Date(s.created_at).getTime();
          return d >= since && d <= until;
        })
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const filteredPeriodSales = allPeriodSales.filter((s: any) => {
        if (avulsoStatusFilter === "pagos") return s.is_paid === true && !s.is_overdue;
        if (avulsoStatusFilter === "pendentes") return s.is_paid === false && !s.is_overdue && !isSaleProvisioned(s);
        if (avulsoStatusFilter === "provisionados") return isSaleProvisioned(s);
        if (avulsoStatusFilter === "atrasados") return s.is_overdue === true;
        return true;
      });

      const periodTotal = filteredPeriodSales.reduce((s: number, x: any) => s + Number(x.total), 0);
      const periodPacotes = filteredPeriodSales.reduce((s: number, x: any) =>
        s + ((x.sale_items as any[])?.reduce((t: number, i: any) => t + i.quantity, 0) || 0), 0);
      const allPaid = allPeriodSales.length > 0 && allPeriodSales.every((s: any) => s.is_paid);
      const anyOverdue = allPeriodSales.some((s: any) => s.is_overdue);
      const anyOpen = allPeriodSales.some((s: any) => !s.is_paid && !s.is_overdue && !isSaleProvisioned(s));
      const anyProvisioned = allPeriodSales.some((s: any) => isSaleProvisioned(s));

      const matchesStatus = filteredPeriodSales.length > 0;

      return {
        ...c,
        periodSales: filteredPeriodSales,
        periodTotal,
        periodPacotes,
        allPaid,
        anyOverdue,
        anyOpen,
        anyProvisioned,
        periodStart: start,
        periodEnd: end,
        periodLabel: label,
        matchesStatus
      };
    }).filter(c => c.matchesStatus);

    // Sorting
    if (avulsoSortBy === "total") {
      summaries.sort((a, b) => b.periodTotal - a.periodTotal);
    } else if (avulsoSortBy === "vendas") {
      summaries.sort((a, b) => b.periodSales.length - a.periodSales.length);
    } else {
      summaries.sort((a, b) => a.name.localeCompare(b.name));
    }

    return summaries;
  }, [avulsoClients, salesByClient, periodMode, avulsoStatusFilter, avulsoSortBy, avulsoStartDate, avulsoEndDate, isSaleProvisioned]);

  // Datas (yyyy-MM-dd) em que TODAS as vendas de clientes avulsos estão pagas
  const avulsoFullyPaidDays = useMemo(() => {
    const avulsoIds = new Set(avulsoClients.map((c: any) => c.id));
    const byDay: Record<string, { total: number; paid: number }> = {};
    sales.forEach((s: any) => {
      if (!s.client_id || !avulsoIds.has(s.client_id)) return;
      const day = format(parseISO(s.created_at), "yyyy-MM-dd");
      if (!byDay[day]) byDay[day] = { total: 0, paid: 0 };
      byDay[day].total += 1;
      if (s.is_paid || s.is_overdue) byDay[day].paid += 1;
    });
    const dates: Date[] = [];
    Object.entries(byDay).forEach(([day, { total, paid }]) => {
      if (total > 0 && total === paid) dates.push(parseISO(day));
    });
    return dates;
  }, [sales, avulsoClients]);

  // Fecha automaticamente os fin_receivables cujos sales vinculados estão TODOS pagos
  async function syncLinkedReceivablesForSales(saleIds: string[]) {
    if (!saleIds.length) return;
    const { data: links } = await supabase
      .from("fin_receivable_sales")
      .select("receivable_id")
      .in("sale_id", saleIds);
    const recvIds = Array.from(new Set((links || []).map((l: any) => l.receivable_id)));
    if (!recvIds.length) return;
    const { data: allLinks } = await supabase
      .from("fin_receivable_sales")
      .select("receivable_id, sale_id")
      .in("receivable_id", recvIds);
    const byRecv: Record<string, string[]> = {};
    (allLinks || []).forEach((l: any) => {
      (byRecv[l.receivable_id] ||= []).push(l.sale_id);
    });
    const allSaleIds = Array.from(new Set((allLinks || []).map((l: any) => l.sale_id)));
    const { data: salesRows } = await supabase
      .from("sales")
      .select("id, is_paid")
      .in("id", allSaleIds);
    const paidMap = new Map((salesRows || []).map((s: any) => [s.id, !!s.is_paid]));
    const toClose = recvIds.filter(rid => (byRecv[rid] || []).every(sid => paidMap.get(sid)));
    if (toClose.length) {
      await supabase.from("fin_receivables")
        .update({ status: "pago", paid_at: new Date().toISOString() })
        .in("id", toClose)
        .eq("status", "aberto");
    }
  }

  // Reabre fin_receivables vinculados a estas sales (quando desmarca pago)
  async function reopenLinkedReceivablesForSales(saleIds: string[]) {
    if (!saleIds.length) return;
    const { data: links } = await supabase
      .from("fin_receivable_sales")
      .select("receivable_id")
      .in("sale_id", saleIds);
    const recvIds = Array.from(new Set((links || []).map((l: any) => l.receivable_id)));
    if (!recvIds.length) return;
    await supabase.from("fin_receivables")
      .update({ status: "aberto", paid_at: null })
      .in("id", recvIds)
      .eq("status", "pago");
  }

  const togglePaidMutation = useMutation({
    mutationFn: async ({ saleId, isPaid, clientName, amount }: { saleId: string; isPaid: boolean; clientName?: string; amount?: number }) => {
      const { error } = await supabase
        .from("sales")
        .update(isPaid ? { is_paid: true, is_overdue: false } : { is_paid: false })
        .eq("id", saleId);
      if (error) throw error;

      if (isPaid && clientName && amount) {
        // Lookup billing method via sale -> client
        let paymentMethod = 'Caixa';
        const { data: saleRow } = await supabase
          .from("sales")
          .select("client_id, order_number")
          .eq("id", saleId)
          .maybeSingle();
        if (saleRow?.client_id) {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("billing_method")
            .eq("id", saleRow.client_id)
            .maybeSingle();
          if (clientRow?.billing_method?.toLowerCase() === "boleto") paymentMethod = 'Inter';
        }
        const { error: cashError } = await supabase
          .from("cash_flow")
          .insert({
            client_name: clientName,
            amount: amount,
            sale_id: saleId,
            description: `Pedido #${saleId.slice(0, 8)}`,
            payment_method: paymentMethod
          });
        if (cashError) console.error("Error creating cash flow entry:", cashError);

        const n = (saleRow as any)?.order_number;
        if (n) {
          await supabase.from("fin_receivables")
            .update({ status: "pago", paid_at: new Date().toISOString() })
            .eq("status", "aberto")
            .or(`description.ilike.%#${n}%,notes.ilike.%#${n}%`);
        }
        await syncLinkedReceivablesForSales([saleId]);
      } else if (!isPaid) {
        await reopenLinkedReceivablesForSales([saleId]);
      }
    },
    onMutate: async ({ saleId, isPaid }) => {
      // Cancel refetches
      await qc.cancelQueries({ queryKey: ["reports-sales"] });
      await qc.cancelQueries({ queryKey: ["reports-manual"] });

      // Optimistically update local state if open
      if (autoReportData) {
        setAutoReportData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            sales: prev.sales.map(s => s.id === saleId ? { ...s, is_paid: isPaid } : s)
          };
        });
      }

      // We don't snapshot/rollback for global queries here to keep it simple,
      // as invalidation will happen onSettled.
    },
    onSuccess: () => {
      toast.success("Status de pagamento atualizado!");
    },
    onError: (error) => {
      console.error("Error updating paid status:", error);
      toast.error("Erro ao atualizar status de pagamento");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
    },
  });

  const markPeriodOverdueMutation = useMutation({
    mutationFn: async ({ client_id, client_name, start, end }: { client_id: string; client_name: string; start: Date; end: Date }) => {
      if (!session?.user?.id) throw new Error("no-user");
      const { data: openSales } = await supabase
        .from("sales")
        .select("id, total, order_number, created_at")
        .eq("client_id", client_id)
        .eq("is_paid", false)
        .eq("is_overdue", false)
        .gte("created_at", startOfDay(start).toISOString())
        .lte("created_at", endOfDay(end).toISOString());
      if (!openSales || openSales.length === 0) throw new Error("no-open");
      const todayStr = new Date().toISOString().slice(0, 10);
      const rows = openSales.map((s: any) => {
        const saleDate = String(s.created_at).slice(0, 10);
        const dueDate = saleDate < todayStr ? saleDate : todayStr;
        return {
          user_id: session.user.id,
          description: `Atrasado #${s.order_number} — ${client_name}`,
          client_name,
          amount: Number(s.total || 0),
          due_date: dueDate,
          category: "Vendas de Gelo",
          payment_method: "Pix",
          notes: `(origem: pedido atrasado #${s.order_number})`,
          status: "aberto",
        };
      });
      const { data: insertedRecv, error: recvErr } = await supabase.from("fin_receivables").insert(rows).select("id");
      if (recvErr) throw recvErr;
      const ids = openSales.map((s: any) => s.id);
      const { error: upErr } = await supabase.from("sales").update({ is_paid: false, is_overdue: true }).in("id", ids);
      if (upErr) throw upErr;
      // Vincula cada receivable ao seu sale (mesma ordem)
      if (insertedRecv && insertedRecv.length === openSales.length) {
        const links = insertedRecv.map((r: any, i: number) => ({
          receivable_id: r.id,
          sale_id: openSales[i].id,
        }));
        await supabase.from("fin_receivable_sales").insert(links);
      }
    },
    onSuccess: () => {
      toast.success("Enviado para o financeiro como atrasado.");
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["orders-list"] });
    },
    onError: (e: any) => {
      if (e?.message === "no-open") toast.info("Nenhum pedido em aberto neste período (todos já estão pagos ou marcados como atrasado).");
      else toast.error("Erro ao marcar como atrasado.");
    },
  });

  const [provisionDialog, setProvisionDialog] = useState<{ client_id: string; client_name: string; start: Date; end: Date; total: number; periodLabel: string } | null>(null);
  const [provisionDate, setProvisionDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const markPeriodProvisionMutation = useMutation({
    mutationFn: async ({ client_id, client_name, start, end, due_date, periodLabel }: { client_id: string; client_name: string; start: Date; end: Date; due_date: string; periodLabel: string }) => {
      if (!session?.user?.id) throw new Error("no-user");
      const { data: openSales } = await supabase
        .from("sales")
        .select("id, total, order_number")
        .eq("client_id", client_id)
        .eq("is_paid", false)
        .gte("created_at", startOfDay(start).toISOString())
        .lte("created_at", endOfDay(end).toISOString());
      if (!openSales || openSales.length === 0) throw new Error("no-open");
      const total = openSales.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
      const orderNums = openSales.map((s: any) => s.order_number).filter(Boolean).join(", ");
      const { data: insertedRecv, error } = await supabase.from("fin_receivables").insert({
        user_id: session.user.id,
        description: `Provisão ${periodLabel} — ${client_name}`,
        client_name,
        amount: total,
        due_date,
        category: "Vendas de Gelo",
        payment_method: "Pix",
        notes: `(origem: provisão fechamento • pedidos #${orderNums})`,
        status: "aberto",
      }).select("id").maybeSingle();
      if (error) throw error;
      if (insertedRecv?.id) {
        const links = openSales.map((s: any) => ({ receivable_id: insertedRecv.id, sale_id: s.id }));
        const { error: linkErr } = await supabase.from("fin_receivable_sales").insert(links);
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: () => {
      toast.success("Provisão enviada para o financeiro (Projeção).");
      setProvisionDialog(null);
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-provisioned-sales"] });
      qc.invalidateQueries({ queryKey: ["fin-receivables"] });
    },
    onError: (e: any) => {
      if (e?.message === "no-open") toast.info("Nenhum pedido em aberto neste período.");
      else toast.error("Erro ao provisionar.");
    },
  });

  const openAutoReport = (
    client: any,
    override?: { sales: any[]; start: Date; end: Date }
  ) => {
    if (override) {
      setAutoReportData({
        client,
        sales: [...override.sales].sort(
          (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
        start: format(override.start, "yyyy-MM-dd"),
        end: format(override.end, "yyyy-MM-dd"),
      });
      return;
    }
    const pt = (client as any).payment_type;
    const { start, end } = getClientPeriod(pt);
    const clientSales = getClientSalesForPeriod(client.id, pt);
    setAutoReportData({
      client,
      sales: clientSales,
      start: format(start, "yyyy-MM-dd"),
      end: format(end, "yyyy-MM-dd"),
    });
  };

  const togglePeriodPaidMutation = useMutation({
    mutationFn: async ({ client_id, client_name, start, end, isPaid }: { client_id: string; client_name: string; start: Date; end: Date; isPaid: boolean }) => {
      // 1. Get total for the period to create a single cash flow entry if desired, 
      // or we can do it per sale. The request says "nome do cliente e o valor".
      // Let's get the sales that will be updated to 'paid'
      const { data: salesToUpdate } = await supabase
        .from("sales")
        .select("id, total, is_paid, order_number")
        .eq("client_id", client_id)
        .gte("created_at", startOfDay(start).toISOString())
        .lte("created_at", endOfDay(end).toISOString());

      const { error } = await supabase
        .from("sales")
        .update(isPaid ? { is_paid: true, is_overdue: false } : { is_paid: false })
        .eq("client_id", client_id)
        .gte("created_at", startOfDay(start).toISOString())
        .lte("created_at", endOfDay(end).toISOString());
      if (error) throw error;

      if (isPaid && salesToUpdate) {
        const newlyPaidSales = salesToUpdate.filter(s => !s.is_paid);
        const totalAmount = newlyPaidSales.reduce((sum, s) => sum + Number(s.total), 0);
        
        if (totalAmount > 0) {
          const { data: clientRow } = await supabase
            .from("clients")
            .select("billing_method")
            .eq("id", client_id)
            .maybeSingle();
          const paymentMethod = clientRow?.billing_method?.toLowerCase() === "boleto" ? "Inter" : "Caixa";
          await supabase.from("cash_flow").insert({
            client_name: client_name,
            amount: totalAmount,
            description: `Fechamento período ${format(start, "dd/MM")} - ${format(end, "dd/MM")}`,
            payment_method: paymentMethod
          });
        }

        const orderNums = newlyPaidSales.map((s: any) => s.order_number).filter(Boolean);
        if (orderNums.length > 0) {
          const orFilter = orderNums.map((n: any) => `description.ilike.%#${n}%,notes.ilike.%#${n}%`).join(",");
          await supabase.from("fin_receivables")
            .update({ status: "pago", paid_at: new Date().toISOString() })
            .eq("status", "aberto")
            .or(orFilter);
        }
        await syncLinkedReceivablesForSales(newlyPaidSales.map((s: any) => s.id));
      } else if (!isPaid && salesToUpdate) {
        await reopenLinkedReceivablesForSales(salesToUpdate.map((s: any) => s.id));
      }
    },
    onMutate: async ({ client_id, start, end, isPaid }) => {
      await qc.cancelQueries({ queryKey: ["reports-sales"] });
      await qc.cancelQueries({ queryKey: ["reports-manual"] });

      // Optimistic update for the sales list used in calculations
      qc.setQueryData(["reports-sales", session?.user?.id], (old: any[] | undefined) => {
        if (!old) return old;
        const since = startOfDay(start).getTime();
        const until = endOfDay(end).getTime();
        return old.map(s => {
          if (s.client_id === client_id) {
            const d = new Date(s.created_at).getTime();
            if (d >= since && d <= until) {
              return { ...s, is_paid: isPaid };
            }
          }
          return s;
        });
      });

      if (autoReportData && autoReportData.client.id === client_id) {
        setAutoReportData(prev => {
          if (!prev) return null;
          return {
            ...prev,
            sales: prev.sales.map(s => ({ ...s, is_paid: isPaid }))
          };
        });
      }
    },
    onSuccess: () => {
      toast.success("Status de pagamento atualizado para todo o período!");
    },
    onError: () => toast.error("Erro ao atualizar status de pagamento do período"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["cash-flow"] });
    },
  });

  const handlePrintReport = async (elementId: string, title: string) => {
    try {
      await printElement(elementId, title);
    } catch {
      toast.error("Erro ao preparar impressão do relatório");
    }
  };

  useEffect(() => {
    if (!autoReportData) return;

    const updateAutoPreviewScale = () => {
      const preview = autoPreviewContentRef.current;
      if (!preview) return;

      const toolbarHeight = 72;
      const horizontalPadding = 32;
      const verticalPadding = 24;
      const availableWidth = window.innerWidth - horizontalPadding * 2;
      const availableHeight = window.innerHeight - toolbarHeight - verticalPadding * 2;

      const widthScale = availableWidth / preview.scrollWidth;
      const heightScale = availableHeight / preview.scrollHeight;
      setAutoPreviewScale(Math.min(1, widthScale, heightScale));
    };

    const frame = window.requestAnimationFrame(updateAutoPreviewScale);
    window.addEventListener("resize", updateAutoPreviewScale);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateAutoPreviewScale);
    };
  }, [autoReportData]);

  if (isReportsLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Carregando relatórios...</p>
      </div>
    );
  }

  if (reportsError) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="font-medium">Não foi possível carregar os relatórios.</p>
          <p className="text-sm text-muted-foreground">
            Atualize a página e, se continuar, me avise para eu verificar a consulta com você.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render auto-report print view
  if (autoReportData) {
    const { client, sales: rSales, start: rStart, end: rEnd } = autoReportData;
    const rTotal = rSales.reduce((s: number, x: any) => s + Number(x.total), 0);
    const rPacotes = rSales.reduce((s: number, x: any) =>
      s + ((x.sale_items as any[])?.reduce((t: number, i: any) => t + i.quantity, 0) || 0), 0);

    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-white overflow-hidden">
        <div className="no-print border-b bg-white p-3 flex gap-2 items-center">
          <Button onClick={() => handlePrintReport(AUTO_REPORT_PRINT_ID, `relatorio-${client.name}`)}><Printer className="h-4 w-4 mr-2" /> Imprimir</Button>
          <Button variant="outline" onClick={() => { setAutoReportData(null); setAutoZoomOverride(null); }}>Voltar</Button>
          {client.whatsapp && (() => {
            const openSales = rSales.filter((s: any) => !s.is_paid);
            const salesForMessage = openSales.length > 0 ? openSales : rSales;
            const openTotal = salesForMessage.reduce((s: number, x: any) => s + Number(x.total), 0);
            const uniqueDays = Array.from(new Set(
              salesForMessage.map((s: any) => format(parseISO(s.created_at), "dd/MM/yyyy"))
            )).sort((a, b) => {
              const [da, ma, ya] = a.split("/").map(Number);
              const [db, mb, yb] = b.split("/").map(Number);
              return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
            });
            const datesText = uniqueDays.length === 1
              ? uniqueDays[0]
              : uniqueDays.length === 2
                ? `${uniqueDays[0]} e ${uniqueDays[1]}`
                : `${uniqueDays.slice(0, -1).join(", ")} e ${uniqueDays[uniqueDays.length - 1]}`;
            return (
              <Button
                variant="outline"
                className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                onClick={() => {
                  const isPeriodic = client.payment_type && client.payment_type !== "avulso";
                  const isBoleto = client.billing_method === "boleto";
                  
                  const startStr = format(parseISO(rStart), "dd/MM/yyyy");
                  const endStr = format(parseISO(rEnd), "dd/MM/yyyy");
                  const totalStr = openTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  
                  let message = "";
                  if (isBoleto) {
                    if (isPeriodic) {
                      message = `Oi, tudo bem?\nSeguem fechamento, nota fiscal e boleto referentes às entregas de gelo entre ${startStr} e ${endStr}`;
                    } else {
                      message = `Oi, tudo bem?\nSeguem fechamento, nota fiscal e boleto referentes às entregas de gelo do dia ${datesText}`;
                    }
                  } else {
                    // PIX
                    if (isPeriodic) {
                      message = `Olá, tudo bem?\nSegue seu fechamento do período de ${startStr} a ${endStr} !\n\nTotal R$ ${totalStr}\nChave pix email\ngeloplus@yahoo.com\n\nQualquer dúvida estou á disposição!`;
                    } else {
                      message = `Olá, tudo bem?\nSua entrega do dia ${datesText} ficou em aberto!\n\nTotal R$ ${totalStr}\nChave pix email\ngeloplus@yahoo.com\n\nQualquer dúvida estou á disposição!`;
                    }
                  }
                  
                  shareReportOnWhatsApp({
                    elementId: AUTO_REPORT_PRINT_ID,
                    fileName: `relatorio-${client.name}-${rStart}-a-${rEnd}`.replace(/\s+/g, "_"),
                    whatsapp: client.whatsapp,
                    message,
                  });
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" /> Enviar WhatsApp
              </Button>
            );
          })()}
          
          <div className="h-6 w-px bg-gray-200 mx-1" />
          
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-md border">
            <Label className="text-xs font-semibold cursor-pointer select-none" htmlFor="pay-all-preview">
              {rSales.every((s: any) => s.is_paid) ? "Pago" : "Marcar como Pago"}
            </Label>
            <Checkbox 
              id="pay-all-preview"
              checked={rSales.length > 0 && rSales.every((s: any) => s.is_paid)} 
              onCheckedChange={(checked) => {
                const { start, end } = getClientPeriod(client.payment_type);
                togglePeriodPaidMutation.mutate({ 
                  client_id: client.id, 
                  client_name: client.name,
                  start, 
                  end, 
                  isPaid: !!checked 
                });
              }}
            />
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAutoZoomOverride(prev => Math.max(0.3, (prev ?? autoPreviewScale) - 0.1))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium w-14 text-center">{Math.round((autoZoomOverride ?? autoPreviewScale) * 100)}%</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setAutoZoomOverride(prev => Math.min(2, (prev ?? autoPreviewScale) + 0.1))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={() => setAutoZoomOverride(null)}>Ajustar</Button>
          </div>
        </div>
        <div className="report-preview-screen report-preview-viewport flex items-start justify-center px-4 py-4 overflow-auto">
          <div
            className="report-preview-scale"
            style={{ transform: `scale(${autoZoomOverride ?? autoPreviewScale})`, transformOrigin: "top center" }}
          >
            <div id={AUTO_REPORT_PRINT_ID} ref={autoPreviewContentRef} className="w-[920px] max-w-[920px] bg-white p-8 print:w-auto print:max-w-none print:p-0" style={{ fontFamily: "Arial, Helvetica, sans-serif", color: '#111', fontSize: '15px' }}>
              <div className="text-center mb-5 pb-3 border-b border-gray-300 print:mb-3 print:pb-2">
                <img src={logoGeloplus} alt="Gelo Plus" className="h-16 mx-auto mb-2 print:h-10 print:mb-1" />
                <p className="text-lg font-medium" style={{ color: '#333' }}>Relatório de Vendas</p>
                <p className="text-base font-semibold mt-1">
                  Período: {format(parseISO(rStart), "dd/MM/yyyy")} a {format(parseISO(rEnd), "dd/MM/yyyy")}
                </p>
                <p className="text-base font-bold mt-1">
                  Cliente: {client.name}{client.cpf_cnpj ? ` — ${client.cpf_cnpj}` : ""}
                </p>
                <p className="text-sm mt-1" style={{ color: '#555' }}>Emitido em: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
              {rSales.length === 0 ? (
                <p className="text-center py-8" style={{ color: '#666' }}>Nenhuma venda no período</p>
              ) : (
                <>
                  <div className="mb-4 pb-3 border-b-2 border-gray-400 space-y-1">
                    <div className="flex justify-between text-base"><span>Total de pedidos:</span><strong>{rSales.length}</strong></div>
                    <div className="flex justify-between text-base"><span>Total de pacotes:</span><strong>{rPacotes}</strong></div>
                    <div className="flex justify-between text-lg pt-2 border-t border-gray-300 mt-1">
                      <span className="font-bold">Total:</span>
                      <span className="font-bold">R$ {rTotal.toFixed(2)}</span>
                    </div>
                  </div>
                  <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #333' }}>
                        <th className="text-left py-2 px-2 text-base font-bold">Nº Pedido</th>
                        <th className="text-left py-2 px-2 text-base font-bold">Data</th>
                        <th className="text-left py-2 px-2 text-base font-bold">Produtos (Tabela)</th>
                        <th className="text-right py-2 px-2 text-base font-bold">Qtd</th>
                        <th className="text-right py-2 px-2 text-base font-bold">Total</th>

                      </tr>
                    </thead>
                    <tbody>
                      {rSales.map((sale: any, idx: number) => {
                        const items = (sale.sale_items as any[]) || [];
                        const qty = items.reduce((t: number, i: any) => t + i.quantity, 0);
                        return (
                          <tr key={sale.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f8f8' }}>
                            <td className="py-2 px-2 text-base font-mono">#{sale.order_number}</td>
                            <td className="py-2 px-2 text-base">{format(parseISO(sale.created_at), "dd/MM/yyyy")}</td>
                            <td className="py-2 px-2 text-base">{items.map((i: any) => `${i.product_name} (${i.quantity}x)${i.price_table_name ? ` [${i.price_table_name}]` : ""}`).join(", ")}</td>
                             <td className="py-2 px-2 text-base text-right font-medium">{qty}</td>
                             <td className="py-2 px-2 text-base text-right font-bold">R$ {Number(sale.total).toFixed(2)}</td>
                           </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="no-print">
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-6">
          <FileText className="h-6 w-6" /> Relatórios
        </h2>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="manual">Relatório Manual</TabsTrigger>
            <TabsTrigger value="auto">
              <CalendarIcon className="h-4 w-4 mr-1" /> Fechamento por Período
              {periodicClients.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{periodicClients.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="avulsos">
              <FileText className="h-4 w-4 mr-1" /> Avulsos
              {avulsoClients.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{avulsoClients.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="drivers">
              <Truck className="h-4 w-4 mr-1" /> Motoristas
            </TabsTrigger>
            <TabsTrigger value="top10">
              <Trophy className="h-4 w-4 mr-1" /> Top 10
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Data Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Clientes</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {selectedClients.length === 0
                          ? "Todos os clientes"
                          : `${selectedClients.length} selecionado(s)`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-2" align="start">
                    <Input
                      placeholder="Buscar cliente..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredClients.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={selectedClients.includes(c.id)}
                            onCheckedChange={() => toggleClient(c.id)}
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      ))}
                      {filteredClients.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-2">Nenhum cliente encontrado</p>
                      )}
                    </div>
                    {selectedClients.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-xs"
                        onClick={() => setSelectedClients([])}
                      >
                        <X className="h-3 w-3 mr-1" /> Limpar seleção
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status Pagamento</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pagos">Pagos</SelectItem>
                    <SelectItem value="pendentes">Pendentes</SelectItem>
                        <SelectItem value="atrasados">Atrasados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => { setManualTrigger(prev => prev + 1); setShowReport(true); }} disabled={manualFetching}>
                {manualFetching ? "Buscando..." : <><Search className="h-4 w-4 mr-2" /> Gerar Relatório</>}
              </Button>
            </div>

            {selectedClients.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {selectedClientNames.map((c, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {c.name}
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={() => {
                        const client = clients.find((cl) => cl.name === c.name);
                        if (client) toggleClient(client.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="auto">
            {salesFetching && sales.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Carregando pedidos do fechamento por período...
                </CardContent>
              </Card>
            ) : periodicClients.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum cliente com fechamento periódico cadastrado. Configure o tipo de pagamento (semanal, quinzenal ou mensal) no cadastro do cliente.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border w-fit">
                    <span className="text-xs font-medium text-muted-foreground px-2">Período:</span>
                    <Button
                      size="sm"
                      variant={periodMode === "anterior" ? "default" : "ghost"}
                      className="h-7 text-xs"
                      onClick={() => setPeriodMode("anterior")}
                    >
                      Anterior (fechado)
                    </Button>
                    <Button
                      size="sm"
                      variant={periodMode === "atual" ? "default" : "ghost"}
                      className="h-7 text-xs"
                      onClick={() => setPeriodMode("atual")}
                    >
                      Atual (em andamento)
                    </Button>
                    <Button
                      size="sm"
                      variant={periodMode === "custom" ? "default" : "ghost"}
                      className="h-7 text-xs"
                      onClick={() => setPeriodMode("custom")}
                    >
                      Personalizado
                    </Button>
                  </div>

                  {periodMode === "custom" && (
                    <div className="flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border animate-fade-in">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">De:</Label>
                        <Input 
                          type="date" 
                          value={customStartDate} 
                          onChange={(e) => setCustomStartDate(e.target.value)} 
                          className="h-7 text-xs w-[125px] bg-background"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Até:</Label>
                        <Input 
                          type="date" 
                          value={customEndDate} 
                          onChange={(e) => setCustomEndDate(e.target.value)} 
                          className="h-7 text-xs w-[125px] bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground">Tipo:</span>
                  {(["mensal", "quinzenal", "semanal"] as const).map((tipo) => {
                    const tipoLabel = tipo === "mensal" ? "Mensal" : tipo === "quinzenal" ? "Quinzenal" : "Semanal";
                    const tipoChipColors: Record<string, string> = {
                      mensal: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200",
                      quinzenal: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200",
                      semanal: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-200",
                    };
                    const isActive = selectedPeriodTypes.includes(tipo);
                    const count = periodicClients.filter((c: any) => c.payment_type === tipo).length;
                    return (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => {
                          setSelectedPeriodTypes((prev) =>
                            prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
                          );
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-semibold border transition-all",
                          isActive
                            ? tipoChipColors[tipo]
                            : "bg-muted text-muted-foreground border-transparent opacity-60 hover:opacity-100"
                        )}
                      >
                        {tipoLabel} <span className="ml-1 opacity-70">({count})</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground">Status:</span>
                  <div className="w-40">
                    <Select value={periodicStatusFilter} onValueChange={setPeriodicStatusFilter}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="pagos">Pagos</SelectItem>
                        <SelectItem value="pendentes">Pendentes</SelectItem>
                        <SelectItem value="provisionados">Provisionados</SelectItem>
                        <SelectItem value="atrasados">Atrasados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {(["mensal", "quinzenal", "semanal"] as const).map((tipo) => {
                  if (!selectedPeriodTypes.includes(tipo)) return null;
                  const clientsOfType = periodicClients.filter((c: any) => c.payment_type === tipo);
                  if (clientsOfType.length === 0) return null;

                  const tipoLabel = tipo === "mensal" ? "Mensal" : tipo === "quinzenal" ? "Quinzenal" : "Semanal";
                  const tipoColors: Record<string, { badge: string }> = {
                    mensal: { badge: "bg-blue-100 text-blue-800" },
                    quinzenal: { badge: "bg-amber-100 text-amber-800" },
                    semanal: { badge: "bg-emerald-100 text-emerald-800" },
                  };
                  const colors = tipoColors[tipo];

                  return (
                    <div key={tipo} className="space-y-3">
                      <div className="flex items-center gap-2 mt-4 px-1">
                        <Badge variant="outline" className={`font-bold ${colors.badge}`}>{tipoLabel}</Badge>
                        <span className="text-sm text-muted-foreground">{clientsOfType.length} cliente(s)</span>
                      </div>
                      <div className="border rounded-lg bg-card overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Período</TableHead>
                              <TableHead className="text-center">Vendas</TableHead>
                              <TableHead className="text-center">Pacotes</TableHead>
                              <TableHead className="text-right">Total</TableHead>
                              <TableHead className="text-center w-20">Pago</TableHead>
                              <TableHead className="text-center w-20">Provisão</TableHead>
                              <TableHead className="text-center w-24">Atrasado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {periodicReportSummaries
                              .filter((c: any) => c.payment_type === tipo)
                              .filter((c: any) => {
                                if (periodicStatusFilter === "pagos") return c.allPaid && !c.anyOverdue;
                                if (periodicStatusFilter === "pendentes") return c.anyOpen;
                                if (periodicStatusFilter === "provisionados") return c.anyProvisioned;
                                if (periodicStatusFilter === "atrasados") return c.anyOverdue;
                                return true;
                              })
                              .map((c: any) => (
                                <TableRow 
                                  key={c.id} 
                                  className="cursor-pointer" 
                                  onClick={() => openAutoReport(c)}
                                >
                                  <TableCell className="font-semibold">{c.name}</TableCell>
                                  <TableCell>
                                    <span className="text-xs">
                                      {c.periodLabel} — {format(c.periodStart, "dd/MM")} a {format(c.periodEnd, "dd/MM/yyyy")}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">{c.periodSales.length}</TableCell>
                                  <TableCell className="text-center">{c.periodPacotes}</TableCell>
                                  <TableCell className="text-right font-semibold">R$ {c.periodTotal.toFixed(2)}</TableCell>
                                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox 
                                      checked={c.allPaid} 
                                      onCheckedChange={(checked) => {
                                        togglePeriodPaidMutation.mutate({ 
                                          client_id: c.id, 
                                          client_name: c.name,
                                          start: c.periodStart, 
                                          end: c.periodEnd, 
                                          isPaid: !!checked 
                                        });
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox
                                      disabled={!c.anyOpen}
                                      className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 border-emerald-600"
                                      checked={false}
                                      onCheckedChange={() => {
                                        setProvisionDate(format(new Date(), "yyyy-MM-dd"));
                                        setProvisionDialog({
                                          client_id: c.id,
                                          client_name: c.name,
                                          start: c.periodStart,
                                          end: c.periodEnd,
                                          total: c.periodTotal,
                                          periodLabel: `${c.periodLabel} (${format(c.periodStart, "dd/MM")} a ${format(c.periodEnd, "dd/MM/yyyy")})`,
                                        });
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={!c.anyOpen || markPeriodOverdueMutation.isPending}
                                      className="h-5 px-1.5 gap-0.5 text-[10px] border-red-500 text-red-600 hover:bg-red-600 hover:text-white"
                                      onClick={() => {
                                        if (window.confirm(`Marcar pedidos em aberto de ${c.name} como atrasado?`)) {
                                          markPeriodOverdueMutation.mutate({ client_id: c.id, client_name: c.name, start: c.periodStart, end: c.periodEnd });
                                        }
                                      }}
                                    >
                                      <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="avulsos">
            {salesFetching && sales.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Carregando pedidos de avulsos...
                </CardContent>
              </Card>
            ) : avulsoClients.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum cliente avulso cadastrado.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="no-print">
                  <CardContent className="pt-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <Label className="text-xs mb-1 block">Buscar Cliente</Label>
                          <Input
                            placeholder="Buscar por nome do cliente..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="w-full"
                          />
                        </div>
                        <div className="w-full sm:w-48">
                          <Label className="text-xs mb-1 block">Ordenar por</Label>
                          <Select value={avulsoSortBy} onValueChange={setAvulsoSortBy}>
                            <SelectTrigger>
                              <SelectValue placeholder="Ordenar por..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cliente">Nome</SelectItem>
                              <SelectItem value="total">Valor Total</SelectItem>
                              <SelectItem value="vendas">Qtd Vendas</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-full sm:w-48">
                          <Label className="text-xs mb-1 block">Status</Label>
                          <Select value={avulsoStatusFilter} onValueChange={setAvulsoStatusFilter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Filtrar por status..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Todos</SelectItem>
                              <SelectItem value="pagos">Pagos</SelectItem>
                              <SelectItem value="pendentes">Pendentes</SelectItem>
                              <SelectItem value="provisionados">Provisionados</SelectItem>
                              <SelectItem value="atrasados">Atrasados</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Data Início</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !avulsoStartDate && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {avulsoStartDate ? format(avulsoStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={avulsoStartDate}
                                  onSelect={setAvulsoStartDate}
                                  locale={ptBR}
                                  initialFocus
                                  modifiers={{ allPaid: avulsoFullyPaidDays }}
                                  modifiersClassNames={{ allPaid: "bg-green-500 text-white hover:bg-green-600 focus:bg-green-600" }}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Data Final</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !avulsoEndDate && "text-muted-foreground")}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {avulsoEndDate ? format(avulsoEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={avulsoEndDate}
                                  onSelect={setAvulsoEndDate}
                                  locale={ptBR}
                                  initialFocus
                                  modifiers={{ allPaid: avulsoFullyPaidDays }}
                                  modifiersClassNames={{ allPaid: "bg-green-500 text-white hover:bg-green-600 focus:bg-green-600" }}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!avulsoStartDate && !avulsoEndDate && (
                            <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border">
                              <Button
                                size="sm"
                                variant={periodMode === "anterior" ? "secondary" : "ghost"}
                                className="h-8 text-xs px-2"
                                onClick={() => setPeriodMode("anterior")}
                              >
                                Mês Anterior
                              </Button>
                              <Button
                                size="sm"
                                variant={periodMode === "atual" ? "secondary" : "ghost"}
                                className="h-8 text-xs px-2"
                                onClick={() => setPeriodMode("atual")}
                              >
                                Mês Atual
                              </Button>
                            </div>
                          )}
                          {(avulsoStartDate || avulsoEndDate || avulsoStatusFilter !== "todos" || clientSearch) && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setAvulsoStartDate(undefined);
                                setAvulsoEndDate(undefined);
                                setAvulsoStatusFilter("todos");
                                setClientSearch("");
                              }}
                              className="h-10 px-3"
                            >
                              <X className="h-4 w-4 mr-2" /> Limpar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="border rounded-lg bg-card overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-center">Vendas</TableHead>
                        <TableHead className="text-center">Pacotes</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-center w-20">Pago</TableHead>
                        <TableHead className="text-center w-24">Atrasado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {avulsoReportSummaries
                        .filter((c: any) => 
                          c.periodSales.length > 0 && 
                          c.name.toLowerCase().includes(clientSearch.toLowerCase())
                        )
                        .map((c: any) => (
                          <TableRow 
                            key={c.id} 
                            className="cursor-pointer" 
                            onClick={() => openAutoReport(c, { sales: c.periodSales, start: c.periodStart, end: c.periodEnd })}
                          >
                            <TableCell className="font-semibold">{c.name}</TableCell>
                            <TableCell>
                              <span className="text-xs">
                                {c.periodLabel}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">{c.periodSales.length}</TableCell>
                            <TableCell className="text-center">{c.periodPacotes}</TableCell>
                            <TableCell className="text-right font-semibold">R$ {c.periodTotal.toFixed(2)}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Checkbox 
                                checked={c.allPaid} 
                                onCheckedChange={(checked) => {
                                  togglePeriodPaidMutation.mutate({ 
                                    client_id: c.id, 
                                    client_name: c.name,
                                    start: c.periodStart, 
                                    end: c.periodEnd, 
                                    isPaid: !!checked 
                                  });
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!c.anyOpen || markPeriodOverdueMutation.isPending}
                                className="h-5 px-1.5 gap-0.5 text-[10px] border-red-500 text-red-600 hover:bg-red-600 hover:text-white"
                                onClick={() => {
                                  if (window.confirm(`Marcar pedidos em aberto de ${c.name} como atrasado?`)) {
                                    markPeriodOverdueMutation.mutate({ client_id: c.id, client_name: c.name, start: c.periodStart, end: c.periodEnd });
                                  }
                                }}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      {avulsoReportSummaries.filter((c: any) => 
                        c.periodSales.length > 0 && 
                        c.name.toLowerCase().includes(clientSearch.toLowerCase())
                      ).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Nenhuma venda encontrada para clientes avulsos no período selecionado ou com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="drivers">
            <Card>
              <CardHeader><CardTitle className="text-base">Relatório de Entregas por Motorista</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-6">
                  <div className="space-y-1">
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={driverStartDate} onChange={(e) => setDriverStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data Final</Label>
                    <Input type="date" value={driverEndDate} onChange={(e) => setDriverEndDate(e.target.value)} />
                  </div>
                </div>
                <DriverReport sales={sales} startDate={driverStartDate} endDate={driverEndDate} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top10">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-4 w-4" /> Top 10 Clientes por Faturamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-6">
                  <div className="space-y-1">
                    <Label className="text-xs">Data Início</Label>
                    <Input type="date" value={topStartDate} onChange={(e) => setTopStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Data Final</Label>
                    <Input type="date" value={topEndDate} onChange={(e) => setTopEndDate(e.target.value)} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Período: {format(parseISO(topStartDate), "dd/MM/yyyy")} a {format(parseISO(topEndDate), "dd/MM/yyyy")}
                  </div>
                </div>

                {topFetching ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                ) : topClientsData.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada no período</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Pacotes</TableHead>
                        <TableHead className="text-right">Pedidos</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topClientsData.map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-bold">
                            {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                          </TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">{c.packages.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right">{c.orders.toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-bold">
                            R$ {c.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {showReport && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
          <div className="no-print sticky top-0 bg-white border-b p-3 flex gap-2 items-center z-10">
            <Button onClick={() => handlePrintReport(MANUAL_REPORT_PRINT_ID, `relatorio-${startDate}-${endDate}`)}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir
            </Button>
            <Button variant="outline" onClick={() => { setShowReport(false); setManualReportZoom(1); }}>
              Voltar
            </Button>
            {selectedClientNames.length === 1 && (() => {
              const singleClient = clients.find((c: any) => c.id === selectedClients[0]);
              if (!singleClient?.whatsapp) return null;
              const openSales = filtered.filter((s: any) => !s.is_paid);
              const salesForMessage = openSales.length > 0 ? openSales : filtered;
              const totalManual = salesForMessage.reduce((s: number, x: any) => s + Number(x.total), 0);
              const uniqueDays = Array.from(new Set(
                salesForMessage.map((s: any) => format(parseISO(s.created_at), "dd/MM/yyyy"))
              )).sort((a, b) => {
                const [da, ma, ya] = a.split("/").map(Number);
                const [db, mb, yb] = b.split("/").map(Number);
                return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
              });
              const datesText = uniqueDays.length === 0
                ? ""
                : uniqueDays.length === 1
                  ? uniqueDays[0]
                  : uniqueDays.length === 2
                    ? `${uniqueDays[0]} e ${uniqueDays[1]}`
                    : `${uniqueDays.slice(0, -1).join(", ")} e ${uniqueDays[uniqueDays.length - 1]}`;
              return (
                <Button
                  variant="outline"
                  className="bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
                  onClick={() => {
                    shareReportOnWhatsApp({
                      elementId: MANUAL_REPORT_PRINT_ID,
                      fileName: `relatorio-${singleClient.name}-${startDate}-a-${endDate}`.replace(/\s+/g, "_"),
                      whatsapp: singleClient.whatsapp,
                      message: "",
                    });
                  }}
                >
                  <MessageCircle className="h-4 w-4 mr-2" /> Enviar WhatsApp
                </Button>
              );
            })()}
            <div className="ml-auto flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setManualReportZoom(prev => Math.max(0.3, prev - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium w-14 text-center">{Math.round(manualReportZoom * 100)}%</span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setManualReportZoom(prev => Math.min(2, prev + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="text-xs ml-1" onClick={() => setManualReportZoom(1)}>100%</Button>
            </div>
          </div>

          <div style={{ transform: `scale(${manualReportZoom})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}>
            <div id={MANUAL_REPORT_PRINT_ID} className="max-w-3xl mx-auto p-8 print:p-0 print:max-w-none" style={{ fontFamily: "Arial, Helvetica, sans-serif", color: '#111' }}>
            <div className="text-center mb-5 pb-3 border-b border-gray-300">
              <img src={logoGeloplus} alt="Gelo Plus" className="h-16 mx-auto mb-2" />
              <p className="text-base font-medium" style={{ color: '#333' }}>Relatório de Vendas</p>
              <p className="text-sm font-semibold mt-1">
                Período: {format(parseISO(startDate), "dd/MM/yyyy")} a {format(parseISO(endDate), "dd/MM/yyyy")}
              </p>
              {selectedClientNames.length > 0 && (
                <p className="mt-1 text-sm font-bold">
                  {selectedClientNames.length === 1
                    ? `Cliente: ${selectedClientNames[0].name}${selectedClientNames[0].cpf_cnpj ? ` — ${selectedClientNames[0].cpf_cnpj}` : ""}`
                    : `Clientes: ${selectedClientNames.map((c) => c.name).join(", ")}`}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: '#555' }}>
                Emitido em: {format(new Date(), "dd/MM/yyyy HH:mm")}
              </p>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center py-8" style={{ color: '#666' }}>Nenhuma venda encontrada no período</p>
            ) : (
              <>
                <div className="mb-4 pb-3 border-b-2 border-gray-400 space-y-1">
                  <div className="flex justify-between text-sm"><span>Total de pedidos:</span><strong>{totalPedidos}</strong></div>
                  <div className="flex justify-between text-sm"><span>Total de pacotes vendidos:</span><strong>{totalPacotes}</strong></div>
                  <div className="flex justify-between text-base pt-2 border-t border-gray-300 mt-1">
                    <span className="font-bold">Total Geral:</span>
                    <span className="font-bold">R$ {totalGeral.toFixed(2)}</span>
                  </div>
                </div>
                {(() => {
                  const renderRow = (sale: any, idx: number, showClient: boolean) => {
                    const items = (sale.sale_items as any[]) || [];
                    const qty = items.reduce((t: number, i: any) => t + i.quantity, 0);
                    return (
                      <tr key={sale.id} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f8f8f8' }}>
                        <td className="py-1.5 px-2 text-sm font-mono">#{sale.order_number}</td>
                        <td className="py-1.5 px-2 text-sm">{format(parseISO(sale.created_at), "dd/MM/yyyy")}</td>
                        {showClient && (
                          <td className="py-1.5 px-2 text-sm">{(sale.clients as any)?.name || "—"}</td>
                        )}
                        <td className="py-1.5 px-2 text-sm">{items.map((i: any) => `${i.product_name} (${i.quantity}x)${i.price_table_name ? ` [${i.price_table_name}]` : ""}`).join(", ")}</td>
                        <td className="py-1.5 px-2 text-sm text-right font-medium">{qty}</td>
                        <td className="py-1.5 px-2 text-sm text-right font-bold">R$ {Number(sale.total).toFixed(2)}</td>
                        <td className="py-1.5 px-2 text-center no-print">
                          <Checkbox
                            checked={sale.is_paid}
                            onCheckedChange={(checked) => {
                              togglePaidMutation.mutate({ 
                                saleId: sale.id, 
                                isPaid: !!checked,
                                clientName: (sale.clients as any)?.name || "—",
                                amount: Number(sale.total)
                              });
                            }}
                          />
                        </td>
                      </tr>
                    );
                  };

                  const renderHeader = (showClient: boolean) => (
                    <thead>
                      <tr style={{ borderBottom: '2px solid #333' }}>
                        <th className="text-left py-2 px-2 text-sm font-bold">Nº Pedido</th>
                        <th className="text-left py-2 px-2 text-sm font-bold">Data</th>
                        {showClient && <th className="text-left py-2 px-2 text-sm font-bold">Cliente</th>}
                        <th className="text-left py-2 px-2 text-sm font-bold">Produtos (Tabela)</th>
                        <th className="text-right py-2 px-2 text-sm font-bold">Qtd</th>
                        <th className="text-right py-2 px-2 text-sm font-bold">Total</th>
                        <th className="text-center py-2 px-2 text-sm font-bold no-print">Pago</th>
                      </tr>
                    </thead>
                  );

                  // Se nenhum cliente selecionado: lista única sequencial (com coluna Cliente)
                  if (selectedClients.length === 0) {
                    const sorted = [...filtered].sort((a: any, b: any) => (a.order_number ?? 0) - (b.order_number ?? 0));
                    return (
                      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                        {renderHeader(true)}
                        <tbody>
                          {sorted.map((sale: any, idx: number) => renderRow(sale, idx, true))}
                        </tbody>
                      </table>
                    );
                  }

                  // Vários (ou um) clientes selecionados: agrupa por cliente, sequencial por nº pedido dentro do grupo
                  const groups = new Map<string, { name: string; sales: any[] }>();
                  filtered.forEach((sale: any) => {
                    const key = sale.client_id || (sale.clients as any)?.name || "—";
                    const name = (sale.clients as any)?.name || "—";
                    if (!groups.has(key)) groups.set(key, { name, sales: [] });
                    groups.get(key)!.sales.push(sale);
                  });
                  const groupList = Array.from(groups.values())
                    .map((g) => ({ ...g, sales: [...g.sales].sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? 0)) }))
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

                  return (
                    <div className="space-y-6">
                      {groupList.map((group) => {
                        const subTotal = group.sales.reduce((s, sale: any) => s + Number(sale.total), 0);
                        const subPacotes = group.sales.reduce((s, sale: any) => s + ((sale.sale_items as any[]) || []).reduce((t: number, i: any) => t + i.quantity, 0), 0);
                        return (
                          <div key={group.name}>
                            <div className="mb-2 pb-1 border-b border-gray-400 flex items-center justify-between">
                              <p className="text-sm font-bold">{group.name}</p>
                              <div className="flex items-center gap-4">
                                <p className="text-sm font-bold">{subPacotes} pacote(s)</p>
                                <p className="text-sm font-bold text-right">Total: R$ {subTotal.toFixed(2)}</p>
                              </div>
                            </div>
                            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                              {renderHeader(false)}
                              <tbody>
                                {group.sales.map((sale: any, idx: number) => renderRow(sale, idx, false))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          </div>
        </div>,
        document.body
      )}

      <Dialog open={!!provisionDialog} onOpenChange={(o) => { if (!o) setProvisionDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-emerald-600" /> Provisionar em Contas a Receber
            </DialogTitle>
          </DialogHeader>
          {provisionDialog && (
            <div className="space-y-3">
              <div className="text-sm">
                <div><strong>Cliente:</strong> {provisionDialog.client_name}</div>
                <div><strong>Período:</strong> {provisionDialog.periodLabel}</div>
                <div><strong>Valor:</strong> R$ {provisionDialog.total.toFixed(2)}</div>
              </div>
              <div>
                <Label>Data de vencimento</Label>
                <Input type="date" value={provisionDate} onChange={(e) => setProvisionDate(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProvisionDialog(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={markPeriodProvisionMutation.isPending || !provisionDate}
              onClick={() => {
                if (!provisionDialog) return;
                markPeriodProvisionMutation.mutate({
                  client_id: provisionDialog.client_id,
                  client_name: provisionDialog.client_name,
                  start: provisionDialog.start,
                  end: provisionDialog.end,
                  due_date: provisionDate,
                  periodLabel: provisionDialog.periodLabel,
                });
              }}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriverReport({ sales, startDate, endDate }: { sales: any[]; startDate: string; endDate: string }) {
  const filtered = useMemo(() => {
    return sales.filter((s: any) => {
      const d = parseISO(s.created_at);
      return isWithinInterval(d, {
        start: startOfDay(parseISO(startDate)),
        end: endOfDay(parseISO(endDate)),
      });
    });
  }, [sales, startDate, endDate]);

  const grouped = useMemo(() => {
    const map: Record<string, { name: string; totalValue: number; totalBags: number; orders: number }> = {};
    filtered.forEach((sale: any) => {
      const driverName = sale.driver_name || "Sem motorista";
      const key = sale.driver_id || "none";
      if (!map[key]) map[key] = { name: driverName, totalValue: 0, totalBags: 0, orders: 0 };
      map[key].totalValue += Number(sale.total);
      map[key].orders += 1;
      map[key].totalBags += (sale.sale_items as any[])?.reduce((t: number, i: any) => t + i.quantity, 0) || 0;
    });
    return Object.values(map).sort((a, b) => b.totalValue - a.totalValue);
  }, [filtered]);

  const grandTotalValue = grouped.reduce((s, g) => s + g.totalValue, 0);
  const grandTotalBags = grouped.reduce((s, g) => s + g.totalBags, 0);
  const grandTotalOrders = grouped.reduce((s, g) => s + g.orders, 0);

  if (grouped.length === 0) {
    return <p className="text-center text-muted-foreground py-8">Nenhuma venda no período selecionado.</p>;
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Motorista</TableHead>
            <TableHead className="text-right">Pedidos</TableHead>
            <TableHead className="text-right">Total Sacos</TableHead>
            <TableHead className="text-right">Total Valor</TableHead>
            <TableHead className="text-right">Comissão (1,5%)</TableHead>
            <TableHead className="text-right">Motorista (50%)</TableHead>
            <TableHead className="text-right">Entregador (50%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((g, i) => {
            const commission = g.totalValue * 0.015;
            const half = commission / 2;
            return (
              <TableRow key={i}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="text-right">{g.orders}</TableCell>
                <TableCell className="text-right">{g.totalBags}</TableCell>
                <TableCell className="text-right font-semibold">R$ {g.totalValue.toFixed(2)}</TableCell>
                <TableCell className="text-right text-primary font-semibold">R$ {commission.toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {half.toFixed(2)}</TableCell>
                <TableCell className="text-right">R$ {half.toFixed(2)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="mt-4 pt-4 border-t space-y-1">
        <div className="flex justify-between text-sm"><span>Total de pedidos:</span><strong>{grandTotalOrders}</strong></div>
        <div className="flex justify-between text-sm"><span>Total de sacos:</span><strong>{grandTotalBags}</strong></div>
        <div className="flex justify-between text-base pt-2 border-t mt-2">
          <span className="font-bold">Total Geral:</span>
          <span className="font-bold">R$ {grandTotalValue.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm text-primary">
          <span>Comissão Total (1,5%):</span>
          <strong>R$ {(grandTotalValue * 0.015).toFixed(2)}</strong>
        </div>
        <div className="flex justify-between text-sm">
          <span>Parte Motorista (50%):</span>
          <strong>R$ {(grandTotalValue * 0.015 / 2).toFixed(2)}</strong>
        </div>
        <div className="flex justify-between text-sm">
          <span>Parte Entregador (50%):</span>
          <strong>R$ {(grandTotalValue * 0.015 / 2).toFixed(2)}</strong>
        </div>
      </div>
    </div>
  );
}
