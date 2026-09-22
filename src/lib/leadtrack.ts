export type UserStatus = "pending" | "active" | "rejected" | "disabled";
export type AppRole = "admin" | "rep_internal" | "rep_external";

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: UserStatus;
  approved_at: string | null;
  created_at: string;
};

export type KanbanColumn = {
  id: string;
  key: string;
  label: string;
  position: number;
  color: string;
  min_interactions: number;
  requires_loss: boolean;
  is_won: boolean;
  is_lost: boolean;
};

export type Source = { id: string; name: string; active: boolean };

export type Lead = {
  id: string;
  contact_name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  source_id: string | null;
  owner_id: string | null;
  status: string;
  estimated_value: number | null;
  notes: string | null;
  loss_reason: string | null;
  created_by: string | null;
  last_interaction_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Interaction = {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: InteractionType;
  summary: string;
  created_at: string;
};

export type InteractionType = "call" | "whatsapp" | "email" | "meeting" | "visit" | "other";

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  call: "Ligação",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  visit: "Visita",
  other: "Outro",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  rep_internal: "Representante interno",
  rep_external: "Representante externo",
};

export const STATUS_LABELS: Record<UserStatus, string> = {
  pending: "Aguardando aprovação",
  active: "Ativo",
  rejected: "Recusado",
  disabled: "Desativado",
};

export function daysSince(date: string | null): number {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

export function heatClass(days: number, stalledDays: number): string {
  if (days >= stalledDays) return "bg-destructive";
  if (days >= Math.max(1, Math.round(stalledDays / 2))) return "bg-amber-500";
  return "bg-emerald-500";
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Converte telefone em formato E.164 sem símbolos (assume Brasil quando faltar DDI). */
export function toWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

/** Link wa.me que abre o app ou o WhatsApp Web com o aviso do novo lead. */
export function whatsappLeadLink(lead: Lead, ownerPhone: string | null | undefined): string | null {
  const number = toWhatsappNumber(ownerPhone);
  if (!number) return null;
  const lines = [
    "Novo lead para você!",
    `Contato: ${lead.contact_name}`,
    lead.company ? `Empresa: ${lead.company}` : null,
    lead.phone ? `Telefone: ${lead.phone}` : null,
    lead.email ? `E-mail: ${lead.email}` : null,
    lead.estimated_value != null ? `Valor estimado: ${formatCurrency(lead.estimated_value)}` : null,
    lead.notes ? `Observações: ${lead.notes}` : null,
  ].filter(Boolean);
  return `https://wa.me/${number}?text=${encodeURIComponent(lines.join("\n"))}`;
}

/** Regras de movimentação de etapa aplicadas antes de salvar. */
export function validateMove(
  column: KanbanColumn,
  interactionCount: number,
  lossReason: string | null,
): string | null {
  if (interactionCount < column.min_interactions) {
    return `Registre ao menos ${column.min_interactions} interação antes de mover para "${column.label}".`;
  }
  if (column.requires_loss && !lossReason?.trim()) {
    return "Informe o motivo da perda.";
  }
  return null;
}
