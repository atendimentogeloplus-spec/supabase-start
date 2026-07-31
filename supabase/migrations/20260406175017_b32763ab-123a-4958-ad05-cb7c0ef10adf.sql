ALTER TABLE public.sales ADD COLUMN client_name text;

UPDATE public.sales s SET client_name = c.name FROM public.clients c WHERE s.client_id = c.id;