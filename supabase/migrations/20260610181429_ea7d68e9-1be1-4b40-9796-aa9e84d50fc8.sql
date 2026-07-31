CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_client_id ON public.sales(client_id);
CREATE INDEX IF NOT EXISTS idx_stock_losses_loss_date ON public.stock_losses(loss_date);
CREATE INDEX IF NOT EXISTS idx_stock_losses_product_id ON public.stock_losses(product_id);
ANALYZE public.sales;
ANALYZE public.sale_items;
ANALYZE public.stock_losses;