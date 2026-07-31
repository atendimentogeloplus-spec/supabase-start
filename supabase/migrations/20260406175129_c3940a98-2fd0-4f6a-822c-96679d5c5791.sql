ALTER TABLE public.clients ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE public.clients ADD COLUMN inactive_reason text;