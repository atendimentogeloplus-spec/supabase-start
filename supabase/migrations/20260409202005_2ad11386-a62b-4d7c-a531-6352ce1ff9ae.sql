
-- Add weekday and period to routes
ALTER TABLE public.routes ADD COLUMN weekday integer NULL;
ALTER TABLE public.routes ADD COLUMN period text NULL;

-- Add route_id to sales to track which route a sale came from
ALTER TABLE public.sales ADD COLUMN route_id uuid NULL;
