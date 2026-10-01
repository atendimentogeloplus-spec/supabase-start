ALTER TABLE public.interactions DROP CONSTRAINT interactions_lead_id_fkey,
  ADD CONSTRAINT interactions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.lead_audit DROP CONSTRAINT lead_audit_lead_id_fkey,
  ADD CONSTRAINT lead_audit_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.notifications DROP CONSTRAINT notifications_lead_id_fkey,
  ADD CONSTRAINT notifications_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
ALTER TABLE public.clients DROP CONSTRAINT clients_lead_id_fkey,
  ADD CONSTRAINT clients_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;