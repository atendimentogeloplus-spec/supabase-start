import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, Building2, FileText, KanbanSquare, LayoutDashboard, List, LogOut, Menu, Settings, Users } from "lucide-react";

const NAV = [
  { to: "/", label: "Kanban", icon: KanbanSquare, adminOnly: false },
  { to: "/leads", label: "Leads", icon: List, adminOnly: false },
  { to: "/clientes", label: "Clientes", icon: Building2, adminOnly: false },
  { to: "/relatorios", label: "Relatórios", icon: FileText, adminOnly: false },
  { to: "/painel", label: "Painel", icon: LayoutDashboard, adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
  { to: "/avisos", label: "Avisos", icon: Bell, adminOnly: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, session, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const lbl = open ? "inline" : "hidden md:inline";

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

  const inStock = pathname.startsWith("/estoque");
  const items = inStock ? [] : NAV.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-14 shrink-0 md:hidden" />
      {open && <div className="fixed inset-0 z-30 bg-foreground/30 md:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:w-56 ${open ? "w-56" : "w-14"}`}>
        <div className="flex items-center gap-2 px-2 py-3 md:px-3 md:py-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </Button>
          <img src="/icon-192.png" alt="Kraft Clean" className={`${lbl} h-10 w-10 rounded-md object-cover`} />
          <span className={`${lbl} font-serif text-xl font-semibold tracking-widest`}>KRAFT</span>
        </div>
        {isAdmin && (
          <div className={`mx-2 mb-3 flex ${open ? "flex-row text-sm" : "flex-col"} rounded-md border p-0.5 text-xs md:flex-row md:text-sm`}>
            <Link to="/" className={`flex-1 rounded px-2 py-1 text-center ${!inStock ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Leads
            </Link>
            <Link to="/estoque" className={`flex-1 rounded px-2 py-1 text-center ${inStock ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Estoque
            </Link>
          </div>
        )}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {items.map((item) => {
            const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={`relative flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors md:justify-start ${open ? "justify-start" : ""} ${
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className={lbl}>{item.label}</span>
                {item.to === "/avisos" && unread > 0 && (
                  <span className="absolute right-1 top-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground md:static md:ml-auto">{unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className={`flex items-center justify-center gap-2 border-t p-2 md:justify-between ${open ? "justify-between" : ""}`}>
          <span className={`${lbl} truncate text-sm text-muted-foreground`}>{profile?.name}</span>
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4">{children}</main>
    </div>
  );
}
