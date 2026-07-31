
CREATE TABLE public.stock_losses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  loss_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage stock_losses"
ON public.stock_losses
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
