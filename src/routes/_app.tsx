import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppGate,
});

function AppGate() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
