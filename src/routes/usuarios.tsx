import { fetchAll } from "@/lib/paginate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS, STATUS_LABELS, formatDateTime, type AppRole, type Profile, type UserStatus } from "@/lib/leadtrack";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
                    <select
                      className="h-8 rounded border bg-background px-2 text-sm"
                      value={role}
                      onChange={(e) => void setRole(p.id, e.target.value as AppRole)}
                    >
                      {Object.entries(ROLE_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">{STATUS_LABELS[p.status]}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      {p.status !== "active" && (
                        <Button size="sm" onClick={() => void setStatus(p.id, "active")}>
                          Aprovar
                        </Button>
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
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
