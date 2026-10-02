import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Archive, Bell, Building2, History, FileText, KanbanSquare, LayoutDashboard, List, LogOut, MoreHorizontal, Boxes, Settings, Trash2, Users } from "lucide-react";
import kraftLogo from "@/assets/kraft-logo.png.asset.json";

const NAV = [
  { to: "/", label: "Kanban", icon: KanbanSquare, adminOnly: false },
  { to: "/leads", label: "Leads", icon: List, adminOnly: false },
  { to: "/clientes", label: "Clientes", icon: Building2, adminOnly: false },
  { to: "/carteira", label: "Carteira geral", icon: Archive, adminOnly: false },
  { to: "/relatorios", label: "Relatórios", icon: FileText, adminOnly: false },
  { to: "/painel", label: "Painel", icon: LayoutDashboard, adminOnly: true },
  { to: "/usuarios", label: "Usuários", icon: Users, adminOnly: true },
  { to: "/historico", label: "Histórico", icon: History, adminOnly: true },
  { to: "/lixeira", label: "Lixeira", icon: Trash2, adminOnly: true },
  { to: "/configuracoes", label: "Configurações", icon: Settings, adminOnly: true },
  { to: "/avisos", label: "Avisos", icon: Bell, adminOnly: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { loading, session, profile, isAdmin, isStockist, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!loading && !session) void navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (isStockist && !pathname.startsWith("/estoque")) void navigate({ to: "/estoque" });
  }, [isStockist, pathname, navigate]);

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

  const isActive = (to: string) => pathname === to || (to !== "/" && pathname.startsWith(to));
  const primary = inStock ? [] : items.filter((i) => ["/", "/leads", "/clientes"].includes(i.to));
  const more = inStock ? [] : items.filter((i) => !["/", "/leads", "/clientes", "/avisos"].includes(i.to));
  const current = inStock ? "Estoque" : NAV.find((i) => isActive(i.to))?.label ?? "";

  return (
    <div className="flex min-h-screen bg-background">
      {/* ===== Celular: barra superior ===== */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar/95 px-3 backdrop-blur md:hidden">
        <img src={kraftLogo.url} alt="Kraft Clean" className="h-9 w-auto shrink-0 object-contain" />
        <span className="min-w-0 flex-1 truncate text-base font-semibold">{current}</span>
        <Link to="/avisos" aria-label="Avisos" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground active:bg-accent">
          <Bell className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-4 text-destructive-foreground">{unread}</span>}
        </Link>
      </header>

      {/* ===== Celular: barra inferior de navegação ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {inStock ? (
          <>
            {!isStockist && <MobileTab to="/" label="Leads" icon={KanbanSquare} active={false} />}
            <MobileTab to="/estoque" label="Estoque" icon={Boxes} active />
          </>
        ) : (
          primary.map((i) => <MobileTab key={i.to} to={i.to} label={i.label} icon={i.icon} active={isActive(i.to)} />)
        )}
        <button type="button" onClick={() => setOpen(true)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${more.some((i) => isActive(i.to)) ? "text-primary" : "text-muted-foreground"}`}>
          <MoreHorizontal className="h-5 w-5" />Mais
        </button>
      </nav>

      {/* ===== Celular: painel "Mais" ===== */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
            {!isStockist && (
              <div className="mb-4 flex rounded-lg bg-muted p-1 text-sm">
                <Link to="/" className={`flex-1 rounded-md py-2 text-center ${!inStock ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>Leads</Link>
                <Link to="/estoque" className={`flex-1 rounded-md py-2 text-center ${inStock ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>Estoque</Link>
              </div>
            )}
            {more.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {more.map((i) => (
                  <Link key={i.to} to={i.to} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs ${isActive(i.to) ? "border-primary bg-primary/10 text-primary" : "text-foreground"}`}>
                    <i.icon className="h-5 w-5" />{i.label}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="min-w-0 truncate text-sm text-muted-foreground">{profile?.name}</span>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Computador: menu lateral (inalterado) ===== */}
      <aside className="sticky top-0 z-40 hidden h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-3 py-4">
          <img src={kraftLogo.url} alt="Kraft Clean" className="h-16 w-full min-w-0 object-contain" />
        </div>
        {!isStockist && (
          <div className="mx-2 mb-3 flex flex-row rounded-md border p-0.5 text-sm">
            <Link to="/" className={`flex-1 rounded px-2 py-1 text-center ${!inStock ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Leads
            </Link>
            <Link to="/estoque" className={`flex-1 rounded px-2 py-1 text-center ${inStock ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              Estoque
            </Link>
          </div>
        )}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
          {items.map((item) => (
            <Link key={item.to} to={item.to} title={item.label}
              className={`relative flex items-center justify-start gap-2 rounded-md px-3 py-2 text-sm transition-colors ${isActive(item.to) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.to === "/avisos" && unread > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <span className="truncate text-sm text-muted-foreground">{profile?.name}</span>
          <Button variant="ghost" size="icon" onClick={() => void signOut()} aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-3 pb-24 pt-[4.5rem] md:p-4">{children}</main>
    </div>
  );
}

function MobileTab({ to, label, icon: Icon, active }: { to: string; label: string; icon: typeof Bell; active: boolean }) {
  return (
    <Link to={to} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-primary font-medium" : "text-muted-foreground"}`}>
      <Icon className="h-5 w-5" />{label}
    </Link>
  );
}
