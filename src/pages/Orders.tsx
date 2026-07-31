import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DialogDescription } from "@/components/ui/dialog";
import { ClipboardList, Pencil, Trash2, Save, X, Printer, CalendarIcon, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderReceipt } from "@/components/OrderReceipt";
import { printElement } from "@/lib/print";
import { useAuth } from "@/hooks/useAuth";

const PAGE_SIZE = 20;

interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  price_table_name?: string | null;
}

export default function Orders() {
  const { session, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [editingSale, setEditingSale] = useState<any>(null);
  const [editItems, setEditItems] = useState<SaleItem[]>([]);
  const [editDate, setEditDate] = useState<Date | undefined>(undefined);
  const [editObservations, setEditObservations] = useState("");
  const [editDriverId, setEditDriverId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("data");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [page, setPage] = useState(0);
  const canLoadData = !authLoading && !!session?.user;

  // Debounce search to avoid querying on every keystroke
  const searchTimerRef = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(0);
    }, 400);
  };

  const handlePrintReceipt = async () => {
    try {
      await printElement("order-receipt-print", `pedido-${receiptData?.sale?.order_number || "impressao"}`);
    } catch {
      toast.error("Erro ao preparar impressão do pedido");
    }
  };

  const {
    data: sales = [],
    isLoading: salesLoading,
    error: salesError,
    isFetching: salesFetching,
  } = useQuery({
    queryKey: ["orders-list", session?.user?.id, page, debouncedSearch, sortBy, statusFilter, startDate, endDate],
    queryFn: async () => {
      const sortColumn = sortBy === "numero" ? "order_number"
        : sortBy === "cliente" ? "client_name"
        : sortBy === "lote" ? "batch_number"
        : "created_at";

      let query = supabase
        .from("sales")
        .select("*, sale_items(*)")
        .order(sortColumn, { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim();
        // Try number search first
        const asNum = parseInt(q);
        if (!isNaN(asNum) && String(asNum) === q) {
          query = query.eq("order_number", asNum);
        } else {
          query = query.or(`client_name.ilike.%${q}%,batch_number.ilike.%${q}%`);
        }
      }

      if (statusFilter === "pagos") {
        query = query.eq("is_paid", true).eq("is_overdue", false);
      } else if (statusFilter === "pendentes") {
        query = query.eq("is_paid", false).eq("is_overdue", false);
      } else if (statusFilter === "atrasados") {
        query = query.eq("is_overdue", true);
      }

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        // Set to end of day
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: canLoadData,
    placeholderData: keepPreviousData,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ["orders-count", session?.user?.id, debouncedSearch, statusFilter, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("id", { count: "exact", head: true });

      if (debouncedSearch.trim()) {
        const q = debouncedSearch.trim();
        const asNum = parseInt(q);
        if (!isNaN(asNum) && String(asNum) === q) {
          query = query.eq("order_number", asNum);
        } else {
          query = query.or(`client_name.ilike.%${q}%,batch_number.ilike.%${q}%`);
        }
      }

      if (statusFilter === "pagos") {
        query = query.eq("is_paid", true).eq("is_overdue", false);
      } else if (statusFilter === "pendentes") {
        query = query.eq("is_paid", false).eq("is_overdue", false);
      } else if (statusFilter === "atrasados") {
        query = query.eq("is_overdue", true);
      }

      if (startDate) {
        query = query.gte("created_at", startDate.toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte("created_at", end.toISOString());
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: canLoadData,
    placeholderData: keepPreviousData,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const {
    data: priceTables = [],
  } = useQuery({
    queryKey: ["price-tables", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("price_tables").select("*").order("name");
      return data || [];
    },
    enabled: canLoadData,
  });

  const {
    data: products = [],
  } = useQuery({
    queryKey: ["orders-products", session?.user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name").order("name");
      return data || [];
    },
    enabled: canLoadData,
  });

  const {
    data: clients = [],
  } = useQuery({
    queryKey: ["orders-clients", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, cpf_cnpj, whatsapp, address_street, address_number, address_neighborhood, address_city, address_state, address_zip")
        .order("name");

      if (error) throw error;
      return data || [];
    },
    enabled: canLoadData,
  });

  const {
    data: drivers = [],
  } = useQuery({
    queryKey: ["drivers", session?.user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: canLoadData,
  });

  const isPageLoading = authLoading || (canLoadData && salesLoading);
  const pageError = salesError;

  const clientsMap = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client]));
  }, [clients]);

  const getSaleClient = (sale: any) => {
    if (sale?.client_id) {
      const linkedClient = clientsMap.get(sale.client_id);
      if (linkedClient) return linkedClient;
    }

    if (sale?.client_name) {
      return {
        name: sale.client_name,
        cpf_cnpj: null,
        whatsapp: null,
        address_street: null,
        address_number: null,
        address_neighborhood: null,
        address_city: null,
        address_state: null,
        address_zip: null,
        payment_type: null,
      };
    }

    return null;
  };

  // Sales are already filtered/sorted server-side
  const filtered = sales;

  const openEdit = (sale: any) => {
    setEditingSale(sale);
    setEditItems(
      (sale.sale_items as SaleItem[]).map((i) => ({ ...i }))
    );
    setEditDate(parseISO(sale.created_at));
    setEditObservations(sale.observations || "");
    setEditDriverId(sale.driver_id || null);
  };

  const updateItemQty = (itemId: string, newQty: number) => {
    setEditItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, quantity: Math.max(1, newQty), subtotal: Math.max(1, newQty) * i.unit_price }
          : i
      )
    );
  };

  const removeItem = (itemId: string) => {
    setEditItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const updateItemProduct = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setEditItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, product_id: productId, product_name: product.name }
          : i
      )
    );
  };

  const updateItemTable = (itemId: string, tableName: string) => {
    const table = priceTables.find((t) => t.name === tableName);
    if (!table) return;
    setEditItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? { ...i, price_table_name: tableName, unit_price: Number(table.price), subtotal: i.quantity * Number(table.price) }
          : i
      )
    );
  };

  const togglePaidMutation = useMutation({
    mutationFn: async ({ saleId, isPaid }: { saleId: string; isPaid: boolean }) => {
      const { error } = await supabase
        .from("sales")
        .update(isPaid ? { is_paid: true, is_overdue: false } : { is_paid: false })
        .eq("id", saleId);
      if (error) throw error;
      if (isPaid) {
        const { data: sale } = await supabase.from("sales").select("order_number").eq("id", saleId).maybeSingle();
        const n = (sale as any)?.order_number;
        if (n) {
          await supabase.from("fin_receivables")
            .update({ status: "pago", paid_at: new Date().toISOString() })
            .eq("status", "aberto")
            .or(`description.ilike.%#${n}%,notes.ilike.%#${n}%`);
        }
      }
    },
    onMutate: async ({ saleId, isPaid }) => {
      await qc.cancelQueries({ queryKey: ["orders-list"] });
      const queryKey = ["orders-list", session?.user?.id, page, debouncedSearch, sortBy, statusFilter, startDate, endDate];
      const previousSales = qc.getQueryData(queryKey);

      qc.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return old.map((sale: any) => 
          sale.id === saleId ? { ...sale, is_paid: isPaid } : sale
        );
      });

      return { previousSales };
    },
    onError: (err, variables, context) => {
      if (context?.previousSales) {
        qc.setQueryData(["orders-list", session?.user?.id, page, debouncedSearch, sortBy, statusFilter, startDate, endDate], context.previousSales);
      }
      toast.error("Erro ao atualizar status de pagamento.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["fin-receivables"] });
      qc.invalidateQueries({ queryKey: ["fin_receivables"] });
    },
    onSuccess: () => {
      toast.success("Status de pagamento atualizado!");
    },
  });

  const toggleOverdueMutation = useMutation({
    mutationFn: async ({ saleId }: { saleId: string; isOverdue: boolean }) => {
      if (!session?.user?.id) throw new Error("no-user");
      const { data: sale, error: selErr } = await supabase
        .from("sales")
        .select("id, total, order_number, created_at, client_id, client_name, clients(name)")
        .eq("id", saleId)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!sale) throw new Error("no-sale");
      const clientName = (sale as any).clients?.name || (sale as any).client_name || "Cliente";
      const saleDate = String(sale.created_at).slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      const dueDate = saleDate < todayStr ? saleDate : todayStr;
      const { error: recvErr } = await supabase.from("fin_receivables").insert({
        user_id: session.user.id,
        description: `Atrasado #${sale.order_number} — ${clientName}`,
        client_name: clientName,
        amount: Number(sale.total || 0),
        due_date: dueDate,
        category: "Vendas de Gelo",
        payment_method: "Pix",
        notes: `(origem: pedido atrasado #${sale.order_number})`,
        status: "aberto",
      });
      if (recvErr) throw recvErr;
      const { error: upErr } = await supabase
        .from("sales")
        .update({ is_paid: false, is_overdue: true })
        .eq("id", saleId);
      if (upErr) throw upErr;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["fin-receivables"] });
      qc.invalidateQueries({ queryKey: ["fin_receivables"] });
    },
    onSuccess: () => {
      toast.success("Enviado para o financeiro como atrasado.");
    },
    onError: () => {
      toast.error("Erro ao marcar como atrasado.");
    },
  });





  const deleteSale = useMutation({
    mutationFn: async (saleId: string) => {
      const { error: itemsError } = await supabase.from("sale_items").delete().eq("sale_id", saleId);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from("sales").delete().eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["orders-count"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["orders-products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["route-ordered-rcids"] });
      qc.invalidateQueries({ queryKey: ["route-completion-all"] });
      toast.success("Pedido excluído!");
    },
    onError: () => toast.error("Erro ao excluir pedido."),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editingSale || editItems.length === 0) throw new Error("invalid");

      const newTotal = editItems.reduce((s, i) => s + i.subtotal, 0);

      // Delete removed items
      const originalIds = (editingSale.sale_items as SaleItem[]).map((i) => i.id);
      const currentIds = editItems.map((i) => i.id);
      const removedIds = originalIds.filter((id) => !currentIds.includes(id));

      for (const id of removedIds) {
        await supabase.from("sale_items").delete().eq("id", id);
      }

      // Update remaining items
      for (const item of editItems) {
        await supabase
          .from("sale_items")
          .update({ quantity: item.quantity, subtotal: item.subtotal, unit_price: item.unit_price, price_table_name: item.price_table_name || null, product_id: item.product_id, product_name: item.product_name })
          .eq("id", item.id);
      }

      // Update sale total and date
      const selectedDriver = drivers.find(d => d.id === editDriverId);
      const updateData: any = { 
        total: newTotal, 
        observations: editObservations.trim() || null,
        driver_id: editDriverId,
        driver_name: selectedDriver?.name || null
      };
      if (editDate) {
        updateData.created_at = editDate.toISOString();
      }
      await supabase.from("sales").update(updateData).eq("id", editingSale.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["orders-count"] });
      qc.invalidateQueries({ queryKey: ["sales-dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["orders-products"] });
      setEditingSale(null);
      toast.success("Pedido atualizado com sucesso!");
    },
    onError: () => toast.error("Erro ao atualizar pedido"),
  });

  const editTotal = editItems.reduce((s, i) => s + i.subtotal, 0);

  const printOrder = (sale: any) => {
    const client = getSaleClient(sale);
    const items = (sale.sale_items as any[]).map((i: any) => ({
      product_name: i.product_name,
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      subtotal: Number(i.subtotal),
      price_table_name: i.price_table_name || "",
    }));
    setReceiptData({ sale, client, items, total: Number(sale.total), observations: sale.observations || null });
  };

  if (receiptData) {
    return (
      <div className="animate-fade-in">
        <div className="no-print mb-4 flex gap-2">
          <Button onClick={handlePrintReceipt}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Button variant="outline" onClick={() => setReceiptData(null)}>
            Voltar aos Pedidos
          </Button>
        </div>
        <div id="order-receipt-print">
          <OrderReceipt data={receiptData} />
        </div>
      </div>
    );
  }

  if (isPageLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Carregando pedidos...</p>
      </div>
    );
  }

  if (pageError) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-3">
          <p className="font-medium">Não foi possível carregar os pedidos.</p>
          <p className="text-sm text-muted-foreground">Atualize a página e, se continuar, eu verifico a consulta específica.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <ClipboardList className="h-6 w-6" /> Pedidos
      </h2>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Label className="text-xs mb-1 block">Buscar</Label>
                <Input
                  placeholder="Buscar por cliente, número ou lote..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs mb-1 block">Ordenar por</Label>
                <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(0); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenar por..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="numero">Nº Pedido</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="lote">Lote</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Label className="text-xs mb-1 block">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pagos">Pagos</SelectItem>
                    <SelectItem value="pendentes">Pendentes</SelectItem>
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
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(d) => { setStartDate(d); setPage(0); }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Final</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(d) => { setEndDate(d); setPage(0); }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {(startDate || endDate || statusFilter !== "todos" || search) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setStatusFilter("todos");
                    setSearch("");
                    setDebouncedSearch("");
                    setPage(0);
                  }}
                  className="h-10 px-3"
                >
                  <X className="h-4 w-4 mr-2" /> Limpar Filtros
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-lg bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº Pedido</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Unidades</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center w-[80px]">Pago</TableHead>
              <TableHead className="text-center w-[100px]">Atrasado</TableHead>
              <TableHead className="w-20">Ações</TableHead>

            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((sale: any) => (
              <TableRow key={sale.id} className={cn("cursor-pointer", sale.is_overdue ? "bg-red-50 dark:bg-red-950/20" : sale.is_paid && "bg-emerald-50 dark:bg-emerald-950/20")} onClick={() => openEdit(sale)}>
                <TableCell className="font-mono text-xs">#{sale.order_number}</TableCell>
                <TableCell className={cn(sale.is_overdue ? "text-red-700 dark:text-red-400 font-semibold" : sale.is_paid && "text-emerald-700 dark:text-emerald-400 font-semibold")}>{format(parseISO(sale.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell className="font-medium">{getSaleClient(sale)?.name || (sale as any).client_name || "Cliente excluído"}</TableCell>
                <TableCell className="text-muted-foreground">{sale.batch_number || "—"}</TableCell>
                <TableCell>{(sale.sale_items as any[])?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) || 0} un.</TableCell>
                <TableCell className="text-right font-semibold">R$ {Number(sale.total).toFixed(2)}</TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={sale.is_paid}
                    onCheckedChange={(checked) => {
                      togglePaidMutation.mutate({ saleId: sale.id, isPaid: !!checked });
                    }}
                  />
                </TableCell>
                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                  {sale.is_overdue ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-500 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                      <AlertTriangle className="h-2.5 w-2.5" /> Atrasado
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sale.is_paid || toggleOverdueMutation.isPending}
                      className="h-5 px-1.5 gap-0.5 text-[10px] border-red-500 text-red-600 hover:bg-red-600 hover:text-white"
                      onClick={() => toggleOverdueMutation.mutate({ saleId: sale.id, isOverdue: true })}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> Marcar
                    </Button>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(sale); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Excluir pedido #${sale.order_number}?`)) deleteSale.mutate(sale.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">

                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalCount} pedido(s) encontrado(s)
          {salesFetching && !salesLoading ? " · atualizando..." : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <span className="text-sm font-medium">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <Dialog open={!!editingSale} onOpenChange={(open) => !open && setEditingSale(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Editar Pedido #{editingSale?.order_number}
            </DialogTitle>
            <DialogDescription>
              Revise os itens do pedido, ajuste quantidades e reimprima se necessário.
            </DialogDescription>
          </DialogHeader>

          {editingSale && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                <span>Cliente: <strong>{getSaleClient(editingSale)?.name || editingSale.client_name || "Cliente excluído"}</strong></span>
                <div className="flex items-center gap-2">
                  <span>Data:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-[180px] justify-start text-left font-normal",
                          !editDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDate ? format(editDate, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={setEditDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-center gap-2">
                  <span>Motorista:</span>
                  <Select value={editDriverId || "none"} onValueChange={(val) => setEditDriverId(val === "none" ? null : val)}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Sem motorista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem motorista</SelectItem>
                      {drivers.map((d: any) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  placeholder="Ex: entregar às 14h, portão lateral..."
                  value={editObservations}
                  onChange={(e) => setEditObservations(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead className="text-right">Preço Un.</TableHead>
                    <TableHead className="w-28">Qtd</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {editItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select
                          value={item.product_id}
                          onValueChange={(val) => updateItemProduct(item.id, val)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.price_table_name || ""}
                          onValueChange={(val) => updateItemTable(item.id, val)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Tabela" />
                          </SelectTrigger>
                          <SelectContent>
                            {priceTables.map((t) => (
                              <SelectItem key={t.id} value={t.name}>{t.name} (R$ {Number(t.price).toFixed(2)})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">R$ {item.unit_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItemQty(item.id, parseInt(e.target.value) || 1)}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell className="text-right font-semibold">R$ {item.subtotal.toFixed(2)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          disabled={editItems.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-lg font-bold">Total: R$ {editTotal.toFixed(2)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setEditingSale(null); printOrder(editingSale); }}>
                    <Printer className="h-4 w-4 mr-2" /> Imprimir
                  </Button>
                  <Button variant="outline" onClick={() => setEditingSale(null)}>
                    <X className="h-4 w-4 mr-2" /> Cancelar
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" /> {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
