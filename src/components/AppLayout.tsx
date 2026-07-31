import { AppSidebar } from "./AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <div className={isMobile ? "min-h-screen flex flex-col" : "flex min-h-screen"}>
      <AppSidebar />
      <main className={`flex-1 overflow-auto ${isMobile ? "p-3" : "p-6"}`}>
        {children}
      </main>
    </div>
  );
}
