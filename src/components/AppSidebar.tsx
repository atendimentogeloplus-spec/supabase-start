import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Warehouse,
  ShoppingCart,
  ClipboardList,
  FileText,
  LogOut,
  Shield,
  Tag,
  Truck,
  MapPin,
  Menu,
  X,
  ArrowRightLeft,
  UserPlus,
  Snowflake,
  Wallet,
  Car,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserTabs } from "@/hooks/useUserTabs";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import logoGeloPlus from "@/assets/logo-geloplus.jpg";

const navItems = [
  { to: "/dashboard", key: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/clients", key: "clients", icon: Users, label: "Clientes" },
  { to: "/products", key: "products", icon: Package, label: "Produtos" },
  { to: "/price-tables", key: "price-tables", icon: Tag, label: "Tabelas de Preço" },
  { to: "/stock", key: "stock", icon: Warehouse, label: "Estoque" },
  { to: "/sales", key: "sales", icon: ShoppingCart, label: "Vendas" },
  { to: "/orders", key: "orders", icon: ClipboardList, label: "Pedidos" },
  { to: "/routes", key: "routes", icon: MapPin, label: "Rotas" },
  { to: "/drivers", key: "drivers", icon: Truck, label: "Motoristas" },
  { to: "/reports", key: "reports", icon: FileText, label: "Relatórios" },
  { to: "/cash-flow", key: "cash-flow", icon: ArrowRightLeft, label: "Fluxo" },
  { to: "/leads", key: "leads", icon: UserPlus, label: "Leads" },
  { to: "/week-plan", key: "week-plan", icon: CalendarDays, label: "Plano da Semana" },
  { to: "/fleet", key: "fleet", icon: Car, label: "Frota" },
  { to: "/freezers", key: "freezers", icon: Snowflake, label: "Freezers" },
  { to: "/financeiro", key: "financeiro", icon: Wallet, label: "Financeiro" },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const { allowed } = useUserTabs();

  const filtered = isAdmin
    ? navItems
    : navItems.filter((i) => allowed.has(i.key));
  const allItems = isAdmin
    ? [...filtered, { to: "/admin", key: "admin", icon: Shield, label: "Admin" }]
    : filtered;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoGeloPlus} alt="Gelo Plus" className="h-10 w-10 object-contain rounded" />
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground tracking-tight">
              Gelo Plus
            </h1>
            <p className="text-xs text-sidebar-foreground/60">Gestão simplificada</p>
          </div>
        </div>
      </div>
      <nav className="min-h-0 flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
        {allItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-3" /> Sair
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <header className="no-print fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-sidebar">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-sidebar-foreground">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="h-[100dvh] max-h-[100dvh] overflow-hidden p-0 w-64 bg-sidebar border-sidebar-border">
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={logoGeloPlus} alt="Gelo Plus" className="h-8 w-8 object-contain rounded" />
            <span className="text-sm font-bold text-sidebar-foreground">Gelo Plus</span>
          </div>
        </header>
        {/* Spacer for fixed header */}
        <div className="h-14" />
      </>
    );
  }

  return (
    <aside className="no-print w-64 min-h-screen bg-sidebar flex flex-col">
      <SidebarContent />
    </aside>
  );
}
