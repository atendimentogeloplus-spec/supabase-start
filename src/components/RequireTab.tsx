import type { ReactNode } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserTabs } from "@/hooks/useUserTabs";
import NotFound from "@/pages/NotFound";

export function RequireTab({ tab, children }: { tab: string; children: ReactNode }) {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { allowed, isLoading } = useUserTabs();

  if (roleLoading || isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!isAdmin && !allowed.has(tab)) {
    return <NotFound />;
  }

  return <>{children}</>;
}
