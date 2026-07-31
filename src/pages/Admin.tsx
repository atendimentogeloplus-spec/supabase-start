import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, CheckCircle, XCircle, Download, Lock, Truck, Settings2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { downloadBackup } from "@/lib/backup";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ALL_TABS } from "@/hooks/useUserTabs";

const ADMIN_PIN = "1856";

type AppRole = "admin" | "supervisor" | "driver" | "user";

const DEV_EMAIL = "atendimentogeloplus@gmail.com";

export default function Admin() {
  const qc = useQueryClient();
  const [backingUp, setBackingUp] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      await downloadBackup();
      toast.success("Backup baixado com sucesso!");
    } catch {
      toast.error("Erro ao gerar backup");
    } finally {
      setBackingUp(false);
    }
  };

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["user-approvals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_approvals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all user roles to display next to each approval
  const { data: rolesByUser = new Map<string, AppRole>() } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, AppRole>();
      for (const r of data || []) {
        const role = (r as any).role as AppRole;
        const uid = (r as any).user_id as string;
        // admin > supervisor > driver > user
        const existing = map.get(uid);
        const rank = (r: AppRole) => r === "admin" ? 3 : r === "supervisor" ? 2 : r === "driver" ? 1 : 0;
        if (!existing || rank(role) > rank(existing)) {
          map.set(uid, role);
        }
      }
      return map;
    },
  });

  const setUserRole = async (userId: string, role: AppRole) => {
    // Remove existing roles for this user, then insert new (unless 'user' which means none)
    await supabase.from("user_roles").delete().eq("user_id", userId);
    if (role !== "user") {
      await supabase.from("user_roles").insert({ user_id: userId, role });
    }
  };

  const approveMutation = useMutation({
    mutationFn: async ({ id, userId, role }: { id: string; userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_approvals")
        .update({ status: "approved" })
        .eq("id", id);
      if (error) throw error;
      await setUserRole(userId, role);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-approvals"] });
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success("Usuário aprovado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from("user_approvals")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("user_roles").delete().eq("user_id", userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-approvals"] });
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success("Acesso revogado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      await setUserRole(userId, role);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-user-roles"] });
      toast.success("Perfil atualizado!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Aprovado</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const roleBadge = (role: AppRole) => {
    if (role === "admin") return <Badge className="bg-primary text-primary-foreground"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
    if (role === "supervisor") return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><UserCog className="h-3 w-3 mr-1" />Supervisor</Badge>;
    if (role === "driver") return <Badge variant="outline"><Truck className="h-3 w-3 mr-1" />Motorista</Badge>;
    return <Badge variant="secondary">Usuário</Badge>;
  };

  const handlePinComplete = (value: string) => {
    if (value === ADMIN_PIN) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
      toast.error("Senha incorreta");
    }
  };

  // Local state for selected role per pending row
  const [pendingRole, setPendingRole] = useState<Record<string, AppRole>>({});

  // Permissões por aba
  const [permsUserId, setPermsUserId] = useState<string | null>(null);
  const [permsEmail, setPermsEmail] = useState<string>("");

  const { data: userTabs = new Set<string>(), isLoading: tabsLoading } = useQuery({
    queryKey: ["user-tabs", permsUserId],
    queryFn: async () => {
      if (!permsUserId) return new Set<string>();
      const { data } = await supabase
        .from("user_tab_permissions")
        .select("tab")
        .eq("user_id", permsUserId);
      return new Set((data || []).map((r: any) => r.tab as string));
    },
    enabled: !!permsUserId,
  });

  const toggleTabMutation = useMutation({
    mutationFn: async ({ userId, tab, enable }: { userId: string; tab: string; enable: boolean }) => {
      if (enable) {
        await supabase.from("user_tab_permissions").insert({ user_id: userId, tab });
      } else {
        await supabase.from("user_tab_permissions").delete().eq("user_id", userId).eq("tab", tab);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-tabs", permsUserId] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!unlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="h-10 w-10 mx-auto text-primary mb-2" />
            <CardTitle>Painel Admin</CardTitle>
            <p className="text-sm text-muted-foreground">Digite a senha de 4 dígitos</p>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <InputOTP
              maxLength={4}
              value={pin}
              onChange={(v) => { setPin(v); setPinError(false); }}
              onComplete={handlePinComplete}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
            {pinError && <p className="text-sm text-destructive">Senha incorreta</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
        <div className="ml-auto">
          <Button onClick={handleBackup} disabled={backingUp} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {backingUp ? "Gerando..." : "Backup"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Gerenciar Usuários</CardTitle>
          <p className="text-xs text-muted-foreground">
            Ao aprovar, escolha o perfil: <strong>Admin</strong> tem acesso total, <strong>Supervisor</strong> vê apenas as abas que você liberar (com autonomia total nelas), <strong>Motorista</strong> apenas a página Rotas.
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : approvals.length === 0 ? (
            <p className="text-muted-foreground">Nenhum usuário cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map((u) => {
                  const currentRole = rolesByUser.get(u.user_id) ?? "user";
                  const isPending = u.status !== "approved";
                  const selectedRole = pendingRole[u.id] ?? (currentRole === "user" ? "driver" : currentRole);
                  const isDev = u.email === DEV_EMAIL;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{format(parseISO(u.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                      <TableCell>{statusBadge(u.status)}</TableCell>
                      <TableCell>
                        {isDev ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300">
                            <Shield className="h-3 w-3 mr-1" /> Desenvolvedor
                          </Badge>
                        ) : u.status === "approved" ? (
                          <Select
                            value={currentRole}
                            onValueChange={(v) => changeRoleMutation.mutate({ userId: u.user_id, role: v as AppRole })}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="supervisor">Supervisor</SelectItem>
                              <SelectItem value="driver">Motorista</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          roleBadge(currentRole)
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {isDev ? (
                          <span className="text-xs text-muted-foreground italic">Conta protegida</span>
                        ) : (
                          <>
                        {isPending && (
                          <div className="inline-flex items-center gap-2">
                            <Select
                              value={selectedRole}
                              onValueChange={(v) =>
                                setPendingRole((p) => ({ ...p, [u.id]: v as AppRole }))
                              }
                            >
                              <SelectTrigger className="w-[130px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="supervisor">Supervisor</SelectItem>
                                <SelectItem value="driver">Motorista</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-300 hover:bg-green-50"
                              onClick={() =>
                                approveMutation.mutate({
                                  id: u.id,
                                  userId: u.user_id,
                                  role: selectedRole,
                                })
                              }
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                            </Button>
                          </div>
                        )}
                        {u.status === "approved" && currentRole !== "admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPermsUserId(u.user_id);
                              setPermsEmail(u.email);
                            }}
                          >
                            <Settings2 className="h-4 w-4 mr-1" /> Abas
                          </Button>
                        )}
                        {u.status !== "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => revokeMutation.mutate({ id: u.id, userId: u.user_id })}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Revogar
                          </Button>
                        )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!permsUserId} onOpenChange={(o) => { if (!o) setPermsUserId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Abas visíveis — {permsEmail}</DialogTitle>
          </DialogHeader>
          {tabsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {ALL_TABS.map((t) => {
                const checked = userTabs.has(t.key);
                return (
                  <label key={t.key} className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        if (!permsUserId) return;
                        toggleTabMutation.mutate({ userId: permsUserId, tab: t.key, enable: !!v });
                      }}
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
