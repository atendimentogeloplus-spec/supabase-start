import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, KanbanSquare, LayoutDashboard, List, LogOut, Settings, Users } from "lucide-react";

const NAV = [
  { to: "/", label: "Kanban", icon: KanbanSquare, adminOnly: false },
  { to: "/leads", label: "Leads", icon: List, adminOnly: false },
  { to: "/painel", label: "Painel", icon: LayoutDashboard, adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
  { to: "/avisos", label: "Avisos", icon: Bell, adminOnly: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, session, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", session?.user?.id],
    enabled: !!session,
    refetchInterval: 30000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session!.user.id)
        .eq("is_read", false);
      return count ?? 0;
    },
  });

  if (loading || !session) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  if (profile && profile.status !== "active") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Aguardando aprovação</h1>
          <p className="text-muted-foreground">
            Seu cadastro foi recebido. Um administrador precisa liberar o seu acesso antes de você usar o sistema.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <span className="text-lg font-bold tracking-tight">LeadTrack</span>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors ${
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                  {item.to === "/avisos" && unread > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unread}</span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground md:inline">{profile?.name}</span>
            <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4">{children}</main>
    </div>
  );
}
