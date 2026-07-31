import { useUserRole } from "./useUserRole";

export function useAdmin() {
  const { isAdmin, isLoading } = useUserRole();
  return { isAdmin, isLoading };
}
