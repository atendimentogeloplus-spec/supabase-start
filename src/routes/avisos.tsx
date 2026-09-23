import { fetchAll } from "@/lib/paginate";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDateTime } from "@/lib/leadtrack";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { enablePush } from "@/lib/push";

export const Route = createFileRoute("/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos | LeadTrack" },
      { name: "description", content: "Notificações sobre leads parados, novos cadastros e mudanças no funil." },
      { property: "og:title", content: "Avisos | LeadTrack" },
      { property: "og:description", content: "Notificações sobre leads parados, novos cadastros e mudanças no funil." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <AvisosPage />
    </AppShell>
  ),
});

function AvisosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await fetchAll((f, t) => supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false }).range(f, t));
      if (error) throw error;
      return data as { id: string; title: string; body: string | null; is_read: boolean; created_at: string }[];
    },
  });

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false);
    void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    void qc.invalidateQueries({ queryKey: ["unread", user?.id] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Avisos</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() =>
              enablePush(user!.id)
                .then(() => toast.success("Notificações ativadas neste aparelho."))
                .catch((e: Error) => toast.error(e.message))
            }
          >
            <Bell className="mr-1 h-4 w-4" /> Ativar notificações
          </Button>
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            Marcar tudo como lido
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className={`rounded-lg border p-3 ${n.is_read ? "opacity-60" : "bg-card"}`}>
            <div className="flex justify-between gap-3">
              <span className="font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
            </div>
            {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
          </div>
        ))}
        {items.length === 0 && <p className="text-muted-foreground">Nenhum aviso por enquanto.</p>}
      </div>
    </div>
  );
}
