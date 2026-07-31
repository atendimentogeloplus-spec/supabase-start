
-- =========================================================
-- Módulo Financeiro: tabelas fin_*
-- =========================================================

-- monthly finance
CREATE TABLE public.fin_monthly_finance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  revenue NUMERIC NOT NULL DEFAULT 0,
  fixed_costs NUMERIC NOT NULL DEFAULT 0,
  variable_costs NUMERIC NOT NULL DEFAULT 0,
  vehicle_expenses NUMERIC NOT NULL DEFAULT 0,
  water NUMERIC NOT NULL DEFAULT 0,
  electricity NUMERIC NOT NULL DEFAULT 0,
  packaging NUMERIC NOT NULL DEFAULT 0,
  asset_purchases NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_monthly_finance TO authenticated;
GRANT ALL ON public.fin_monthly_finance TO service_role;
ALTER TABLE public.fin_monthly_finance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_monthly_finance_owner" ON public.fin_monthly_finance FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_monthly_finance_updated BEFORE UPDATE ON public.fin_monthly_finance FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- products (fin)
CREATE TABLE public.fin_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pacote',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_products TO authenticated;
GRANT ALL ON public.fin_products TO service_role;
ALTER TABLE public.fin_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_products_owner" ON public.fin_products FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_products_updated BEFORE UPDATE ON public.fin_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- sales (fin)
CREATE TABLE public.fin_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.fin_products(id) ON DELETE SET NULL,
  customer_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  month_key TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_sales TO authenticated;
GRANT ALL ON public.fin_sales TO service_role;
ALTER TABLE public.fin_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_sales_owner" ON public.fin_sales FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_sales_updated BEFORE UPDATE ON public.fin_sales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- monthly customers
CREATE TABLE public.fin_monthly_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  customer_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_monthly_customers TO authenticated;
GRANT ALL ON public.fin_monthly_customers TO service_role;
ALTER TABLE public.fin_monthly_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_monthly_customers_owner" ON public.fin_monthly_customers FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_monthly_customers_updated BEFORE UPDATE ON public.fin_monthly_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- employees
CREATE TABLE public.fin_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  birth_date DATE,
  cpf TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  employee_type TEXT NOT NULL DEFAULT 'funcionario',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_employees TO authenticated;
GRANT ALL ON public.fin_employees TO service_role;
ALTER TABLE public.fin_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_employees_owner" ON public.fin_employees FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_employees_updated BEFORE UPDATE ON public.fin_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- salary entries
CREATE TABLE public.fin_salary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.fin_employees(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL,
  salary NUMERIC NOT NULL DEFAULT 0,
  commission NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, month_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_salary_entries TO authenticated;
GRANT ALL ON public.fin_salary_entries TO service_role;
ALTER TABLE public.fin_salary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_salary_entries_owner" ON public.fin_salary_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_salary_entries_updated BEFORE UPDATE ON public.fin_salary_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- patrimony
CREATE TABLE public.fin_patrimony_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_patrimony_categories TO authenticated;
GRANT ALL ON public.fin_patrimony_categories TO service_role;
ALTER TABLE public.fin_patrimony_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_patrimony_categories_owner" ON public.fin_patrimony_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fin_patrimony_categories_year ON public.fin_patrimony_categories (user_id, year);
CREATE TRIGGER trg_fin_patrimony_categories_updated BEFORE UPDATE ON public.fin_patrimony_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fin_patrimony_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.fin_patrimony_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  code TEXT NOT NULL DEFAULT '',
  market_value NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT 2025,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_patrimony_items TO authenticated;
GRANT ALL ON public.fin_patrimony_items TO service_role;
ALTER TABLE public.fin_patrimony_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_patrimony_items_owner" ON public.fin_patrimony_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fin_patrimony_items_year ON public.fin_patrimony_items (user_id, year);
CREATE TRIGGER trg_fin_patrimony_items_updated BEFORE UPDATE ON public.fin_patrimony_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- expense legacy
CREATE TABLE public.fin_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_categories TO authenticated;
GRANT ALL ON public.fin_expense_categories TO service_role;
ALTER TABLE public.fin_expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_expense_categories_owner" ON public.fin_expense_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_expense_categories_updated BEFORE UPDATE ON public.fin_expense_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fin_expense_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.fin_expense_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_items TO authenticated;
GRANT ALL ON public.fin_expense_items TO service_role;
ALTER TABLE public.fin_expense_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_expense_items_owner" ON public.fin_expense_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_expense_items_updated BEFORE UPDATE ON public.fin_expense_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fin_expense_sub_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.fin_expense_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_sub_items TO authenticated;
GRANT ALL ON public.fin_expense_sub_items TO service_role;
ALTER TABLE public.fin_expense_sub_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_expense_sub_items_owner" ON public.fin_expense_sub_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_expense_sub_items_updated BEFORE UPDATE ON public.fin_expense_sub_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fin_expense_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.fin_expense_categories(id),
  item_id UUID NOT NULL REFERENCES public.fin_expense_items(id),
  sub_item_id UUID REFERENCES public.fin_expense_sub_items(id),
  amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurrence TEXT CHECK (recurrence IN ('none','daily','weekly','monthly','yearly')) DEFAULT 'none',
  observation TEXT,
  parent_id UUID REFERENCES public.fin_expense_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_expense_entries TO authenticated;
GRANT ALL ON public.fin_expense_entries TO service_role;
ALTER TABLE public.fin_expense_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_expense_entries_owner" ON public.fin_expense_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_expense_entries_updated BEFORE UPDATE ON public.fin_expense_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- categories (fin)
CREATE TABLE public.fin_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_categories TO authenticated;
GRANT ALL ON public.fin_categories TO service_role;
ALTER TABLE public.fin_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_categories_owner" ON public.fin_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_fin_categories_updated BEFORE UPDATE ON public.fin_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- transactions (fin)
CREATE TABLE public.fin_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount >= 0),
  type TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  category TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'realizado' CHECK (status IN ('realizado','previsto')),
  payment_method TEXT NOT NULL DEFAULT 'dinheiro',
  notes TEXT,
  origin_cash_flow_id UUID UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_transactions TO authenticated;
GRANT ALL ON public.fin_transactions TO service_role;
ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fin_transactions_owner" ON public.fin_transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_fin_transactions_user_date ON public.fin_transactions(user_id, date);
CREATE TRIGGER trg_fin_transactions_updated BEFORE UPDATE ON public.fin_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Espelho: cash_flow -> fin_transactions
-- =========================================================
CREATE OR REPLACE FUNCTION public.fin_mirror_cash_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    COALESCE(NEW.description, NEW.client_name, 'Recebimento Comercial'),
    NEW.amount,
    'entrada',
    'Vendas de Gelo',
    COALESCE(NEW.payment_date::date, CURRENT_DATE),
    'realizado',
    COALESCE(NEW.payment_method, 'dinheiro'),
    'Origem: comercial #' || NEW.id::text,
    NEW.id
  )
  ON CONFLICT (origin_cash_flow_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fin_mirror_cash_flow_ins
AFTER INSERT ON public.cash_flow
FOR EACH ROW EXECUTE FUNCTION public.fin_mirror_cash_flow();

CREATE OR REPLACE FUNCTION public.fin_unmirror_cash_flow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.fin_transactions WHERE origin_cash_flow_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_fin_mirror_cash_flow_del
AFTER DELETE ON public.cash_flow
FOR EACH ROW EXECUTE FUNCTION public.fin_unmirror_cash_flow();

-- =========================================================
-- Permissões de abas novas (apenas amplia ALL_TABS lógicas no app;
-- nada precisa ser feito no banco para isso, mas adicionamos
-- registros de permissão padrão para o admin não é necessário,
-- pois admin já vê tudo via has_role).
-- =========================================================
