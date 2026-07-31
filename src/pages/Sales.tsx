import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { ShoppingCart, Plus, Trash2, Printer, CalendarIcon, Copy, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { OrderReceipt } from "@/components/OrderReceipt";
import { printElement } from "@/lib/print";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  price_table_name: string;
}

export default function Sales() {
  const qc = useQueryClient();
  const searchStr = useLocation({ select: (l) => l.searchStr });
  const searchParams = new URLSearchParams(searchStr);
  const routeClientParam = searchParams.get("clientId") || "";
  const hasRouteTransfer = Boolean(routeClientParam && sessionStorage.getItem("routeCart"));
  const [clientId, setClientId] = useState(() => routeClientParam);

  // Pre-fill cart from route items (passed via sessionStorage)
  const [routeId] = useState<string | null>(() => {
    if (!hasRouteTransfer) return null;
    const rid = sessionStorage.getItem("routeId");
    return rid;
  });

  const [routeClientId] = useState<string | null>(() => {
    if (!hasRouteTransfer) return null;
    const rcid = sessionStorage.getItem("routeClientId");
    return rcid;
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    if (!hasRouteTransfer) return [];
    try {
      const raw = sessionStorage.getItem("routeCart");
      if (raw) {
        return JSON.parse(raw) as CartItem[];
      }
    } catch {}
    return [];
  });

  const [driverId, setDriverId] = useState(() => {
    if (!hasRouteTransfer) return "";
    const rdid = sessionStorage.getItem("routeDriverId");
    return rdid || "";
  });
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedTable, setSelectedTable] = useState("");
  const [qty, setQty] = useState("1");
  const [saleDate, setSaleDate] = useState<Date>(() => {
    if (!hasRouteTransfer) return new Date();
    const routeDateStr = sessionStorage.getItem("routeDate");
    if (routeDateStr) return new Date(routeDateStr);
    return new Date();
  });
  const [batchNumber, setBatchNumber] = useState(() => {
    if (!hasRouteTransfer) return localStorage.getItem("lastBatchNumber") || "";
    const routeBatch = sessionStorage.getItem("routeBatchNumber");
    if (routeBatch) {
      localStorage.setItem("lastBatchNumber", routeBatch);
      return routeBatch;
    }
    return localStorage.getItem("lastBatchNumber") || "";
  });
  const [observations, setObservations] = useState(() => {
    if (!hasRouteTransfer) return "";
    const routeObs = sessionStorage.getItem("routeObservations");
    return routeObs || "";
  });
  const [receiptData, setReceiptData] = useState<any>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const clearRouteSession = () => {
    ["routeId", "routeClientId", "routeCart", "routeDriverId", "routeDate", "routeBatchNumber", "routeObservations"].forEach((key) => {
      sessionStorage.removeItem(key);
    });
  };

  const handlePrintReceipt = async () => {
    try {
      await printElement("order-receipt-print", `pedido-${receiptData?.sale?.order_number || "impressao"}`);
    } catch {
      toast.error("Erro ao preparar impressão do pedido");
    }
  };

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("active", true).order("name");
      return data || [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("active", true).order("name");
      return data || [];
    },
  });

  const { data: priceTables = [] } = useQuery({
    queryKey: ["price-tables"],
    queryFn: async () => {
      const { data } = await supabase.from("price_tables").select("*").order("name");
      return data || [];
    },
  });

  // Auto-select client's default price table when client changes
  useEffect(() => {
    if (!clientId) return;
    const client = clients.find((c: any) => c.id === clientId);
    const defaultTable = (client as any)?.default_price_table;
    if (defaultTable && priceTables.length > 0) {
      const table = priceTables.find((t: any) => t.name === defaultTable);
      if (table) setSelectedTable(table.id);
    }
  }, [clientId, clients, priceTables]);

  const { data: drivers = [] } = useQuery({
    queryKey: ["drivers-active"],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("*").eq("active", true).order("name");
      return data || [];
    },
  });

  // Fetch last order for selected client
  const { data: lastOrder } = useQuery({
    queryKey: ["last-order", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!sales || sales.length === 0) return null;
      const sale = sales[0];
      const { data: items } = await supabase
        .from("sale_items")
        .select("*")
        .eq("sale_id", sale.id);
      return { sale, items: items || [] };
    },
    enabled: !!clientId,
  });

  const cloneLastOrder = () => {
    if (!lastOrder?.items || lastOrder.items.length === 0) return;
    const clonedCart: CartItem[] = lastOrder.items.map((item: any) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: Number(item.unit_price),
      subtotal: Number(item.subtotal),
      price_table_name: item.price_table_name || "",
    }));
    setCart(clonedCart);
    toast.success("Pedido anterior clonado para o carrinho!");
  };

  // Auto-select main driver
  useEffect(() => {
    const main = drivers.find((d: any) => d.is_main);
    if (main && !driverId) {
      setDriverId(main.id);
    }
  }, [drivers]);

  const selectedTableObj = priceTables.find((t: any) => t.id === selectedTable);
  const selectedPrice = selectedTableObj ? Number((selectedTableObj as any).price) : null;

  const total = useMemo(() => cart.reduce((s, i) => s + i.subtotal, 0), [cart]);

  const addToCart = () => {
    const product = products.find((p) => p.id === selectedProduct);
    const table = selectedTableObj as any;
    if (!product || selectedPrice === null || !table) return;
    const q = parseInt(qty) || 1;

    setCart([...cart, {
      product_id: product.id,
      product_name: product.name,
      quantity: q,
      unit_price: selectedPrice,
      subtotal: q * selectedPrice,
      price_table_name: table.name,
    }]);
    setSelectedProduct("");
    setSelectedTable("");
    setQty("1");
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const finalize = useMutation({
    mutationFn: async () => {
      if (!clientId || cart.length === 0) throw new Error("invalid");
      const client = clients.find((c) => c.id === clientId);
      const driver = drivers.find((d: any) => d.id === driverId);

      const salePayload: any = { client_id: clientId, client_name: client?.name || null, total, created_at: saleDate.toISOString(), batch_number: batchNumber || null, driver_id: driverId || null, driver_name: driver?.name || null, observations: observations.trim() || null };
      if (routeId) salePayload.route_id = routeId;
      if (routeClientId) salePayload.route_client_id = routeClientId;

      const { data: sale, error: e1 } = await supabase
        .from("sales")
        .insert(salePayload)
        .select()
        .single();
      if (e1 || !sale) throw e1;

      const items = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        subtotal: i.subtotal,
        price_table_name: i.price_table_name,
      }));
      const { error: e2 } = await supabase.from("sale_items").insert(items);
      if (e2) throw e2;

      // Stock is automatically deducted by DB trigger on sale_items insert.
      
      return sale;
    },
    onSuccess: (sale) => {
      const client = clients.find((c) => c.id === clientId);
      const driver = drivers.find((d: any) => d.id === driverId);
      setReceiptData({ sale, client, items: cart, total, driverName: driver?.name || null, observations: observations.trim() || null });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["route-ordered-rcids"] });
      qc.invalidateQueries({ queryKey: ["route-completion-all"] });
      qc.invalidateQueries({ queryKey: ["orders-list"] });
      qc.invalidateQueries({ queryKey: ["orders-count"] });
      qc.invalidateQueries({ queryKey: ["reports-sales"] });
      qc.invalidateQueries({ queryKey: ["reports-manual"] });
      clearRouteSession();
      setCart([]);
      setClientId("");
      setSaleDate(new Date());
      setObservations("");
      toast.success("Venda finalizada com sucesso!");
    },
    onError: () => toast.error("Erro ao finalizar venda"),
  });

  if (receiptData) {
    return (
      <div className="animate-fade-in">
        <div className="no-print mb-4 flex gap-2">
          <Button onClick={handlePrintReceipt}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Button variant="outline" onClick={() => setReceiptData(null)}>
            Nova Venda
          </Button>
        </div>
        <div id="order-receipt-print">
          <OrderReceipt data={receiptData} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <ShoppingCart className="h-6 w-6" /> Nova Venda
      </h2>

      <Card>
        <CardHeader><CardTitle className="text-base">Cliente e Data</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Button
                variant="outline"
                role="combobox"
                onClick={() => { setClientSearch(""); setClientOpen(true); }}
                className="w-full justify-between font-normal"
              >
                {clientId
                  ? clients.find((c) => c.id === clientId)?.name || "Cliente"
                  : "Selecione o cliente..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
              <Dialog open={clientOpen} onOpenChange={setClientOpen}>
                <DialogContent className="max-w-sm p-0">
                  <DialogHeader className="p-4 pb-2">
                    <DialogTitle className="text-base">Selecionar Cliente</DialogTitle>
                  </DialogHeader>
                  <div className="px-4 pb-2">
                    <Input
                      placeholder="Buscar por nome ou CNPJ..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <ScrollArea className="max-h-[300px] px-2 pb-4">
                    {clients
                      .filter((c) => {
                        const q = clientSearch.toLowerCase();
                        return !q || c.name.toLowerCase().includes(q) || (c.cpf_cnpj || "").toLowerCase().includes(q);
                      })
                      .map((c) => (
                        <button
                          key={c.id}
                          className={cn(
                            "flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                            clientId === c.id && "bg-accent text-accent-foreground font-medium"
                          )}
                          onClick={() => { setClientId(c.id); setClientOpen(false); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4 shrink-0", clientId === c.id ? "opacity-100" : "opacity-0")} />
                          {c.name} {c.cpf_cnpj ? `(${c.cpf_cnpj})` : ""}
                        </button>
                      ))}
                    {clients.filter((c) => {
                      const q = clientSearch.toLowerCase();
                      return !q || c.name.toLowerCase().includes(q) || (c.cpf_cnpj || "").toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                    )}
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motorista</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger><SelectValue placeholder="Selecione o motorista..." /></SelectTrigger>
                <SelectContent>
                  {drivers.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} {d.is_main ? "⭐" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data do Pedido</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(saleDate, "dd/MM/yyyy", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={saleDate}
                    onSelect={(d) => d && setSaleDate(d)}
                    locale={ptBR}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lote</Label>
              <Input
                placeholder="Nº do lote"
                value={batchNumber}
                onChange={(e) => {
                  setBatchNumber(e.target.value);
                  localStorage.setItem("lastBatchNumber", e.target.value);
                }}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs">Observações</Label>
              <Textarea
                placeholder="Ex: entregar às 14h, portão lateral..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="min-h-[60px] text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last order card - shows when client is selected and has previous orders */}
      {clientId && lastOrder?.items && lastOrder.items.length > 0 && cart.length === 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-primary" />
                Último pedido — {lastOrder.sale.created_at
                  ? format(new Date(lastOrder.sale.created_at), "dd/MM/yyyy", { locale: ptBR })
                  : ""}
                {lastOrder.sale.batch_number ? ` • Lote ${lastOrder.sale.batch_number}` : ""}
              </span>
              <Button size="sm" onClick={cloneLastOrder} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Repetir pedido
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {lastOrder.items.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-sm bg-background rounded-md px-3 py-2 border">
                  <div>
                    <span className="font-medium">{item.product_name}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      {item.price_table_name || ""}
                    </span>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <span className="font-semibold">{item.quantity} un</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">
                      R$ {Number(item.subtotal).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">R$ {Number(lastOrder.sale.total).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Adicionar Produto</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Produto</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} (est: {p.stock_quantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tabela de Preço</Label>
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {priceTables.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} — R$ {Number(t.price).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço Un.</Label>
              <Input readOnly value={selectedPrice !== null ? `R$ ${selectedPrice.toFixed(2)}` : "—"} className="bg-muted" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Qtd</Label>
              <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <Button onClick={addToCart} disabled={!selectedProduct || !selectedTable}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {cart.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tabela</TableHead>
                  <TableHead className="text-right">Preço Un.</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{item.price_table_name}</TableCell>
                    <TableCell className="text-right">R$ {item.unit_price.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">R$ {item.subtotal.toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeFromCart(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <span className="text-lg font-bold">Total: R$ {total.toFixed(2)}</span>
              <Button
                size="lg"
                onClick={() => finalize.mutate()}
                disabled={!clientId || cart.length === 0 || finalize.isPending}
              >
                {finalize.isPending ? "Finalizando..." : "Finalizar Venda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
