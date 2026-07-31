import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, ChevronDown, ChevronRight, FolderPlus, Package, LayoutDashboard, List, TrendingUp, TrendingDown, Wrench } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/financeiro/lib/finance-store";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from "recharts";

interface Category { id: string; name: string; sort_order: number; year: number; }
interface PatrimonyItem { id: string; category_id: string; name: string; quantity: number; code: string; market_value: number; location: string; sort_order: number; year: number; }
interface Maintenance { id: string; item_code: string; maintenance_date: string; description: string; cost: number; responsible: string | null; }

const COLORS = ["#003399", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899", "#84CC16"];

const YEAR_CHIPS = Array.from({ length: 2035 - 2024 + 1 }, (_, i) => 2024 + i);

export default function Patrimonio({ year: yearProp }: { year: number }) {
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(yearProp);
  const year = selectedYear;
  useEffect(() => { setSelectedYear(yearProp); }, [yearProp]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<PatrimonyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allItems, setAllItems] = useState<PatrimonyItem[]>([]);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PatrimonyItem | null>(null);
  const [itemCatId, setItemCatId] = useState("");
  const [itemForm, setItemForm] = useState({ name: "", quantity: 1, code: "", market_value: 0, location: "" });
  const [dossierItem, setDossierItem] = useState<PatrimonyItem | null>(null);
  const [maintenances, setMaintenances] = useState<Maintenance[]>([]);
  const [maintLoading, setMaintLoading] = useState(false);
  const [editingMaint, setEditingMaint] = useState<Maintenance | null>(null);
  const [maintForm, setMaintForm] = useState({ maintenance_date: new Date().toISOString().slice(0, 10), description: "", cost: 0, responsible: "" });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [catRes, itemRes, allCatRes, allItemRes] = await Promise.all([
      supabase.from("fin_patrimony_categories").select("*").eq("user_id", user.id).eq("year", year).order("sort_order"),
      supabase.from("fin_patrimony_items").select("*").eq("user_id", user.id).eq("year", year).order("sort_order"),
      supabase.from("fin_patrimony_categories").select("*").eq("user_id", user.id).order("year"),
      supabase.from("fin_patrimony_items").select("*").eq("user_id", user.id).order("year"),
    ]);
    if (catRes.data) {
      setCategories(catRes.data);
      setExpandedCats(new Set(catRes.data.map((c: any) => c.id)));
    }
    if (itemRes.data) setItems(itemRes.data);
    if (allCatRes.data) setAllCategories(allCatRes.data);
    if (allItemRes.data) setAllItems(allItemRes.data);
    setLoading(false);
  }, [user, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCat = (id: string) => {
    setExpandedCats(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const openNewCat = () => { setEditingCat(null); setCatName(""); setCatDialogOpen(true); };
  const openEditCat = (c: Category) => { setEditingCat(c); setCatName(c.name); setCatDialogOpen(true); };

  const saveCat = async () => {
    if (!user || !catName.trim()) return;
    if (editingCat) {
      await supabase.from("fin_patrimony_categories").update({ name: catName.trim() }).eq("id", editingCat.id);
    } else {
      await supabase.from("fin_patrimony_categories").insert({ user_id: user.id, name: catName.trim(), sort_order: categories.length, year });
    }
    setCatDialogOpen(false);
    toast.success(editingCat ? "Categoria atualizada" : "Categoria criada");
    fetchData();
  };

  const deleteCat = async (id: string) => {
    if (!confirm("Excluir esta categoria e todos os seus itens?")) return;
    await supabase.from("fin_patrimony_categories").delete().eq("id", id);
    toast.success("Categoria excluída");
    fetchData();
  };

  const openNewItem = (catId: string) => {
    setEditingItem(null);
    setItemCatId(catId);
    setItemForm({ name: "", quantity: 1, code: "", market_value: 0, location: "" });
    setItemDialogOpen(true);
  };

  const openEditItem = (item: PatrimonyItem) => {
    setEditingItem(item);
    setItemCatId(item.category_id);
    setItemForm({ name: item.name, quantity: item.quantity, code: item.code, market_value: item.market_value, location: item.location });
    setItemDialogOpen(true);
  };

  const saveItem = async () => {
    if (!user || !itemForm.name.trim()) return;
    const payload = {
      user_id: user.id,
      category_id: itemCatId,
      name: itemForm.name.trim(),
      quantity: itemForm.quantity,
      code: itemForm.code.trim(),
      market_value: itemForm.market_value,
      location: itemForm.location.trim(),
      sort_order: editingItem ? editingItem.sort_order : items.filter(i => i.category_id === itemCatId).length,
      year,
    };
    if (editingItem) {
      await supabase.from("fin_patrimony_items").update(payload).eq("id", editingItem.id);
    } else {
      await supabase.from("fin_patrimony_items").insert(payload);
    }
    setItemDialogOpen(false);
    toast.success(editingItem ? "Item atualizado" : "Item adicionado");
    fetchData();
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Excluir este item?")) return;
    await supabase.from("fin_patrimony_items").delete().eq("id", id);
    toast.success("Item excluído");
    fetchData();
  };

  const openDossier = async (item: PatrimonyItem) => {
    if (!item.code?.trim()) {
      toast.error("Este item não tem código. Cadastre um código para abrir o dossiê.");
      return;
    }
    setDossierItem(item);
    setEditingMaint(null);
    setMaintForm({ maintenance_date: new Date().toISOString().slice(0, 10), description: "", cost: 0, responsible: "" });
    setMaintLoading(true);
    const { data } = await supabase.from("fin_patrimony_maintenances")
      .select("*").eq("user_id", user!.id).eq("item_code", item.code)
      .order("maintenance_date", { ascending: false });
    setMaintenances(data || []);
    setMaintLoading(false);
  };

  const saveMaintenance = async () => {
    if (!user || !dossierItem || !maintForm.description.trim()) return;
    const payload = {
      user_id: user.id,
      item_code: dossierItem.code,
      maintenance_date: maintForm.maintenance_date,
      description: maintForm.description.trim(),
      cost: maintForm.cost || 0,
      responsible: maintForm.responsible.trim() || null,
    };
    if (editingMaint) {
      await supabase.from("fin_patrimony_maintenances").update(payload).eq("id", editingMaint.id);
    } else {
      await supabase.from("fin_patrimony_maintenances").insert(payload);
    }
    toast.success(editingMaint ? "Manutenção atualizada" : "Manutenção registrada");
    setEditingMaint(null);
    setMaintForm({ maintenance_date: new Date().toISOString().slice(0, 10), description: "", cost: 0, responsible: "" });
    const { data } = await supabase.from("fin_patrimony_maintenances")
      .select("*").eq("user_id", user.id).eq("item_code", dossierItem.code)
      .order("maintenance_date", { ascending: false });
    setMaintenances(data || []);
  };

  const editMaintenance = (m: Maintenance) => {
    setEditingMaint(m);
    setMaintForm({ maintenance_date: m.maintenance_date, description: m.description, cost: Number(m.cost), responsible: m.responsible || "" });
  };

  const deleteMaintenance = async (id: string) => {
    if (!confirm("Excluir esta manutenção?")) return;
    await supabase.from("fin_patrimony_maintenances").delete().eq("id", id);
    setMaintenances(prev => prev.filter(m => m.id !== id));
    toast.success("Manutenção excluída");
  };

  const getCatItems = (catId: string) => items.filter(i => i.category_id === catId);
  const getCatTotal = (catId: string) => getCatItems(catId).reduce((s, i) => s + i.quantity * i.market_value, 0);
  const getCatQty = (catId: string) => getCatItems(catId).reduce((s, i) => s + i.quantity, 0);
  const grandTotal = categories.reduce((s, c) => s + getCatTotal(c.id), 0);

  const availableYears = [...new Set(allCategories.map(c => c.year))].sort();
  const yearTotals = availableYears.map(y => {
    const yCats = allCategories.filter(c => c.year === y);
    const yItems = allItems.filter(i => i.year === y);
    const total = yCats.reduce((s, c) => s + yItems.filter(i => i.category_id === c.id).reduce((si, i) => si + i.quantity * i.market_value, 0), 0);
    return { year: String(y), total };
  });
  const currentYearCategoryBreakdown = categories.map(c => ({ name: c.name, value: getCatTotal(c.id) })).filter(c => c.value > 0);
  const prevYearTotal = yearTotals.find(y => y.year === String(year - 1))?.total || 0;
  const variation = prevYearTotal > 0 ? ((grandTotal - prevYearTotal) / prevYearTotal) * 100 : 0;

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando patrimônio...</div>;

  return (
    <Tabs defaultValue="cadastro" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-xl">
        <TabsTrigger value="cadastro" className="flex items-center gap-2 rounded-lg"><List className="h-4 w-4" /> Cadastro</TabsTrigger>
        <TabsTrigger value="dashboard" className="flex items-center gap-2 rounded-lg"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
      </TabsList>

      <TabsContent value="cadastro" className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {YEAR_CHIPS.map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold border transition-all ${
                selectedYear === y
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Patrimônio {year}</h2>
            <p className="text-sm text-muted-foreground">Levantamento de bens do ano {year}</p>
          </div>
          <Button onClick={openNewCat} className="gap-2 w-full sm:w-auto"><FolderPlus className="h-4 w-4" /> Nova Categoria</Button>
        </div>

        {yearTotals.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base sm:text-lg">Evolução do Patrimônio — Ano a Ano</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={yearTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" name="Patrimônio" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Patrimônio Total — {year}</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">{categories.length} categorias</p>
              <p className="text-sm text-muted-foreground">{items.length} itens</p>
            </div>
          </CardContent>
        </Card>

        {categories.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma categoria cadastrada para {year}.
          </CardContent></Card>
        )}

        {categories.map(cat => {
          const catItems = getCatItems(cat.id);
          const expanded = expandedCats.has(cat.id);
          return (
            <Card key={cat.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <button onClick={() => toggleCat(cat.id)} className="flex items-center gap-2 text-left min-w-0">
                    {expanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                    <CardTitle className="text-base sm:text-lg truncate">{cat.name}</CardTitle>
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">({getCatQty(cat.id)})</span>
                  </button>
                  <div className="flex items-center gap-2 ml-7 sm:ml-0">
                    <span className="text-sm sm:text-base font-bold text-primary">{formatCurrency(getCatTotal(cat.id))}</span>
                    <Button variant="ghost" size="icon" onClick={() => openEditCat(cat)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteCat(cat.id)} className="h-8 w-8 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              {expanded && (
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Qtde</TableHead>
                          <TableHead className="hidden sm:table-cell">Código</TableHead>
                          <TableHead className="hidden sm:table-cell text-right">Valor Unit.</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="hidden md:table-cell">Local</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {catItems.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum item</TableCell></TableRow>
                        ) : catItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium text-sm">
                              <button onClick={() => openDossier(item)} className="text-left hover:text-primary hover:underline inline-flex items-center gap-1.5">
                                <Wrench className="h-3 w-3 opacity-60" /> {item.name}
                              </button>
                            </TableCell>
                            <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm">{item.code || "—"}</TableCell>
                            <TableCell className="hidden sm:table-cell text-right text-sm">{formatCurrency(item.market_value)}</TableCell>
                            <TableCell className="text-right font-medium text-sm">{formatCurrency(item.quantity * item.market_value)}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm">{item.location || "—"}</TableCell>
                            <TableCell>
                              <div className="flex gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditItem(item)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteItem(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      {catItems.length > 0 && (
                        <TableFooter>
                          <TableRow>
                            <TableCell className="font-bold text-sm">Subtotal</TableCell>
                            <TableCell className="text-center font-bold text-sm">{getCatQty(cat.id)}</TableCell>
                            <TableCell className="hidden sm:table-cell" />
                            <TableCell className="hidden sm:table-cell" />
                            <TableCell className="text-right font-bold text-primary text-sm">{formatCurrency(getCatTotal(cat.id))}</TableCell>
                            <TableCell className="hidden md:table-cell" />
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      )}
                    </Table>
                  </div>
                  <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => openNewItem(cat.id)}>
                    <Plus className="h-4 w-4" /> Adicionar Item
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </TabsContent>

      <TabsContent value="dashboard" className="space-y-6">
        <h2 className="text-2xl font-bold">Evolução Patrimonial</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Patrimônio {year}</p><p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Patrimônio {year - 1}</p><p className="text-2xl font-bold">{formatCurrency(prevYearTotal)}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Variação</p><div className="flex items-center gap-2">{variation >= 0 ? <TrendingUp className="h-5 w-5 text-green-500" /> : <TrendingDown className="h-5 w-5 text-destructive" />}<p className={`text-2xl font-bold ${variation >= 0 ? "text-green-500" : "text-destructive"}`}>{prevYearTotal > 0 ? `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%` : "—"}</p></div></CardContent></Card>
        </div>

        {yearTotals.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Patrimônio Total por Ano</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yearTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" /><YAxis tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {currentYearCategoryBreakdown.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Distribuição — {year}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={currentYearCategoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {currentYearCategoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categories.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm font-medium truncate">{c.name}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-bold text-primary">{formatCurrency(getCatTotal(c.id))}</p>
                      <p className="text-[11px] text-muted-foreground">{getCatQty(c.id)} un.</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} />
            </div>
            <Button onClick={saveCat} className="w-full">{editingCat ? "Salvar" : "Criar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Nome</label><Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Quantidade</label><Input type="number" min={1} value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))} /></div>
              <div><label className="text-sm font-medium">Código</label><Input value={itemForm.code} onChange={e => setItemForm(f => ({ ...f, code: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm font-medium">Valor de Mercado (R$)</label><Input type="number" min={0} step={0.01} value={itemForm.market_value} onChange={e => setItemForm(f => ({ ...f, market_value: parseFloat(e.target.value) || 0 }))} /></div>
              <div><label className="text-sm font-medium">Local</label><Input value={itemForm.location} onChange={e => setItemForm(f => ({ ...f, location: e.target.value }))} /></div>
            </div>
            <Button onClick={saveItem} className="w-full">{editingItem ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dossierItem} onOpenChange={o => !o && setDossierItem(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" /> Dossiê — {dossierItem?.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Código: <span className="font-mono font-semibold">{dossierItem?.code}</span> · Histórico de todos os anos
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-sm font-semibold">{editingMaint ? "Editar manutenção" : "Nova manutenção"}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="text-xs font-medium">Data</label><Input type="date" value={maintForm.maintenance_date} onChange={e => setMaintForm(f => ({ ...f, maintenance_date: e.target.value }))} /></div>
                <div><label className="text-xs font-medium">Custo (R$)</label><Input type="number" min={0} step={0.01} value={maintForm.cost} onChange={e => setMaintForm(f => ({ ...f, cost: parseFloat(e.target.value) || 0 }))} /></div>
              </div>
              <div><label className="text-xs font-medium">Descrição do serviço</label><Input value={maintForm.description} onChange={e => setMaintForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Troca de compressor" /></div>
              <div><label className="text-xs font-medium">Responsável / Fornecedor</label><Input value={maintForm.responsible} onChange={e => setMaintForm(f => ({ ...f, responsible: e.target.value }))} /></div>
              <div className="flex gap-2">
                <Button onClick={saveMaintenance} className="flex-1">{editingMaint ? "Salvar" : "Registrar"}</Button>
                {editingMaint && <Button variant="outline" onClick={() => { setEditingMaint(null); setMaintForm({ maintenance_date: new Date().toISOString().slice(0, 10), description: "", cost: 0, responsible: "" }); }}>Cancelar</Button>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Histórico ({maintenances.length})</p>
                <p className="text-sm font-bold text-primary">Total: {formatCurrency(maintenances.reduce((s, m) => s + Number(m.cost), 0))}</p>
              </div>
              {maintLoading ? (
                <p className="text-center text-sm text-muted-foreground py-6">Carregando...</p>
              ) : maintenances.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6 border rounded-lg">Nenhuma manutenção registrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="hidden sm:table-cell">Responsável</TableHead>
                        <TableHead className="text-right">Custo</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenances.map(m => (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm whitespace-nowrap">{new Date(m.maintenance_date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-sm">{m.description}</TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">{m.responsible || "—"}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatCurrency(Number(m.cost))}</TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => editMaintenance(m)}><Edit2 className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => deleteMaintenance(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
