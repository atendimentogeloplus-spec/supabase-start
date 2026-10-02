import { fetchAll } from "@/lib/paginate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, STATUS_LABELS, formatDateTime, type AppRole, type Profile, type UserStatus } from "@/lib/leadtrack";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { adminUpdateUser } from "@/lib/users.functions";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários | LeadTrack" },
      { name: "description", content: "Aprove cadastros, defina papéis e controle o acesso da equipe comercial." },
      { property: "og:title", content: "Usuários | LeadTrack" },
      { property: "og:description", content: "Aprove cadastros, defina papéis e controle o acesso da equipe comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <UsuariosPage />
    </AppShell>
  ),
});

function UsuariosPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const updateUser = useServerFn(adminUpdateUser);
  const [edit, setEdit] = useState<{ id: string; name: string; email: string; phone: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("profiles").select("*").order("created_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase.from("user_roles").select("user_id,role").range(f, t));
      if (error) throw error;
      return data as { user_id: string; role: AppRole }[];
    },
  });

  if (!isAdmin) return <p className="text-muted-foreground">Apenas administradores acessam esta página.</p>;

  async function saveEdit() {
    if (!edit) return;
    if (!edit.name.trim() || !edit.email.trim()) return toast.error("Informe nome e e-mail.");
    setSaving(true);
    try {
      await updateUser({ data: { ...edit, phone: edit.phone.trim() || null } });
      toast.success("Usuário atualizado.");
      setEdit(null);
      void qc.invalidateQueries({ queryKey: ["profiles"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: UserStatus) {
    const { error } = await supabase
      .from("profiles")
      .update({ status, approved_at: status === "active" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Status atualizado.");
    void qc.invalidateQueries({ queryKey: ["profiles"] });
  }

  async function approve(id: string, role: AppRole) {
    await setRole(id, role);
    await setStatus(id, "active");
  }

  async function setRole(id: string, role: AppRole) {
    await supabase.from("user_roles").delete().eq("user_id", id);
    const { error } = await supabase.from("user_roles").insert({ user_id: id, role });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Papel atualizado.");
    void qc.invalidateQueries({ queryKey: ["user_roles"] });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Usuários</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Cadastro</th>
              <th className="p-3">Papel</th>
              <th className="p-3">Situação</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const role = roles.find((r) => r.user_id === p.id)?.role ?? "rep_internal";
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.email}</td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(p.created_at)}</td>
                  <td className="p-3">
                    {p.email?.toLowerCase() === "renato.c2eventos@gmail.com" ? <span className="rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Desenvolvedor (protegido)</span> : <select
                      className="h-8 rounded border bg-background px-2 text-sm"
                      value={role}
                      onChange={(e) => void setRole(p.id, e.target.value as AppRole)}
                    >
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>}
                  </td>
                  <td className="p-3">{STATUS_LABELS[p.status]}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: p.id, name: p.name, email: p.email, phone: p.phone ?? "" })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    {p.email?.toLowerCase() !== "renato.c2eventos@gmail.com" && <>
                      {p.status !== "active" && (
                        <>
                          <Button size="sm" onClick={() => void approve(p.id, "rep_external")}>
                            Aprovar como representante
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => void approve(p.id, "stockist")}>
                            Aprovar como estoquista
                          </Button>
                        </>
                      )}
                      {p.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => void setStatus(p.id, "rejected")}>
                          Recusar
                        </Button>
                      )}
                      {p.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => void setStatus(p.id, "disabled")}>
                          Desativar
                        </Button>
                      )}
                    </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar usuário</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
              <div><Label>E-mail (usado para entrar)</Label><Input type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
                <Button disabled={saving} onClick={() => void saveEdit()}>{saving ? "Salvando…" : "Salvar"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
