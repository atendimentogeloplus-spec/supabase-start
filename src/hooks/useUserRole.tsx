import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole = "admin" | "supervisor" | "driver" | "user";

export function useUserRole() {
  const { session } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user-role-full", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);
      const roles = (data || []).map((r: any) => r.role as AppRole);
      if (roles.includes("admin")) return "admin" as AppRole;
      if (roles.includes("supervisor")) return "supervisor" as AppRole;
      if (roles.includes("driver")) return "driver" as AppRole;
      return "user" as AppRole;
    },
    enabled: !!session?.user?.id,
  });

  return {
    role: role ?? null,
    isAdmin: role === "admin",
    isSupervisor: role === "supervisor",
    isDriver: role === "driver",
    isLoading,
  };
}
