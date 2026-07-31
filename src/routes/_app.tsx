import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import PendingApproval from "@/pages/PendingApproval";

export const Route = createFileRoute("/_app")({
  component: AppGate,
});

function AppGate() {
  const { session, loading } = useAuth();

  const { data: isApproved, isLoading: approvalLoading } = useQuery({
    queryKey: ["user-approval", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return false;
      const { data } = await supabase
        .from("user_approvals")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();
      return (data as { status?: string } | null)?.status === "approved";
    },
    enabled: !!session?.user?.id,
  });

  if (loading || (session && approvalLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!isApproved) {
    return <PendingApproval />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
