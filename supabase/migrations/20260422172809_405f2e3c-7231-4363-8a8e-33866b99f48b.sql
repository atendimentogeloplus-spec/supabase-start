ALTER TABLE public.products ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

-- Set Caixa de Gelo Profissional to inactive
UPDATE public.products SET active = false WHERE name = 'Caixa de Gelo Profissional';
