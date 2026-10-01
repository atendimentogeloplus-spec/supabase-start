ALTER TABLE public.stock_movements DROP CONSTRAINT stock_movements_client_id_fkey,
  ADD CONSTRAINT stock_movements_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.stock_minimums DROP CONSTRAINT stock_minimums_client_id_fkey,
  ADD CONSTRAINT stock_minimums_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.client_forecasts DROP CONSTRAINT client_forecasts_client_id_fkey,
  ADD CONSTRAINT client_forecasts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.purchase_orders DROP CONSTRAINT purchase_orders_client_id_fkey,
  ADD CONSTRAINT purchase_orders_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.leads DROP CONSTRAINT leads_client_id_fkey,
  ADD CONSTRAINT leads_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;