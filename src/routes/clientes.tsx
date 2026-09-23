import { fetchAll } from "@/lib/paginate";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLeadTrackBase } from "@/lib/leadtrack-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes | LeadTrack" },
      { name: "description", content: "Cadastro de clientes com contato, documento e endereço." },
      { property: "og:title", content: "Clientes | LeadTrack" },
      { property: "og:description", content: "Cadastro de clientes com contato, documento e endereço." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <ClientesPage />
    </AppShell>
  ),
});

type Client = {
  id: string;
  name: string;
  document: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  owner_id: string | null;
};

const EMPTY = { name: "", document: "", contact_name: "", phone: "", email: "", address: "", city: "", notes: "", owner_id: "" };
type Form = typeof EMPTY;

const FIELDS: { key: keyof Form; label: string }[] = [
  { key: "name", label: "Nome / Razão social *" },
  { key: "document", label: "CNPJ / CPF" },
  { key: "contact_name", label: "Contato" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "city", label: "Cidade" },
  { key: "address", label: "Endereço" },
];

function ClientesPage() {
  const qc = useQueryClient();
  const { session, isAdmin } = useAuth();
  const { profiles } = useLeadTrackBase();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("clients" as never).select("*").order("name").range(f, t));
      if (error) throw error;
      return data as unknown as Client[];
    },
  });

  const q = search.trim().toLowerCase();
  const list = clients.filter((c) =>
    !q || [c.name, c.document, c.contact_name, c.city, c.phone].some((v) => v?.toLowerCase().includes(q)),
  );

  function open(c?: Client) {
    if (c) {
      const rec = c as unknown as Record<string, string | null>;
      setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, rec[k] ?? ""])) as unknown as Form);
      setEditing(c.id);
    } else {
      setForm({ ...EMPTY, owner_id: session?.user.id ?? "" });
      setEditing("new");
    }
  }

  async function save() {
    if (!form.name.trim()) return toast.error("Informe o nome do cliente.");
    const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]));
    const table = supabase.from("clients" as never);
    const { error } =
      editing === "new" ? await table.insert(payload as never) : await table.update(payload as never).eq("id", editing!);
    if (error) return toast.error(error.message);
    toast.success("Cliente salvo.");
    setEditing(null);
    void qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clients" as never).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setEditing(null);
    void qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Input className="ml-auto max-w-xs" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={() => open()}>Novo cliente</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-2">Nome</th>
              <th className="p-2">CNPJ/CPF</th>
              <th className="p-2">Contato</th>
              <th className="p-2">Telefone</th>
              <th className="p-2">Cidade</th>
              <th className="p-2">Responsável</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t hover:bg-accent/50" onClick={() => open(c)}>
                <td className="p-2 font-medium">{c.name}</td>
                <td className="p-2">{c.document ?? "—"}</td>
                <td className="p-2">{c.contact_name ?? "—"}</td>
                <td className="p-2">{c.phone ?? "—"}</td>
                <td className="p-2">{c.city ?? "—"}</td>
                <td className="p-2">{profiles.find((p) => p.id === c.owner_id)?.name ?? "—"}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum cliente.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Novo cliente" : "Editar cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.key === "name" || f.key === "address" ? "sm:col-span-2" : ""}>
                <Label>{f.label}</Label>
                <Input value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
              </div>
            ))}
            {isAdmin && (
              <div className="sm:col-span-2">
                <Label>Responsável</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.owner_id}
                  onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                >
                  <option value="">Sem responsável</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            {isAdmin && editing !== "new" ? (
              <Button variant="destructive" onClick={() => void remove(editing!)}>Excluir</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={() => void save()}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
