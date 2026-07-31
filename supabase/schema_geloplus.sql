CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'driver', 'supervisor');

CREATE TABLE IF NOT EXISTS public.cash_flow (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_name text NOT NULL,
  amount numeric(10,2) NOT NULL,
  description text,
  payment_date timestamp with time zone DEFAULT now() NOT NULL,
  sale_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  payment_method text DEFAULT 'Pix'::text
);
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  cpf_cnpj text,
  whatsapp text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_city text,
  address_state text,
  address_zip text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  payment_type text DEFAULT 'avulso'::text NOT NULL,
  opening_date date DEFAULT CURRENT_DATE,
  contact text,
  active boolean DEFAULT true NOT NULL,
  inactive_reason text,
  default_price_table text,
  billing_method text DEFAULT 'pix'::text NOT NULL,
  business_hours text
);
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  phone text,
  is_main boolean DEFAULT false NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  color text DEFAULT '#3b82f6'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  closing_group text
);
CREATE TABLE IF NOT EXISTS public.fin_closing_manual (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  closing_group text NOT NULL,
  amount numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_employees (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  address text DEFAULT ''::text NOT NULL,
  birth_date date,
  cpf text DEFAULT ''::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  employee_type text DEFAULT 'funcionario'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_expense_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_expense_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  category_id uuid NOT NULL,
  item_id uuid NOT NULL,
  sub_item_id uuid,
  amount numeric(15,2) DEFAULT 0 NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  recurrence text DEFAULT 'none'::text,
  observation text,
  parent_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_expense_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_expense_sub_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  item_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_monthly_customers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  month_key text NOT NULL,
  customer_count integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_monthly_finance (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  month_key text NOT NULL,
  revenue numeric DEFAULT 0 NOT NULL,
  fixed_costs numeric DEFAULT 0 NOT NULL,
  variable_costs numeric DEFAULT 0 NOT NULL,
  vehicle_expenses numeric DEFAULT 0 NOT NULL,
  water numeric DEFAULT 0 NOT NULL,
  electricity numeric DEFAULT 0 NOT NULL,
  packaging numeric DEFAULT 0 NOT NULL,
  asset_purchases numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_patrimony_categories (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  year integer DEFAULT 2025 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_patrimony_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  code text DEFAULT ''::text NOT NULL,
  market_value numeric DEFAULT 0 NOT NULL,
  location text DEFAULT ''::text NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  year integer DEFAULT 2025 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_patrimony_maintenances (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  item_code text NOT NULL,
  maintenance_date date DEFAULT CURRENT_DATE NOT NULL,
  description text NOT NULL,
  cost numeric DEFAULT 0 NOT NULL,
  responsible text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_payables (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  supplier_name text,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  category text,
  payment_method text,
  notes text,
  status text DEFAULT 'aberto'::text NOT NULL,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text NOT NULL,
  price numeric DEFAULT 0 NOT NULL,
  unit text DEFAULT 'pacote'::text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_receivable_sales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  receivable_id uuid NOT NULL,
  sale_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_receivables (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  client_name text,
  amount numeric NOT NULL,
  due_date date NOT NULL,
  category text,
  payment_method text,
  notes text,
  status text DEFAULT 'aberto'::text NOT NULL,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_salary_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  month_key text NOT NULL,
  salary numeric DEFAULT 0 NOT NULL,
  commission numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_sales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  product_id uuid,
  customer_name text,
  quantity integer DEFAULT 1 NOT NULL,
  unit_price numeric DEFAULT 0 NOT NULL,
  total numeric DEFAULT 0 NOT NULL,
  sale_date date DEFAULT CURRENT_DATE NOT NULL,
  month_key text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fin_transactions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  description text NOT NULL,
  amount numeric(15,2) NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  date date DEFAULT CURRENT_DATE NOT NULL,
  status text DEFAULT 'realizado'::text NOT NULL,
  payment_method text DEFAULT 'dinheiro'::text NOT NULL,
  notes text,
  origin_cash_flow_id uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  account text
);
CREATE TABLE IF NOT EXISTS public.fleet_maintenances (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vehicle_id uuid NOT NULL,
  maintenance_date date NOT NULL,
  service_type text NOT NULL,
  description text,
  cost numeric DEFAULT 0 NOT NULL,
  responsible text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  plate text,
  model text,
  year integer,
  notes text,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.freezer_maintenance (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  freezer_id uuid NOT NULL,
  description text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.freezers (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid,
  freezer_type text NOT NULL,
  serial_number text,
  contract_signed boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  notes text,
  at_factory boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_name text NOT NULL,
  phone text,
  address text,
  region text,
  order_projection text,
  observations text,
  status text DEFAULT 'contato'::text NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.price_tables (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  price numeric DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  price numeric(10,2) DEFAULT 0 NOT NULL,
  stock_quantity integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  active boolean DEFAULT true NOT NULL
);
CREATE TABLE IF NOT EXISTS public.route_client_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  route_client_id uuid NOT NULL,
  product_id uuid NOT NULL,
  price_table_name text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.route_clients (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  route_id uuid NOT NULL,
  client_id uuid NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  observations text
);
CREATE TABLE IF NOT EXISTS public.routes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  weekday integer,
  period text,
  batch_number text,
  storage_note text,
  driver_id uuid
);
CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  sale_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  price_table_name text
);
CREATE TABLE IF NOT EXISTS public.sales (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  client_id uuid,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  order_number integer DEFAULT nextval('sales_order_number_seq'::regclass) NOT NULL,
  batch_number text,
  client_name text,
  driver_id uuid,
  driver_name text,
  observations text,
  route_id uuid,
  route_client_id uuid,
  is_paid boolean DEFAULT false,
  is_overdue boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS public.stock_entries (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  entry_date date DEFAULT CURRENT_DATE NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.stock_losses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  product_id uuid NOT NULL,
  quantity integer NOT NULL,
  loss_date date DEFAULT CURRENT_DATE NOT NULL,
  reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_approvals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  email text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL
);
CREATE TABLE IF NOT EXISTS public.user_tab_permissions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  tab text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS public.week_plan_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  day text NOT NULL,
  client_name text NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  contacted boolean DEFAULT false NOT NULL
);

ALTER TABLE public.cash_flow ADD CONSTRAINT cash_flow_pkey PRIMARY KEY (id);
ALTER TABLE public.clients ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE public.drivers ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_categories ADD CONSTRAINT fin_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_closing_manual ADD CONSTRAINT fin_closing_manual_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_employees ADD CONSTRAINT fin_employees_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_expense_categories ADD CONSTRAINT fin_expense_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_expense_items ADD CONSTRAINT fin_expense_items_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_expense_sub_items ADD CONSTRAINT fin_expense_sub_items_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_monthly_customers ADD CONSTRAINT fin_monthly_customers_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_monthly_finance ADD CONSTRAINT fin_monthly_finance_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_patrimony_categories ADD CONSTRAINT fin_patrimony_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_patrimony_items ADD CONSTRAINT fin_patrimony_items_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_patrimony_maintenances ADD CONSTRAINT fin_patrimony_maintenances_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_payables ADD CONSTRAINT fin_payables_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_products ADD CONSTRAINT fin_products_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_receivable_sales ADD CONSTRAINT fin_receivable_sales_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_receivables ADD CONSTRAINT fin_receivables_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_salary_entries ADD CONSTRAINT fin_salary_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_sales ADD CONSTRAINT fin_sales_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_pkey PRIMARY KEY (id);
ALTER TABLE public.fleet_maintenances ADD CONSTRAINT fleet_maintenances_pkey PRIMARY KEY (id);
ALTER TABLE public.fleet_vehicles ADD CONSTRAINT fleet_vehicles_pkey PRIMARY KEY (id);
ALTER TABLE public.freezer_maintenance ADD CONSTRAINT freezer_maintenance_pkey PRIMARY KEY (id);
ALTER TABLE public.freezers ADD CONSTRAINT freezers_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.price_tables ADD CONSTRAINT price_tables_pkey PRIMARY KEY (id);
ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE public.route_client_items ADD CONSTRAINT route_client_items_pkey PRIMARY KEY (id);
ALTER TABLE public.route_clients ADD CONSTRAINT route_clients_pkey PRIMARY KEY (id);
ALTER TABLE public.routes ADD CONSTRAINT routes_pkey PRIMARY KEY (id);
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);
ALTER TABLE public.sales ADD CONSTRAINT sales_pkey PRIMARY KEY (id);
ALTER TABLE public.stock_entries ADD CONSTRAINT stock_entries_pkey PRIMARY KEY (id);
ALTER TABLE public.stock_losses ADD CONSTRAINT stock_losses_pkey PRIMARY KEY (id);
ALTER TABLE public.user_approvals ADD CONSTRAINT user_approvals_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_tab_permissions ADD CONSTRAINT user_tab_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.week_plan_items ADD CONSTRAINT week_plan_items_pkey PRIMARY KEY (id);
ALTER TABLE public.fin_categories ADD CONSTRAINT fin_categories_user_id_name_type_key UNIQUE (user_id, name, type);
ALTER TABLE public.fin_closing_manual ADD CONSTRAINT fin_closing_manual_user_id_year_month_closing_group_key UNIQUE (user_id, year, month, closing_group);
ALTER TABLE public.fin_monthly_customers ADD CONSTRAINT fin_monthly_customers_user_id_month_key_key UNIQUE (user_id, month_key);
ALTER TABLE public.fin_monthly_finance ADD CONSTRAINT fin_monthly_finance_user_id_month_key_key UNIQUE (user_id, month_key);
ALTER TABLE public.fin_receivable_sales ADD CONSTRAINT fin_receivable_sales_receivable_id_sale_id_key UNIQUE (receivable_id, sale_id);
ALTER TABLE public.fin_salary_entries ADD CONSTRAINT fin_salary_entries_employee_id_month_key_key UNIQUE (employee_id, month_key);
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_origin_cash_flow_id_key UNIQUE (origin_cash_flow_id);
ALTER TABLE public.route_clients ADD CONSTRAINT route_clients_route_id_client_id_key UNIQUE (route_id, client_id);
ALTER TABLE public.user_approvals ADD CONSTRAINT user_approvals_user_id_key UNIQUE (user_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.user_tab_permissions ADD CONSTRAINT user_tab_permissions_user_id_tab_key UNIQUE (user_id, tab);
ALTER TABLE public.clients ADD CONSTRAINT clients_billing_method_check CHECK ((billing_method = ANY (ARRAY['pix'::text, 'boleto'::text])));
ALTER TABLE public.fin_categories ADD CONSTRAINT fin_categories_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_recurrence_check CHECK ((recurrence = ANY (ARRAY['none'::text, 'daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text])));
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_type_check CHECK ((type = ANY (ARRAY['entrada'::text, 'saida'::text])));
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_status_check CHECK ((status = ANY (ARRAY['realizado'::text, 'previsto'::text])));
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE public.freezers ADD CONSTRAINT freezers_freezer_type_check CHECK ((freezer_type = ANY (ARRAY['horizontal'::text, 'vertical'::text, 'mini_camara'::text])));
ALTER TABLE public.week_plan_items ADD CONSTRAINT week_plan_items_day_check CHECK ((day = ANY (ARRAY['mon'::text, 'tue'::text, 'wed'::text, 'thu'::text, 'fri'::text, 'sat'::text, 'avulsos'::text])));
ALTER TABLE public.cash_flow ADD CONSTRAINT cash_flow_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL;
ALTER TABLE public.fin_categories ADD CONSTRAINT fin_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_employees ADD CONSTRAINT fin_employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_categories ADD CONSTRAINT fin_expense_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_item_id_fkey FOREIGN KEY (item_id) REFERENCES fin_expense_items(id);
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES fin_expense_entries(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_sub_item_id_fkey FOREIGN KEY (sub_item_id) REFERENCES fin_expense_sub_items(id);
ALTER TABLE public.fin_expense_entries ADD CONSTRAINT fin_expense_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_expense_categories(id);
ALTER TABLE public.fin_expense_items ADD CONSTRAINT fin_expense_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_expense_categories(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_items ADD CONSTRAINT fin_expense_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_sub_items ADD CONSTRAINT fin_expense_sub_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES fin_expense_items(id) ON DELETE CASCADE;
ALTER TABLE public.fin_expense_sub_items ADD CONSTRAINT fin_expense_sub_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_monthly_customers ADD CONSTRAINT fin_monthly_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_monthly_finance ADD CONSTRAINT fin_monthly_finance_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_patrimony_categories ADD CONSTRAINT fin_patrimony_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_patrimony_items ADD CONSTRAINT fin_patrimony_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_patrimony_items ADD CONSTRAINT fin_patrimony_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES fin_patrimony_categories(id) ON DELETE CASCADE;
ALTER TABLE public.fin_products ADD CONSTRAINT fin_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_receivable_sales ADD CONSTRAINT fin_receivable_sales_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
ALTER TABLE public.fin_receivable_sales ADD CONSTRAINT fin_receivable_sales_receivable_id_fkey FOREIGN KEY (receivable_id) REFERENCES fin_receivables(id) ON DELETE CASCADE;
ALTER TABLE public.fin_salary_entries ADD CONSTRAINT fin_salary_entries_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES fin_employees(id) ON DELETE CASCADE;
ALTER TABLE public.fin_salary_entries ADD CONSTRAINT fin_salary_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_sales ADD CONSTRAINT fin_sales_product_id_fkey FOREIGN KEY (product_id) REFERENCES fin_products(id) ON DELETE SET NULL;
ALTER TABLE public.fin_sales ADD CONSTRAINT fin_sales_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fin_transactions ADD CONSTRAINT fin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.fleet_maintenances ADD CONSTRAINT fleet_maintenances_vehicle_id_fkey FOREIGN KEY (vehicle_id) REFERENCES fleet_vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.freezer_maintenance ADD CONSTRAINT freezer_maintenance_freezer_id_fkey FOREIGN KEY (freezer_id) REFERENCES freezers(id) ON DELETE CASCADE;
ALTER TABLE public.freezers ADD CONSTRAINT freezers_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.route_client_items ADD CONSTRAINT route_client_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public.route_client_items ADD CONSTRAINT route_client_items_route_client_id_fkey FOREIGN KEY (route_client_id) REFERENCES route_clients(id) ON DELETE CASCADE;
ALTER TABLE public.route_clients ADD CONSTRAINT route_clients_route_id_fkey FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE;
ALTER TABLE public.route_clients ADD CONSTRAINT route_clients_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
ALTER TABLE public.routes ADD CONSTRAINT routes_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
ALTER TABLE public.sales ADD CONSTRAINT sales_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD CONSTRAINT sales_client_id_fkey FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD CONSTRAINT sales_route_client_id_fkey FOREIGN KEY (route_client_id) REFERENCES route_clients(id) ON DELETE SET NULL;
ALTER TABLE public.stock_entries ADD CONSTRAINT stock_entries_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public.stock_losses ADD CONSTRAINT stock_losses_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE public.user_approvals ADD CONSTRAINT user_approvals_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_tab_permissions ADD CONSTRAINT user_tab_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_fin_receivable_sales_receivable ON public.fin_receivable_sales USING btree (receivable_id);
CREATE INDEX idx_fin_receivable_sales_sale ON public.fin_receivable_sales USING btree (sale_id);
CREATE UNIQUE INDEX unique_main_driver ON public.drivers USING btree (is_main) WHERE (is_main = true);
CREATE INDEX idx_fin_patrimony_maintenances_user_code ON public.fin_patrimony_maintenances USING btree (user_id, item_code);
CREATE UNIQUE INDEX idx_fin_patrimony_items_user_code_year_unique ON public.fin_patrimony_items USING btree (user_id, code, year) WHERE ((code IS NOT NULL) AND (code <> ''::text));
CREATE INDEX idx_sale_items_sale_id ON public.sale_items USING btree (sale_id);
CREATE INDEX idx_sale_items_product_id ON public.sale_items USING btree (product_id);
CREATE INDEX idx_sales_created_at ON public.sales USING btree (created_at DESC);
CREATE INDEX idx_sales_client_id ON public.sales USING btree (client_id);
CREATE INDEX idx_stock_losses_loss_date ON public.stock_losses USING btree (loss_date);
CREATE INDEX idx_stock_losses_product_id ON public.stock_losses USING btree (product_id);
CREATE INDEX idx_fleet_maintenances_vehicle ON public.fleet_maintenances USING btree (vehicle_id, maintenance_date DESC);
CREATE INDEX idx_route_clients_route_id ON public.route_clients USING btree (route_id);
CREATE INDEX idx_route_clients_position ON public.route_clients USING btree (route_id, "position");
CREATE INDEX idx_route_client_items_rc ON public.route_client_items USING btree (route_client_id);
CREATE INDEX idx_sales_route_client_id ON public.sales USING btree (route_client_id);
CREATE INDEX idx_week_plan_day_pos ON public.week_plan_items USING btree (day, "position");
CREATE INDEX idx_leads_status ON public.leads USING btree (status);
CREATE INDEX idx_fin_patrimony_categories_year ON public.fin_patrimony_categories USING btree (user_id, year);
CREATE INDEX idx_fin_patrimony_items_year ON public.fin_patrimony_items USING btree (user_id, year);
CREATE INDEX idx_fin_transactions_user_date ON public.fin_transactions USING btree (user_id, date);

CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_approvals (user_id, email, status)
  VALUES (NEW.id, NEW.email, 'pending')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_approved_user(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_approvals
    WHERE user_id = _user_id AND status = 'approved'
  )
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_selected_year integer, p_selected_month integer, p_today date DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo'::text))::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  v_month_start timestamptz;
  v_month_end timestamptz;
  v_year_start timestamptz;
  v_year_end timestamptz;
  v_prev_year_month_start timestamptz;
  v_prev_year_month_end timestamptz;
  v_prev_year_start timestamptz;
  v_prev_year_end timestamptz;
  v_today_start timestamptz;
  v_today_end timestamptz;
  v_week_start date;
  v_quarter_index int;
  v_prev_quarter_index int;
  v_prev_quarter_year int;
  v_pq_start_month int;
  v_quarter_start timestamptz;
  v_quarter_end timestamptz;
  v_mtd_day int;
  v_mtd_end timestamptz;
  v_mtd_prev_start timestamptz;
  v_mtd_prev_end timestamptz;
  v_ytd_end timestamptz;
  v_ytd_prev_start timestamptz;
  v_ytd_prev_end timestamptz;
  v_ytd_ref_month int;
  v_ytd_ref_day int;
BEGIN
  v_month_start := make_timestamptz(p_selected_year, p_selected_month + 1, 1, 0, 0, 0);
  v_month_end := (v_month_start + interval '1 month') - interval '1 microsecond';
  v_year_start := make_timestamptz(p_selected_year, 1, 1, 0, 0, 0);
  v_year_end := make_timestamptz(p_selected_year, 12, 31, 23, 59, 59);
  v_prev_year_month_start := make_timestamptz(p_selected_year - 1, p_selected_month + 1, 1, 0, 0, 0);
  v_prev_year_month_end := (v_prev_year_month_start + interval '1 month') - interval '1 microsecond';
  v_prev_year_start := make_timestamptz(p_selected_year - 1, 1, 1, 0, 0, 0);
  v_prev_year_end := make_timestamptz(p_selected_year - 1, 12, 31, 23, 59, 59);
  
  v_today_start := (p_today::text || ' 00:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_today_end := (p_today::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  
  v_week_start := p_today - extract(dow from p_today)::int;
  IF NOT (p_selected_year = extract(year from p_today)::int AND p_selected_month = extract(month from p_today)::int - 1) THEN
    v_week_start := make_date(p_selected_year, p_selected_month + 1, 1) - extract(dow from make_date(p_selected_year, p_selected_month + 1, 1))::int;
  END IF;

  -- Month-to-date
  IF p_selected_year = extract(year from p_today)::int AND p_selected_month = extract(month from p_today)::int - 1 THEN
    v_mtd_day := extract(day from p_today)::int;
  ELSE
    v_mtd_day := extract(day from (v_month_end AT TIME ZONE 'America/Sao_Paulo'))::int;
  END IF;
  
  v_mtd_end := (make_date(p_selected_year, p_selected_month + 1, v_mtd_day)::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_mtd_prev_start := make_timestamptz(p_selected_year - 1, p_selected_month + 1, 1, 0, 0, 0);
  v_mtd_prev_end := (make_date(p_selected_year - 1, p_selected_month + 1, LEAST(v_mtd_day, extract(day from (v_mtd_prev_start + interval '1 month' - interval '1 day'))::int))::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  -- Year-to-date: Jan 1 to selected month+day (or end of selected month if past)
  IF p_selected_year = extract(year from p_today)::int THEN
    v_ytd_ref_month := extract(month from p_today)::int;
    v_ytd_ref_day := extract(day from p_today)::int;
  ELSE
    v_ytd_ref_month := 12;
    v_ytd_ref_day := 31;
  END IF;
  v_ytd_end := (make_date(p_selected_year, v_ytd_ref_month, v_ytd_ref_day)::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';
  v_ytd_prev_start := make_timestamptz(p_selected_year - 1, 1, 1, 0, 0, 0);
  v_ytd_prev_end := (make_date(p_selected_year - 1, v_ytd_ref_month, LEAST(v_ytd_ref_day, extract(day from (make_date(p_selected_year - 1, v_ytd_ref_month, 1) + interval '1 month' - interval '1 day'))::int))::text || ' 23:59:59.999999')::timestamp AT TIME ZONE 'America/Sao_Paulo';

  v_quarter_index := p_selected_month / 3;
  IF v_quarter_index = 0 THEN
    v_prev_quarter_index := 3;
    v_prev_quarter_year := p_selected_year - 1;
  ELSE
    v_prev_quarter_index := v_quarter_index - 1;
    v_prev_quarter_year := p_selected_year;
  END IF;
  v_pq_start_month := v_prev_quarter_index * 3 + 1;
  v_quarter_start := make_timestamptz(v_prev_quarter_year, v_pq_start_month, 1, 0, 0, 0);
  v_quarter_end := (make_timestamptz(v_prev_quarter_year, v_pq_start_month + 2, 1, 0, 0, 0) + interval '1 month') - interval '1 microsecond';

  SELECT jsonb_build_object(
    'todayTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_today_start AND v_today_end), 0),
    'todayCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_today_start AND v_today_end),
    'todayPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_today_start AND v_today_end), 0),
    'monthTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_month_start AND v_month_end), 0),
    'monthCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_month_start AND v_month_end),
    'monthPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_month_start AND v_month_end), 0),
    'monthClients', (SELECT count(DISTINCT client_id) FROM sales WHERE created_at BETWEEN v_month_start AND v_month_end AND client_id IS NOT NULL),
    'prevMonthTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end), 0),
    'prevMonthCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end),
    'prevMonthPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end), 0),
    'prevMonthClients', (SELECT count(DISTINCT client_id) FROM sales WHERE created_at BETWEEN v_prev_year_month_start AND v_prev_year_month_end AND client_id IS NOT NULL),
    'yearTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_year_start AND v_year_end), 0),
    'yearCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_year_start AND v_year_end),
    'yearPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_year_start AND v_year_end), 0),
    'prevYearTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_prev_year_start AND v_prev_year_end), 0),
    'prevYearCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_prev_year_start AND v_prev_year_end),
    'prevYearPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_prev_year_start AND v_prev_year_end), 0),
    'mtdTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_month_start AND v_mtd_end), 0),
    'mtdCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_month_start AND v_mtd_end),
    'mtdPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_month_start AND v_mtd_end), 0),
    'mtdPrevTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_mtd_prev_start AND v_mtd_prev_end), 0),
    'mtdPrevCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_mtd_prev_start AND v_mtd_prev_end),
    'mtdPrevPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_mtd_prev_start AND v_mtd_prev_end), 0),
    'mtdDay', v_mtd_day,
    'ytdTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_year_start AND v_ytd_end), 0),
    'ytdCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_year_start AND v_ytd_end),
    'ytdPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_year_start AND v_ytd_end), 0),
    'ytdPrevTotal', COALESCE((SELECT sum(total) FROM sales WHERE created_at BETWEEN v_ytd_prev_start AND v_ytd_prev_end), 0),
    'ytdPrevCount', (SELECT count(*) FROM sales WHERE created_at BETWEEN v_ytd_prev_start AND v_ytd_prev_end),
    'ytdPrevPackages', COALESCE((SELECT sum(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.created_at BETWEEN v_ytd_prev_start AND v_ytd_prev_end), 0),
    'ytdLabel', to_char(make_date(p_selected_year, 1, 1), 'DD/MM') || ' a ' || to_char(make_date(p_selected_year, v_ytd_ref_month, v_ytd_ref_day), 'DD/MM'),
    'topProducts', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.qty DESC)
      FROM (
        SELECT COALESCE(p.name, si.product_name) as name, sum(si.quantity)::int as qty, sum(si.subtotal)::numeric as revenue
        FROM sale_items si 
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE s.created_at BETWEEN v_month_start AND v_month_end
        GROUP BY si.product_id, COALESCE(p.name, si.product_name) ORDER BY qty DESC LIMIT 7
      ) t
    ), '[]'::jsonb),
    'weekDays', (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.d)
      FROM (
        SELECT d,
          to_char(d, 'Dy') as name,
          COALESCE(sum(s.total), 0)::numeric as total,
          COALESCE(sum(si_qty.qty), 0)::int as pacotes
        FROM generate_series(v_week_start::date, v_week_start::date + 6, '1 day'::interval) d
        LEFT JOIN sales s ON s.created_at >= d AND s.created_at < d + interval '1 day'
        LEFT JOIN LATERAL (SELECT sum(quantity) as qty FROM sale_items WHERE sale_id = s.id) si_qty ON true
        GROUP BY d ORDER BY d
      ) t
    ),
    'monthlyComparison', (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.m)
      FROM (
        SELECT m,
          substr(to_char(make_date(p_selected_year, m, 1), 'Month'), 1, 3) as name,
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year THEN s.total END), 0)::numeric as atual,
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year - 1 THEN s.total END), 0)::numeric as anterior,
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year THEN si_qty.qty END), 0)::int as "pacotesAtual",
          COALESCE(sum(CASE WHEN extract(year from s.created_at) = p_selected_year - 1 THEN si_qty.qty END), 0)::int as "pacotesAnterior",
          count(CASE WHEN extract(year from s.created_at) = p_selected_year THEN 1 END)::int as "pedidosAtual",
          count(CASE WHEN extract(year from s.created_at) = p_selected_year - 1 THEN 1 END)::int as "pedidosAnterior"
        FROM generate_series(1, 12) m
        LEFT JOIN sales s ON extract(month from s.created_at) = m 
          AND extract(year from s.created_at) IN (p_selected_year, p_selected_year - 1)
        LEFT JOIN LATERAL (SELECT sum(quantity) as qty FROM sale_items WHERE sale_id = s.id) si_qty ON true
        GROUP BY m ORDER BY m
      ) t
    ),
    'dailyChart', (
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.d)
      FROM (
        SELECT d, to_char(d, 'DD') as day, COALESCE(sum(s.total), 0)::numeric as total
        FROM generate_series(v_month_start::date, (v_month_end)::date, '1 day'::interval) d
        LEFT JOIN sales s ON s.created_at >= d AND s.created_at < d + interval '1 day'
        GROUP BY d ORDER BY d
      ) t
    ),
    'monthLossQty', COALESCE((SELECT sum(quantity) FROM stock_losses WHERE loss_date >= v_month_start::date AND loss_date <= v_month_end::date), 0),
    'lossProducts', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.qty DESC)
      FROM (
        SELECT p.name, sum(sl.quantity)::int as qty
        FROM stock_losses sl JOIN products p ON sl.product_id = p.id
        WHERE sl.loss_date >= v_month_start::date AND sl.loss_date <= v_month_end::date
        GROUP BY p.name ORDER BY qty DESC
      ) t
    ), '[]'::jsonb),
    'topClients', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.revenue DESC)
      FROM (
        SELECT s.client_name as name, sum(s.total)::numeric as revenue,
          COALESCE(sum(si_qty.qty), 0)::int as packages
        FROM sales s
        LEFT JOIN LATERAL (SELECT sum(quantity) as qty FROM sale_items WHERE sale_id = s.id) si_qty ON true
        WHERE s.created_at BETWEEN v_quarter_start AND v_quarter_end
        GROUP BY s.client_id, s.client_name ORDER BY revenue DESC LIMIT 10
      ) t
    ), '[]'::jsonb),
    'pqStartMonth', v_pq_start_month - 1,
    'prevQuarterYear', v_prev_quarter_year
  ) INTO result;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_sale_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
      SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
      WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity + OLD.quantity
      WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id THEN
      UPDATE public.products
        SET stock_quantity = stock_quantity + OLD.quantity
        WHERE id = OLD.product_id;
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
        WHERE id = NEW.product_id;
    ELSIF NEW.quantity <> OLD.quantity THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - (NEW.quantity - OLD.quantity))
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity + NEW.quantity
      WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
      SET stock_quantity = GREATEST(0, stock_quantity - OLD.quantity)
      WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - OLD.quantity)
        WHERE id = OLD.product_id;
      UPDATE public.products
        SET stock_quantity = stock_quantity + NEW.quantity
        WHERE id = NEW.product_id;
    ELSIF NEW.quantity <> OLD.quantity THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity + (NEW.quantity - OLD.quantity))
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.adjust_stock_on_loss()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products
      SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
      WHERE id = NEW.product_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products
      SET stock_quantity = stock_quantity + OLD.quantity
      WHERE id = OLD.product_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.product_id <> OLD.product_id THEN
      UPDATE public.products
        SET stock_quantity = stock_quantity + OLD.quantity
        WHERE id = OLD.product_id;
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - NEW.quantity)
        WHERE id = NEW.product_id;
    ELSIF NEW.quantity <> OLD.quantity THEN
      UPDATE public.products
        SET stock_quantity = GREATEST(0, stock_quantity - (NEW.quantity - OLD.quantity))
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fin_unmirror_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.fin_transactions WHERE origin_cash_flow_id = OLD.id;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fin_mirror_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner UUID;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.fin_categories (user_id, name, type, color)
  VALUES (v_owner, 'Vendas de Gelo', 'entrada', '#16a34a')
  ON CONFLICT (user_id, name, type) DO NOTHING;

  INSERT INTO public.fin_transactions (
    user_id, description, amount, type, category, date, status, payment_method, notes, origin_cash_flow_id
  ) VALUES (
    v_owner,
    COALESCE(NEW.client_name, NEW.description, 'Recebimento Comercial'),
    NEW.amount,
    'entrada',
    'Vendas de Gelo',
    COALESCE(NEW.payment_date::date, CURRENT_DATE),
    'realizado',
    COALESCE(NEW.payment_method, 'dinheiro'),
    COALESCE(NEW.description, '') || ' (origem: comercial #' || NEW.id::text || ')',
    NEW.id
  )
  ON CONFLICT (origin_cash_flow_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fin_resync_cash_flow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner UUID;
  v_exists BOOLEAN;
BEGIN
  SELECT id INTO v_owner FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.fin_transactions WHERE origin_cash_flow_id = NEW.id) INTO v_exists;

  IF v_exists THEN
    UPDATE public.fin_transactions
       SET description = COALESCE(NEW.client_name, NEW.description, 'Recebimento Comercial'),
           amount = NEW.amount,
           date = COALESCE(NEW.payment_date::date, CURRENT_DATE),
           payment_method = COALESCE(NEW.payment_method, 'dinheiro'),
           notes = COALESCE(NEW.description, '') || ' (origem: comercial #' || NEW.id::text || ')',
           updated_at = now()
     WHERE origin_cash_flow_id = NEW.id;
  ELSE
    INSERT INTO public.fin_categories (user_id, name, type, color)
    VALUES (v_owner, 'Vendas de Gelo', 'entrada', '#16a34a')
    ON CONFLICT (user_id, name, type) DO NOTHING;

    INSERT INTO public.fin_transactions (
      user_id, description, amount, type, category, date, status, payment_method, notes, origin_cash_flow_id
    ) VALUES (
      v_owner,
      COALESCE(NEW.client_name, NEW.description, 'Recebimento Comercial'),
      NEW.amount,
      'entrada',
      'Vendas de Gelo',
      COALESCE(NEW.payment_date::date, CURRENT_DATE),
      'realizado',
      COALESCE(NEW.payment_method, 'dinheiro'),
      COALESCE(NEW.description, '') || ' (origem: comercial #' || NEW.id::text || ')',
      NEW.id
    )
    ON CONFLICT (origin_cash_flow_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_boleto_receivables()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Geração automática de boletos (mensal e quinzenal) desativada.
  -- Nova lógica será implementada em seguida.
  RETURN 0;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_dev_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dev_id uuid;
  v_target uuid;
  v_new_status text;
  v_old_status text;
BEGIN
  SELECT id INTO v_dev_id FROM auth.users WHERE email = 'atendimentogeloplus@gmail.com' LIMIT 1;
  IF v_dev_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_target := OLD.user_id;
  ELSE
    v_target := NEW.user_id;
  END IF;

  IF v_target <> v_dev_id THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode ser alterada.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode perder o perfil admin.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'user_approvals' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode ser removida.';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status <> 'approved' THEN
      RAISE EXCEPTION 'A conta de desenvolvedor é protegida e não pode ser revogada.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$
;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_approvals_updated_at BEFORE UPDATE ON public.user_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_price_tables_updated_at BEFORE UPDATE ON public.price_tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_adjust_stock_on_sale_item AFTER INSERT OR DELETE OR UPDATE ON public.sale_items FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_sale_item();
CREATE TRIGGER trg_adjust_stock_on_entry AFTER INSERT OR DELETE OR UPDATE ON public.stock_entries FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_entry();
CREATE TRIGGER trg_adjust_stock_on_loss AFTER INSERT OR DELETE OR UPDATE ON public.stock_losses FOR EACH ROW EXECUTE FUNCTION adjust_stock_on_loss();
CREATE TRIGGER update_cash_flow_updated_at BEFORE UPDATE ON public.cash_flow FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_freezers_updated_at BEFORE UPDATE ON public.freezers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_monthly_finance_updated BEFORE UPDATE ON public.fin_monthly_finance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_products_updated BEFORE UPDATE ON public.fin_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_sales_updated BEFORE UPDATE ON public.fin_sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_monthly_customers_updated BEFORE UPDATE ON public.fin_monthly_customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_employees_updated BEFORE UPDATE ON public.fin_employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_salary_entries_updated BEFORE UPDATE ON public.fin_salary_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_patrimony_categories_updated BEFORE UPDATE ON public.fin_patrimony_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_patrimony_items_updated BEFORE UPDATE ON public.fin_patrimony_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_expense_categories_updated BEFORE UPDATE ON public.fin_expense_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_expense_items_updated BEFORE UPDATE ON public.fin_expense_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_expense_sub_items_updated BEFORE UPDATE ON public.fin_expense_sub_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_expense_entries_updated BEFORE UPDATE ON public.fin_expense_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_categories_updated BEFORE UPDATE ON public.fin_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_transactions_updated BEFORE UPDATE ON public.fin_transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_mirror_cash_flow_ins AFTER INSERT ON public.cash_flow FOR EACH ROW EXECUTE FUNCTION fin_mirror_cash_flow();
CREATE TRIGGER trg_fin_mirror_cash_flow_del AFTER DELETE ON public.cash_flow FOR EACH ROW EXECUTE FUNCTION fin_unmirror_cash_flow();
CREATE TRIGGER update_fin_receivables_updated_at BEFORE UPDATE ON public.fin_receivables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_mirror_cash_flow_upd AFTER UPDATE ON public.cash_flow FOR EACH ROW EXECUTE FUNCTION fin_resync_cash_flow();
CREATE TRIGGER protect_dev_user_roles BEFORE DELETE OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION protect_dev_account();
CREATE TRIGGER protect_dev_user_approvals BEFORE DELETE OR UPDATE ON public.user_approvals FOR EACH ROW EXECUTE FUNCTION protect_dev_account();
CREATE TRIGGER update_fin_payables_updated_at BEFORE UPDATE ON public.fin_payables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_closing_manual_updated BEFORE UPDATE ON public.fin_closing_manual FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_fin_patrimony_maintenances_updated_at BEFORE UPDATE ON public.fin_patrimony_maintenances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fleet_vehicles_updated_at BEFORE UPDATE ON public.fleet_vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fleet_maintenances_updated_at BEFORE UPDATE ON public.fleet_maintenances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_week_plan_items_updated_at BEFORE UPDATE ON public.week_plan_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flow TO authenticated; GRANT ALL ON public.cash_flow TO service_role;
ALTER TABLE public.cash_flow ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated; GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated; GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_categories TO authenticated; GRANT ALL ON public.fin_categories TO service_role;
ALTER TABLE public.fin_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_closing_manual TO authenticated; GRANT ALL ON public.fin_closing_manual TO service_role;
ALTER TABLE public.fin_closing_manual ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_employees TO authenticated; GRANT ALL ON public.fin_employees TO service_role;
ALTER TABLE public.fin_employees ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_categories TO authenticated; GRANT ALL ON public.fin_expense_categories TO service_role;
ALTER TABLE public.fin_expense_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_entries TO authenticated; GRANT ALL ON public.fin_expense_entries TO service_role;
ALTER TABLE public.fin_expense_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_items TO authenticated; GRANT ALL ON public.fin_expense_items TO service_role;
ALTER TABLE public.fin_expense_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_sub_items TO authenticated; GRANT ALL ON public.fin_expense_sub_items TO service_role;
ALTER TABLE public.fin_expense_sub_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_monthly_customers TO authenticated; GRANT ALL ON public.fin_monthly_customers TO service_role;
ALTER TABLE public.fin_monthly_customers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_monthly_finance TO authenticated; GRANT ALL ON public.fin_monthly_finance TO service_role;
ALTER TABLE public.fin_monthly_finance ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_patrimony_categories TO authenticated; GRANT ALL ON public.fin_patrimony_categories TO service_role;
ALTER TABLE public.fin_patrimony_categories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_patrimony_items TO authenticated; GRANT ALL ON public.fin_patrimony_items TO service_role;
ALTER TABLE public.fin_patrimony_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_patrimony_maintenances TO authenticated; GRANT ALL ON public.fin_patrimony_maintenances TO service_role;
ALTER TABLE public.fin_patrimony_maintenances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_payables TO authenticated; GRANT ALL ON public.fin_payables TO service_role;
ALTER TABLE public.fin_payables ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_products TO authenticated; GRANT ALL ON public.fin_products TO service_role;
ALTER TABLE public.fin_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_receivable_sales TO authenticated; GRANT ALL ON public.fin_receivable_sales TO service_role;
ALTER TABLE public.fin_receivable_sales ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_receivables TO authenticated; GRANT ALL ON public.fin_receivables TO service_role;
ALTER TABLE public.fin_receivables ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_salary_entries TO authenticated; GRANT ALL ON public.fin_salary_entries TO service_role;
ALTER TABLE public.fin_salary_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_sales TO authenticated; GRANT ALL ON public.fin_sales TO service_role;
ALTER TABLE public.fin_sales ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_transactions TO authenticated; GRANT ALL ON public.fin_transactions TO service_role;
ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_maintenances TO authenticated; GRANT ALL ON public.fleet_maintenances TO service_role;
ALTER TABLE public.fleet_maintenances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_vehicles TO authenticated; GRANT ALL ON public.fleet_vehicles TO service_role;
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freezer_maintenance TO authenticated; GRANT ALL ON public.freezer_maintenance TO service_role;
ALTER TABLE public.freezer_maintenance ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.freezers TO authenticated; GRANT ALL ON public.freezers TO service_role;
ALTER TABLE public.freezers ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated; GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_tables TO authenticated; GRANT ALL ON public.price_tables TO service_role;
ALTER TABLE public.price_tables ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated; GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_client_items TO authenticated; GRANT ALL ON public.route_client_items TO service_role;
ALTER TABLE public.route_client_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_clients TO authenticated; GRANT ALL ON public.route_clients TO service_role;
ALTER TABLE public.route_clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.routes TO authenticated; GRANT ALL ON public.routes TO service_role;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated; GRANT ALL ON public.sale_items TO service_role;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated; GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_entries TO authenticated; GRANT ALL ON public.stock_entries TO service_role;
ALTER TABLE public.stock_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_losses TO authenticated; GRANT ALL ON public.stock_losses TO service_role;
ALTER TABLE public.stock_losses ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_approvals TO authenticated; GRANT ALL ON public.user_approvals TO service_role;
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated; GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tab_permissions TO authenticated; GRANT ALL ON public.user_tab_permissions TO service_role;
ALTER TABLE public.user_tab_permissions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_plan_items TO authenticated; GRANT ALL ON public.week_plan_items TO service_role;
ALTER TABLE public.week_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable update access for authenticated users" ON public.cash_flow AS PERMISSIVE FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Enable insert access for authenticated users" ON public.cash_flow AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable read access for authenticated users" ON public.cash_flow AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable delete access for authenticated users" ON public.cash_flow AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Non-drivers can delete clients" ON public.clients AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update clients" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert clients" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can insert drivers" ON public.drivers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view drivers" ON public.drivers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can delete drivers" ON public.drivers AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update drivers" ON public.drivers AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY fin_categories_owner ON public.fin_categories AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "own rows" ON public.fin_closing_manual AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_employees_owner ON public.fin_employees AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_expense_categories_owner ON public.fin_expense_categories AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_expense_entries_owner ON public.fin_expense_entries AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_expense_items_owner ON public.fin_expense_items AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_expense_sub_items_owner ON public.fin_expense_sub_items AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_monthly_customers_owner ON public.fin_monthly_customers AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_monthly_finance_owner ON public.fin_monthly_finance AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_patrimony_categories_owner ON public.fin_patrimony_categories AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_patrimony_items_owner ON public.fin_patrimony_items AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own patrimony maintenances" ON public.fin_patrimony_maintenances AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Users manage own payables" ON public.fin_payables AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_products_owner ON public.fin_products AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "Authenticated can read links" ON public.fin_receivable_sales AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can delete links" ON public.fin_receivable_sales AS PERMISSIVE FOR DELETE TO authenticated USING (true);
CREATE POLICY "Authenticated can insert links" ON public.fin_receivable_sales AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users manage own receivables" ON public.fin_receivables AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_salary_entries_owner ON public.fin_salary_entries AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_sales_owner ON public.fin_sales AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY fin_transactions_owner ON public.fin_transactions AS PERMISSIVE FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "auth manage fleet_maintenances" ON public.fleet_maintenances AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth manage fleet_vehicles" ON public.fleet_vehicles AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public freezer_maintenance access" ON public.freezer_maintenance AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Public freezers access" ON public.freezers AS PERMISSIVE FOR ALL TO public USING (true);
CREATE POLICY "Non-drivers can update leads" ON public.leads AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can delete leads" ON public.leads AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view leads" ON public.leads AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can insert leads" ON public.leads AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Auth users can view price_tables" ON public.price_tables AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can delete price_tables" ON public.price_tables AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update price_tables" ON public.price_tables AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert price_tables" ON public.price_tables AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update products" ON public.products AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert products" ON public.products AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view products" ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can delete products" ON public.products AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert route_client_items" ON public.route_client_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view route_client_items" ON public.route_client_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can update route_client_items" ON public.route_client_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Only admins can delete route_client_items" ON public.route_client_items AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Non-drivers can insert route_clients" ON public.route_clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update route_clients" ON public.route_clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Only admins can delete route_clients" ON public.route_clients AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view route_clients" ON public.route_clients AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view routes" ON public.routes AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can delete routes" ON public.routes AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Non-drivers can update routes" ON public.routes AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert routes" ON public.routes AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view sale_items" ON public.sale_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can update sale_items" ON public.sale_items AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert sale_items" ON public.sale_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can delete sale_items" ON public.sale_items AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert sales" ON public.sales AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can delete sales" ON public.sales AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update sales" ON public.sales AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view sales" ON public.sales AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can delete stock_entries" ON public.stock_entries AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view stock_entries" ON public.stock_entries AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Non-drivers can insert stock_entries" ON public.stock_entries AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update stock_entries" ON public.stock_entries AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can delete stock_losses" ON public.stock_losses AS PERMISSIVE FOR DELETE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can update stock_losses" ON public.stock_losses AS PERMISSIVE FOR UPDATE TO authenticated USING ((NOT has_role(auth.uid(), 'driver'::app_role))) WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Non-drivers can insert stock_losses" ON public.stock_losses AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((NOT has_role(auth.uid(), 'driver'::app_role)));
CREATE POLICY "Authenticated users can view stock_losses" ON public.stock_losses AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Approved users can view all approvals" ON public.user_approvals AS PERMISSIVE FOR SELECT TO authenticated USING (is_approved_user(auth.uid()));
CREATE POLICY "Service role can manage approvals" ON public.user_approvals AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users can view own approval" ON public.user_approvals AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Approved non-drivers can update approvals" ON public.user_approvals AS PERMISSIVE FOR UPDATE TO authenticated USING ((is_approved_user(auth.uid()) AND (NOT has_role(auth.uid(), 'driver'::app_role)))) WITH CHECK ((is_approved_user(auth.uid()) AND (NOT has_role(auth.uid(), 'driver'::app_role))));
CREATE POLICY "Admins can delete roles" ON public.user_roles AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view all roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()));
CREATE POLICY "Admins manage tab permissions" ON public.user_tab_permissions AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own tab permissions" ON public.user_tab_permissions AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Authenticated can view week plan" ON public.week_plan_items AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert week plan" ON public.week_plan_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update week plan" ON public.week_plan_items AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin can delete week plan" ON public.week_plan_items AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
