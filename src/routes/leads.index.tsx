import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { useAuth } from "@/hooks/useAuth";
import { daysSince, formatCurrency, heatClass, whatsappLeadLink, type Lead } from "@/lib/leadtrack";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/leads/")({
  head: () => ({
    meta: [
      { title: "Leads | LeadTrack" },
      { name: "description", content: "Lista completa de leads com responsável, valor estimado e tempo sem contato." },
      { property: "og:title", content: "Leads | LeadTrack" },
      { property: "og:description", content: "Lista completa de leads com responsável, valor estimado e tempo sem contato." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <LeadsPage />
    </AppShell>
  ),
});

function LeadsPage() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const { columns, profiles, sources, stalledDays } = useLeadTrackBase();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    contact_name: "",
    company: "",
    phone: "",
    email: "",
    source_id: "",
    owner_id: "",
    estimated_value: "",
    notes: "",
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Lead[];
    },
  });

  const filtered = leads.filter((l) => {
    const term = search.trim().toLowerCase();
    const matchesTerm =
      !term ||
      [l.contact_name, l.company, l.phone, l.email].some((v) => v?.toLowerCase().includes(term));
    return matchesTerm && (!statusFilter || l.status === statusFilter);
  });

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    const first = columns[0];
    const { error } = await supabase.from("leads").insert({
      contact_name: form.contact_name.trim(),
      company: form.company.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source_id: form.source_id || null,
      owner_id: form.owner_id || user?.id || null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      notes: form.notes.trim() || null,
      status: first?.key ?? "new",
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lead criado.");
    setOpen(false);
    setForm({ contact_name: "", company: "", phone: "", email: "", source_id: "", owner_id: "", estimated_value: "", notes: "" });
    void qc.invalidateQueries({ queryKey: ["leads"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Leads</h1>
        <Input
          placeholder="Buscar por nome, empresa, telefone…"
          className="w-full sm:w-64"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Todas as etapas</option>
          {columns.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo lead</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo lead</DialogTitle>
            </DialogHeader>
            <form className="space-y-3" onSubmit={createLead}>
              <div className="space-y-1.5">
                <Label htmlFor="contact">Nome do contato</Label>
                <Input
                  id="contact"
                  required
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="company">Empresa</Label>
                  <Input id="company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="value">Valor estimado</Label>
                  <Input
                    id="value"
                    type="number"
                    step="0.01"
                    value={form.estimated_value}
                    onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Origem</Label>
                <select
                  id="source"
                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={form.source_id}
                  onChange={(e) => setForm({ ...form, source_id: e.target.value })}
                >
                  <option value="">Sem origem</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {isAdmin && (
                <div className="space-y-1.5">
                  <Label htmlFor="owner">Responsável</Label>
                  <select
                    id="owner"
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    value={form.owner_id}
                    onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                  >
                    <option value="">Eu mesmo</option>
                    {profiles
                      .filter((p) => p.status === "active")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">
                Salvar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Contato</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Etapa</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Valor</th>
              <th className="p-3">Sem contato</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => {
              const days = daysSince(lead.last_interaction_at ?? lead.updated_at);
              return (
                <tr key={lead.id} className="border-t">
                  <td className="p-3">
                    <Link to="/leads/$leadId" params={{ leadId: lead.id }} className="font-medium hover:underline">
                      {lead.contact_name}
                    </Link>
                  </td>
                  <td className="p-3 text-muted-foreground">{lead.company ?? "—"}</td>
                  <td className="p-3">{columns.find((c) => c.key === lead.status)?.label ?? lead.status}</td>
                  <td className="p-3 text-muted-foreground">
                    {profiles.find((p) => p.id === lead.owner_id)?.name ?? "—"}
                  </td>
                  <td className="p-3">{formatCurrency(lead.estimated_value)}</td>
                  <td className="p-3">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${heatClass(days, stalledDays)}`} />
                      {days}d
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
