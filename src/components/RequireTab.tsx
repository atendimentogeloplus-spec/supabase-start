import type { ReactNode } from "react";

export function RequireTab({ children }: { tab?: string; children: ReactNode }) {
  return <>{children}</>;
}
