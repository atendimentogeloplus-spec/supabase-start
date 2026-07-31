import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Search, UserX, UserCheck, FileDown } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { TablesInsert } from "@/integrations/supabase/types";
import logoGeloPlus from "@/assets/logo-geloplus.jpg";

type ClientInsert = TablesInsert<"clients">;

const PAYMENT_LABELS: Record<string, string> = {
  avulso: "Avulso",
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

const emptyClient = {
  name: "",
  cpf_cnpj: "",
  contact: "",
  whatsapp: "",
  address_street: "",
  address_number: "",
  address_neighborhood: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  payment_type: "avulso",
  opening_date: new Date().toISOString().slice(0, 10),
  default_price_table: "",
  billing_method: "pix",
  business_hours: "",
};

export default function Clients() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "opening_date">("name");
  const [form, setForm] = useState(emptyClient);
  const [editId, setEditId] = useState<string | null>(null);
  const [tab, setTab] = useState("active");

  // Dialog para inativar
  const [inactiveDialog, setInactiveDialog] = useState<{ id: string; name: string } | null>(null);
  const [inactiveReason, setInactiveReason] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("name");
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

  // Busca última venda por cliente
  const { data: lastSales = {} } = useQuery({
    queryKey: ["clients-last-sale"],
    queryFn: async () => {
      const { data } = await supabase.from("sales").select("client_id, created_at").order("created_at", { ascending: false });
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        if (s.client_id && !map[s.client_id]) map[s.client_id] = s.created_at;
      });
      return map;
    },
  });

  const save = useMutation({
    mutationFn: async (c: ClientInsert) => {
      if (editId) {
        const { error } = await supabase.from("clients").update(c).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(c);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setForm(emptyClient);
      setEditId(null);
      toast.success(editId ? "Cliente atualizado!" : "Cliente cadastrado!");
    },
    onError: () => toast.error("Erro ao salvar cliente"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente removido! Histórico de vendas mantido.");
    },
    onError: () => toast.error("Erro ao remover cliente."),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active, reason }: { id: string; active: boolean; reason?: string }) => {
      const { error } = await supabase.from("clients").update({
        active,
        inactive_reason: active ? null : reason || null,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(vars.active ? "Cliente reativado!" : "Cliente inativado!");
      setInactiveDialog(null);
      setInactiveReason("");
    },
    onError: () => toast.error("Erro ao alterar status do cliente."),
  });

  const activeClients = useMemo(() => clients.filter((c: any) => c.active !== false), [clients]);
  const inactiveClients = useMemo(() => clients.filter((c: any) => c.active === false), [clients]);

  const filterAndSort = (list: any[]) => {
    const filtered = list.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.cpf_cnpj || "").includes(search)
    );
    if (sortBy === "opening_date") {
      return [...filtered].sort((a, b) => {
        const da = a.opening_date || "";
        const db = b.opening_date || "";
        return da < db ? -1 : da > db ? 1 : 0;
      });
    }
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  };

  const filteredActive = useMemo(() => filterAndSort(activeClients), [activeClients, search, sortBy]);
  const filteredInactive = useMemo(() => filterAndSort(inactiveClients), [inactiveClients, search, sortBy]);

  const openEdit = (c: any) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      cpf_cnpj: c.cpf_cnpj || "",
      contact: c.contact || "",
      whatsapp: c.whatsapp || "",
      address_street: c.address_street || "",
      address_number: c.address_number || "",
      address_neighborhood: c.address_neighborhood || "",
      address_city: c.address_city || "",
      address_state: c.address_state || "",
      address_zip: c.address_zip || "",
      payment_type: c.payment_type || "avulso",
      opening_date: c.opening_date || new Date().toISOString().slice(0, 10),
      default_price_table: (c as any).default_price_table || "",
      billing_method: c.billing_method || "pix",
      business_hours: c.business_hours || "",
    });
    setOpen(true);
  };

  const exportToPDF = () => {
    const list = tab === "active" ? filteredActive : filteredInactive;
    if (list.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const doc = new jsPDF();
    const title = `Relatório de Clientes - ${tab === "active" ? "Ativos" : "Inativos"}`;
    const dateStr = format(new Date(), "dd/MM/yyyy HH:mm");

    // Add Logo
    const img = new Image();
    img.src = logoGeloPlus;
    
    // Header
    doc.addImage(img, 'JPEG', 14, 10, 20, 20);
    
    doc.setFontSize(18);
    doc.text(title, 40, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${dateStr}`, 40, 30);

    const tableRows = list.map((c) => [
      c.name || "—",
      [
        c.address_street,
        c.address_number,
        c.address_neighborhood,
        c.address_city,
        c.address_state,
      ].filter(Boolean).join(", ") || "—",
      c.contact || "—",
      c.whatsapp || "—",
      c.opening_date ? format(new Date(c.opening_date + "T12:00:00"), "dd/MM/yyyy") : "—",
    ]);

    autoTable(doc, {
      head: [["Nome", "Endereço Completo", "Contato", "WhatsApp", "Abertura"]],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`clientes_${tab}_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
  };

  const renderField = (label: string, field: string) => (
    <div className="space-y-1" key={field}>
      <Label className="text-xs">{label}</Label>
      <Input
        value={(form as any)[field] || ""}
        onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
      />
    </div>
  );

  const renderTable = (list: any[], isInactive = false) => (
    <CardWrapper>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Cobrança</TableHead>
            <TableHead>Abertura</TableHead>
            {!isInactive && <TableHead>Última Compra</TableHead>}
            {isInactive && <TableHead>Motivo</TableHead>}
            <TableHead className="w-28">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((c) => {
            const lastDate = lastSales[c.id];
            const daysSince = lastDate ? differenceInDays(new Date(), new Date(lastDate)) : null;
            const isStale = daysSince !== null && daysSince >= 21;
            return (
            <TableRow key={c.id} className={isStale && !isInactive ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
              <TableCell className="font-medium">
                {isStale && !isInactive && <span title={`${daysSince} dias sem comprar`} className="mr-1">⚠️</span>}
                {c.name}
              </TableCell>
              <TableCell>{c.cpf_cnpj || "—"}</TableCell>
              <TableCell>{c.contact || "—"}</TableCell>
              <TableCell>{c.whatsapp || "—"}</TableCell>
              <TableCell><Badge variant="outline">{PAYMENT_LABELS[c.payment_type] || "Avulso"}</Badge></TableCell>
              <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{c.billing_method || "Pix"}</Badge></TableCell>
              <TableCell>{c.opening_date ? format(new Date(c.opening_date + "T12:00:00"), "dd/MM/yyyy") : "—"}</TableCell>
              {!isInactive && (
                <TableCell className={isStale ? "text-amber-600 font-medium" : ""}>
                  {lastDate ? `${format(new Date(lastDate), "dd/MM/yyyy")} (${daysSince}d)` : "Nunca"}
                </TableCell>
              )}
              {isInactive && <TableCell className="text-sm text-muted-foreground max-w-[300px] whitespace-normal break-words">{c.inactive_reason || "—"}</TableCell>}
              <TableCell>
                <div className="flex gap-1">
                  {isInactive ? (
                    <Button variant="ghost" size="icon" title="Reativar" onClick={() => toggleActive.mutate({ id: c.id, active: true })}>
                      <UserCheck className="h-4 w-4 text-green-600" />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" title="Inativar" onClick={() => { setInactiveDialog({ id: c.id, name: c.name }); setInactiveReason(""); }}>
                      <UserX className="h-4 w-4 text-orange-500" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (window.confirm(`Deseja realmente excluir o cliente "${c.name}"?`)) remove.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
            );
          })}
          {list.length === 0 && (
            <TableRow><TableCell colSpan={isInactive ? 9 : 9} className="text-center text-muted-foreground py-8">Nenhum cliente encontrado</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </CardWrapper>
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToPDF}>
            <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(emptyClient); setEditId(null); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editId ? "Editar" : "Novo"} Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(form as any); }} className="space-y-3">
              {renderField("Nome *", "name")}
              <div className="grid grid-cols-2 gap-3">
                {renderField("CNPJ", "cpf_cnpj")}
                {renderField("Contato", "contact")}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {renderField("WhatsApp", "whatsapp")}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">{renderField("Rua", "address_street")}</div>
                {renderField("Nº", "address_number")}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {renderField("Bairro", "address_neighborhood")}
                {renderField("Cidade", "address_city")}
                {renderField("Estado", "address_state")}
              </div>
              {renderField("Horário de Funcionamento", "business_hours")}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de Pagamento</Label>
                  <Select value={form.payment_type} onValueChange={(v) => setForm((prev) => ({ ...prev, payment_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avulso">Avulso</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tabela Padrão</Label>
                  <Select value={form.default_price_table || "__none__"} onValueChange={(v) => setForm((prev) => ({ ...prev, default_price_table: v === "__none__" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma (manual)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {priceTables.map((pt: any) => (
                        <SelectItem key={pt.id} value={pt.name}>
                          {pt.name} — R$ {Number(pt.price).toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Forma de Cobrança</Label>
                  <Select value={form.billing_method} onValueChange={(v) => setForm((prev) => ({ ...prev, billing_method: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="boleto">BOLETO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data de Abertura</Label>
                  <Input
                    type="date"
                    value={form.opening_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, opening_date: e.target.value }))}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={!form.name || save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Ordem Alfabética</SelectItem>
            <SelectItem value="opening_date">Data de Abertura</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="active">Ativos ({activeClients.length})</TabsTrigger>
          <TabsTrigger value="inactive">Inativos ({inactiveClients.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="mt-4">
          {renderTable(filteredActive)}
        </TabsContent>
        <TabsContent value="inactive" className="mt-4">
          {renderTable(filteredInactive, true)}
        </TabsContent>
      </Tabs>

      {/* Dialog de inativação */}
      <Dialog open={!!inactiveDialog} onOpenChange={(o) => { if (!o) { setInactiveDialog(null); setInactiveReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Inativar Cliente</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Deseja inativar <strong>{inactiveDialog?.name}</strong>?
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Motivo da inativação</Label>
            <Textarea
              placeholder="Ex: Cliente mudou de cidade, não compra mais..."
              value={inactiveReason}
              onChange={(e) => setInactiveReason(e.target.value)}
              rows={3}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => inactiveDialog && toggleActive.mutate({ id: inactiveDialog.id, active: false, reason: inactiveReason })}
            disabled={toggleActive.isPending}
          >
            {toggleActive.isPending ? "Salvando..." : "Confirmar Inativação"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CardWrapper({ children }: { children: React.ReactNode }) {
  return <div className="border rounded-lg bg-card overflow-hidden">{children}</div>;
}
