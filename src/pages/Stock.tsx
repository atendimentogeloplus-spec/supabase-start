import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Warehouse, AlertTriangle, Package, FileText, Pencil, Trash2, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Stock() {
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  // Loss form
  const [lossProductId, setLossProductId] = useState("");
  const [lossQuantity, setLossQuantity] = useState("");
  const [lossDate, setLossDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [lossReason, setLossReason] = useState("");

  // Report form
  const [reportStart, setReportStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [reportEnd, setReportEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [showReport, setShowReport] = useState(false);

  // Edit dialogs
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editLoss, setEditLoss] = useState<any | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<any | null>(null);
  const [deleteLoss, setDeleteLoss] = useState<any | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("active", true).order("name");
      return data || [];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["stock-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_entries").select("*, products(name)").order("entry_date", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: losses = [] } = useQuery({
    queryKey: ["stock-losses"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_losses").select("*, products(name)").order("loss_date", { ascending: false }).limit(50);
      return data || [];
    },
  });

  // Calculate totals per product
  const { data: allEntries = [] } = useQuery({
    queryKey: ["all-stock-entries"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_entries").select("product_id, quantity");
      return data || [];
    },
  });

  const { data: allLosses = [] } = useQuery({
    queryKey: ["all-stock-losses"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_losses").select("product_id, quantity");
      return data || [];
    },
  });

  // Report entries by period
  const { data: reportEntries = [] } = useQuery({
    queryKey: ["report-stock-entries", reportStart, reportEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_entries")
        .select("*, products(name)")
        .gte("entry_date", reportStart)
        .lte("entry_date", reportEnd)
        .order("entry_date", { ascending: true });
      return data || [];
    },
    enabled: showReport,
  });

  // Report losses by period
  const { data: reportLosses = [] } = useQuery({
    queryKey: ["report-stock-losses", reportStart, reportEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_losses")
        .select("*, products(name)")
        .gte("loss_date", reportStart)
        .lte("loss_date", reportEnd)
        .order("loss_date", { ascending: true });
      return data || [];
    },
    enabled: showReport,
  });

  const reportByProduct = showReport
    ? products.map((p) => {
        const pEntries = reportEntries.filter((e: any) => e.product_id === p.id);
        const pLosses = reportLosses.filter((l: any) => l.product_id === p.id);
        const total = pEntries.reduce((s: number, e: any) => s + e.quantity, 0);
        const totalLoss = pLosses.reduce((s: number, l: any) => s + l.quantity, 0);
        return { ...p, entries: pEntries, losses: pLosses, total, totalLoss };
      }).filter((p) => p.total > 0 || p.totalLoss > 0)
    : [];

  // Dashboard: do dia 1 do mês atual até hoje
  const dashStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const dashEnd = format(new Date(), "yyyy-MM-dd");

  const { data: dashEntries = [] } = useQuery({
    queryKey: ["dash-stock-entries", dashStart, dashEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_entries")
        .select("product_id, quantity, entry_date")
        .gte("entry_date", dashStart)
        .lte("entry_date", dashEnd);
      return data || [];
    },
  });

  const { data: dashLosses = [] } = useQuery({
    queryKey: ["dash-stock-losses", dashStart, dashEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_losses")
        .select("product_id, quantity, loss_date")
        .gte("loss_date", dashStart)
        .lte("loss_date", dashEnd);
      return data || [];
    },
  });

  const dashByProduct = products.map((p) => {
    const produced = dashEntries
      .filter((e: any) => e.product_id === p.id)
      .reduce((s: number, e: any) => s + e.quantity, 0);
    const lost = dashLosses
      .filter((l: any) => l.product_id === p.id)
      .reduce((s: number, l: any) => s + l.quantity, 0);
    return { ...p, produced, lost };
  }).filter((p) => p.produced > 0 || p.lost > 0);

  const dashTotalProduced = dashByProduct.reduce((s, p) => s + p.produced, 0);
  const dashTotalLost = dashByProduct.reduce((s, p) => s + p.lost, 0);

  const productTotals = products.map((p) => {
    const totalProduced = allEntries
      .filter((e: any) => e.product_id === p.id)
      .reduce((s: number, e: any) => s + e.quantity, 0);
    const totalLoss = allLosses
      .filter((l: any) => l.product_id === p.id)
      .reduce((s: number, l: any) => s + l.quantity, 0);
    return {
      ...p,
      totalProduced,
      totalLoss,
      // Usa products.stock_quantity (mantido pelos triggers de produção,
      // perdas e vendas) para refletir o estoque real disponível,
      // batendo com a tela de Vendas.
      stockAvailable: p.stock_quantity,
    };
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity);
      if (!productId || !qty) throw new Error("invalid");

      // Stock is automatically incremented by DB trigger on stock_entries insert.
      const { error: e1 } = await supabase.from("stock_entries").insert({
        product_id: productId,
        quantity: qty,
        entry_date: entryDate,
        notes: notes || null,
      });
      if (e1) throw e1;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["all-stock-entries"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      setQuantity("");
      setNotes("");
      toast.success("Produção registrada!");
    },
    onError: () => toast.error("Erro ao registrar produção"),
  });

  const addLoss = useMutation({
    mutationFn: async () => {
      const qty = parseInt(lossQuantity);
      if (!lossProductId || !qty) throw new Error("invalid");

      const { error } = await supabase.from("stock_losses").insert({
        product_id: lossProductId,
        quantity: qty,
        loss_date: lossDate,
        reason: lossReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-losses"] });
      qc.invalidateQueries({ queryKey: ["all-stock-losses"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      setLossQuantity("");
      setLossReason("");
      toast.success("Perda registrada!");
    },
    onError: () => toast.error("Erro ao registrar perda"),
  });

  // Stock is automatically adjusted by DB trigger on stock_entries update.
  const updateEntry = useMutation({
    mutationFn: async () => {
      if (!editEntry) throw new Error("invalid");
      const newQty = parseInt(editEntry.quantity);
      if (!newQty || newQty < 1) throw new Error("invalid_qty");

      const { error: e1 } = await supabase
        .from("stock_entries")
        .update({
          product_id: editEntry.product_id,
          quantity: newQty,
          entry_date: editEntry.entry_date,
          notes: editEntry.notes || null,
        })
        .eq("id", editEntry.id);
      if (e1) throw e1;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["all-stock-entries"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      qc.invalidateQueries({ queryKey: ["report-stock-entries"] });
      setEditEntry(null);
      toast.success("Lançamento atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar lançamento"),
  });

  const removeEntry = useMutation({
    mutationFn: async (entry: any) => {
      if (!entry?.id) throw new Error("invalid");
      // Stock is automatically decremented by DB trigger on stock_entries delete.
      const { error } = await supabase.from("stock_entries").delete().eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-entries"] });
      qc.invalidateQueries({ queryKey: ["all-stock-entries"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      qc.invalidateQueries({ queryKey: ["report-stock-entries"] });
      setDeleteEntry(null);
      toast.success("Lançamento excluído!");
    },
    onError: (err: any) => {
      console.error("removeEntry error:", err);
      toast.error("Erro ao excluir lançamento: " + (err?.message || "desconhecido"));
    },
  });

  const updateLoss = useMutation({
    mutationFn: async () => {
      if (!editLoss) throw new Error("invalid");
      const newQty = parseInt(editLoss.quantity);
      if (!newQty || newQty < 1) throw new Error("invalid_qty");

      const { error } = await supabase
        .from("stock_losses")
        .update({
          product_id: editLoss.product_id,
          quantity: newQty,
          loss_date: editLoss.loss_date,
          reason: editLoss.reason || null,
        })
        .eq("id", editLoss.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-losses"] });
      qc.invalidateQueries({ queryKey: ["all-stock-losses"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      setEditLoss(null);
      toast.success("Perda atualizada!");
    },
    onError: () => toast.error("Erro ao atualizar perda"),
  });

  const removeLoss = useMutation({
    mutationFn: async (loss: any) => {
      if (!loss?.id) throw new Error("invalid");
      const { error } = await supabase.from("stock_losses").delete().eq("id", loss.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-losses"] });
      qc.invalidateQueries({ queryKey: ["all-stock-losses"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      setDeleteLoss(null);
      toast.success("Perda excluída!");
    },
    onError: (err: any) => {
      console.error("removeLoss error:", err);
      toast.error("Erro ao excluir perda: " + (err?.message || "desconhecido"));
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold flex items-center gap-2">
        <Warehouse className="h-6 w-6" /> Estoque
      </h2>

      {/* Stock summary per product */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {productTotals.map((p) => (
          <Card key={p.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Produzido: {p.totalProduced} · Perdas: {p.totalLoss}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold flex items-center gap-1">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    {p.stockAvailable}
                  </div>
                  <p className="text-xs text-muted-foreground">disponível</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="production">
        <TabsList>
          <TabsTrigger value="production">Produção Diária</TabsTrigger>
          <TabsTrigger value="losses" className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Perdas
          </TabsTrigger>
          <TabsTrigger value="report" className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Relatório
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-1">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="production" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Registrar Produção</CardTitle></CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); addEntry.mutate(); }}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
              >
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Produto *</Label>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade *</Label>
                  <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
                </div>
                <Button type="submit" disabled={!productId || !quantity || addEntry.isPending}>
                  <Plus className="h-4 w-4 mr-2" /> Registrar
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>{format(parseISO(e.entry_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{e.products?.name}</TableCell>
                    <TableCell>{e.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{e.notes || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditEntry({
                            id: e.id,
                            product_id: e.product_id,
                            quantity: String(e.quantity),
                            entry_date: e.entry_date,
                            notes: e.notes || "",
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEntry(e)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma entrada registrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="losses" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Registrar Perda</CardTitle></CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => { e.preventDefault(); addLoss.mutate(); }}
                className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
              >
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Produto *</Label>
                  <Select value={lossProductId} onValueChange={setLossProductId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade *</Label>
                  <Input type="number" min="1" value={lossQuantity} onChange={(e) => setLossQuantity(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={lossDate} onChange={(e) => setLossDate(e.target.value)} />
                </div>
                <Button type="submit" variant="destructive" disabled={!lossProductId || !lossQuantity || addLoss.isPending}>
                  <Plus className="h-4 w-4 mr-2" /> Registrar Perda
                </Button>
              </form>
              <div className="mt-3">
                <Label className="text-xs">Motivo da perda</Label>
                <Textarea
                  value={lossReason}
                  onChange={(e) => setLossReason(e.target.value)}
                  placeholder="Descreva o motivo da perda..."
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          <div className="border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {losses.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{format(parseISO(l.loss_date), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-medium">{l.products?.name}</TableCell>
                    <TableCell className="text-destructive font-semibold">-{l.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{l.reason || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditLoss({
                            id: l.id,
                            product_id: l.product_id,
                            quantity: String(l.quantity),
                            loss_date: l.loss_date,
                            reason: l.reason || "",
                          })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteLoss(l)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {losses.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma perda registrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Relatório de Produção por Período</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Data Inicial</Label>
                  <Input type="date" value={reportStart} onChange={(e) => { setReportStart(e.target.value); setShowReport(false); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Final</Label>
                  <Input type="date" value={reportEnd} onChange={(e) => { setReportEnd(e.target.value); setShowReport(false); }} />
                </div>
                <Button onClick={() => setShowReport(true)}>
                  <FileText className="h-4 w-4 mr-2" /> Gerar Relatório
                </Button>
              </div>
            </CardContent>
          </Card>

          {showReport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Produção e Perdas de {format(parseISO(reportStart), "dd/MM/yyyy")} a {format(parseISO(reportEnd), "dd/MM/yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {reportByProduct.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum movimento registrado neste período</p>
                ) : (
                  <>
                    {reportByProduct.map((p) => (
                      <div key={p.id} className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h4 className="font-semibold text-base">{p.name}</h4>
                          <div className="flex gap-4 text-sm">
                            <span className="font-bold">Produção: {p.total} un.</span>
                            <span className="font-bold text-destructive">Perdas: {p.totalLoss} un.</span>
                            <span className="font-bold">Líquido: {p.total - p.totalLoss} un.</span>
                          </div>
                        </div>
                        {p.entries.length > 0 && (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-muted/50 text-xs font-semibold">Produção</div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Data</TableHead>
                                  <TableHead>Quantidade</TableHead>
                                  <TableHead>Observações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {p.entries.map((e: any) => (
                                  <TableRow key={e.id}>
                                    <TableCell>{format(parseISO(e.entry_date), "dd/MM/yyyy")}</TableCell>
                                    <TableCell className="font-medium">{e.quantity}</TableCell>
                                    <TableCell className="text-muted-foreground">{e.notes || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        {p.losses.length > 0 && (
                          <div className="border rounded-lg overflow-hidden">
                            <div className="px-3 py-2 bg-destructive/10 text-xs font-semibold text-destructive">Perdas</div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Data</TableHead>
                                  <TableHead>Quantidade</TableHead>
                                  <TableHead>Motivo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {p.losses.map((l: any) => (
                                  <TableRow key={l.id}>
                                    <TableCell>{format(parseISO(l.loss_date), "dd/MM/yyyy")}</TableCell>
                                    <TableCell className="font-medium text-destructive">-{l.quantity}</TableCell>
                                    <TableCell className="text-muted-foreground">{l.reason || "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    ))}

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-base">Total Produzido</span>
                        <span className="font-bold text-xl">
                          {reportByProduct.reduce((s, p) => s + p.total, 0)} un.
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-base text-destructive">Total de Perdas</span>
                        <span className="font-bold text-xl text-destructive">
                          {reportByProduct.reduce((s, p) => s + p.totalLoss, 0)} un.
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="font-semibold text-base">Líquido</span>
                        <span className="font-bold text-xl">
                          {reportByProduct.reduce((s, p) => s + p.total - p.totalLoss, 0)} un.
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard do Mês — {format(parseISO(dashStart), "dd/MM/yyyy")} a {format(parseISO(dashEnd), "dd/MM/yyyy", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">Total Produzido</p>
                    <p className="text-3xl font-bold mt-1">{dashTotalProduced}</p>
                    <p className="text-xs text-muted-foreground mt-1">unidades</p>
                  </CardContent>
                </Card>
                <Card className="bg-destructive/5">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">Total de Perdas</p>
                    <p className="text-3xl font-bold mt-1 text-destructive">{dashTotalLost}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {dashTotalProduced > 0
                        ? `${((dashTotalLost / dashTotalProduced) * 100).toFixed(1)}% da produção`
                        : "—"}
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-secondary/30">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">Produção Líquida</p>
                    <p className="text-3xl font-bold mt-1">{dashTotalProduced - dashTotalLost}</p>
                    <p className="text-xs text-muted-foreground mt-1">unidades</p>
                  </CardContent>
                </Card>
              </div>

              {dashByProduct.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum movimento neste período</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Produzido</TableHead>
                        <TableHead className="text-right">Perdas</TableHead>
                        <TableHead className="text-right">% Perdas</TableHead>
                        <TableHead className="text-right">Líquido</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashByProduct.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right">{p.produced}</TableCell>
                          <TableCell className="text-right text-destructive font-semibold">{p.lost}</TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {p.produced > 0 ? `${((p.lost / p.produced) * 100).toFixed(1)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{p.produced - p.lost}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Production Entry Dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Lançamento de Produção</DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Produto *</Label>
                <Select
                  value={editEntry.product_id}
                  onValueChange={(v) => setEditEntry({ ...editEntry, product_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editEntry.quantity}
                    onChange={(e) => setEditEntry({ ...editEntry, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={editEntry.entry_date}
                    onChange={(e) => setEditEntry({ ...editEntry, entry_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  value={editEntry.notes}
                  onChange={(e) => setEditEntry({ ...editEntry, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A diferença será aplicada automaticamente no estoque do produto.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Cancelar</Button>
            <Button onClick={() => updateEntry.mutate()} disabled={updateEntry.isPending}>
              {updateEntry.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Loss Dialog */}
      <Dialog open={!!editLoss} onOpenChange={(o) => !o && setEditLoss(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perda</DialogTitle>
          </DialogHeader>
          {editLoss && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Produto *</Label>
                <Select
                  value={editLoss.product_id}
                  onValueChange={(v) => setEditLoss({ ...editLoss, product_id: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={editLoss.quantity}
                    onChange={(e) => setEditLoss({ ...editLoss, quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={editLoss.loss_date}
                    onChange={(e) => setEditLoss({ ...editLoss, loss_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Motivo</Label>
                <Textarea
                  value={editLoss.reason}
                  onChange={(e) => setEditLoss({ ...editLoss, reason: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLoss(null)}>Cancelar</Button>
            <Button onClick={() => updateLoss.mutate()} disabled={updateLoss.isPending}>
              {updateLoss.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Entry Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => !o && setDeleteEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A quantidade {deleteEntry?.quantity} será removida do estoque do produto. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteEntry && removeEntry.mutate(deleteEntry)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Loss Confirmation */}
      <AlertDialog open={!!deleteLoss} onOpenChange={(o) => !o && setDeleteLoss(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir perda?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLoss && removeLoss.mutate(deleteLoss)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
