export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      cash_flow: {
        Row: {
          amount: number
          client_name: string
          created_at: string
          description: string | null
          id: string
          payment_date: string
          payment_method: string | null
          sale_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_name: string
          created_at?: string
          description?: string | null
          id?: string
          payment_date?: string
          payment_method?: string | null
          sale_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_name?: string
          created_at?: string
          description?: string | null
          id?: string
          payment_date?: string
          payment_method?: string | null
          sale_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_flow_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          address_city: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          billing_method: string
          business_hours: string | null
          contact: string | null
          cpf_cnpj: string | null
          created_at: string
          default_price_table: string | null
          id: string
          inactive_reason: string | null
          name: string
          opening_date: string | null
          payment_type: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          billing_method?: string
          business_hours?: string | null
          contact?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          default_price_table?: string | null
          id?: string
          inactive_reason?: string | null
          name: string
          opening_date?: string | null
          payment_type?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address_city?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          billing_method?: string
          business_hours?: string | null
          contact?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          default_price_table?: string | null
          id?: string
          inactive_reason?: string | null
          name?: string
          opening_date?: string | null
          payment_type?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_main: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_main?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_main?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fin_categories: {
        Row: {
          closing_group: string | null
          color: string
          created_at: string
          id: string
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          closing_group?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          closing_group?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_closing_manual: {
        Row: {
          amount: number
          closing_group: string
          created_at: string
          id: string
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          amount?: number
          closing_group: string
          created_at?: string
          id?: string
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          closing_group?: string
          created_at?: string
          id?: string
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      fin_employees: {
        Row: {
          active: boolean
          address: string
          birth_date: string | null
          cpf: string
          created_at: string
          employee_type: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          address?: string
          birth_date?: string | null
          cpf?: string
          created_at?: string
          employee_type?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          address?: string
          birth_date?: string | null
          cpf?: string
          created_at?: string
          employee_type?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_expense_entries: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          date: string
          description: string
          id: string
          item_id: string
          observation: string | null
          parent_id: string | null
          recurrence: string | null
          sub_item_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category_id: string
          created_at?: string
          date?: string
          description: string
          id?: string
          item_id: string
          observation?: string | null
          parent_id?: string | null
          recurrence?: string | null
          sub_item_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          item_id?: string
          observation?: string | null
          parent_id?: string | null
          recurrence?: string | null
          sub_item_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_expense_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_expense_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fin_expense_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_expense_entries_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "fin_expense_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_expense_entries_sub_item_id_fkey"
            columns: ["sub_item_id"]
            isOneToOne: false
            referencedRelation: "fin_expense_sub_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_expense_items: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_expense_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_expense_sub_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_expense_sub_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "fin_expense_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_monthly_customers: {
        Row: {
          created_at: string
          customer_count: number
          id: string
          month_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_count?: number
          id?: string
          month_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_count?: number
          id?: string
          month_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_monthly_finance: {
        Row: {
          asset_purchases: number
          created_at: string
          electricity: number
          fixed_costs: number
          id: string
          month_key: string
          packaging: number
          revenue: number
          updated_at: string
          user_id: string
          variable_costs: number
          vehicle_expenses: number
          water: number
        }
        Insert: {
          asset_purchases?: number
          created_at?: string
          electricity?: number
          fixed_costs?: number
          id?: string
          month_key: string
          packaging?: number
          revenue?: number
          updated_at?: string
          user_id: string
          variable_costs?: number
          vehicle_expenses?: number
          water?: number
        }
        Update: {
          asset_purchases?: number
          created_at?: string
          electricity?: number
          fixed_costs?: number
          id?: string
          month_key?: string
          packaging?: number
          revenue?: number
          updated_at?: string
          user_id?: string
          variable_costs?: number
          vehicle_expenses?: number
          water?: number
        }
        Relationships: []
      }
      fin_patrimony_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      fin_patrimony_items: {
        Row: {
          category_id: string
          code: string
          created_at: string
          id: string
          location: string
          market_value: number
          name: string
          quantity: number
          sort_order: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          category_id: string
          code?: string
          created_at?: string
          id?: string
          location?: string
          market_value?: number
          name: string
          quantity?: number
          sort_order?: number
          updated_at?: string
          user_id: string
          year?: number
        }
        Update: {
          category_id?: string
          code?: string
          created_at?: string
          id?: string
          location?: string
          market_value?: number
          name?: string
          quantity?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_patrimony_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_patrimony_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_patrimony_maintenances: {
        Row: {
          cost: number
          created_at: string
          description: string
          id: string
          item_code: string
          maintenance_date: string
          responsible: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description: string
          id?: string
          item_code: string
          maintenance_date?: string
          responsible?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          id?: string
          item_code?: string
          maintenance_date?: string
          responsible?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_payables: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          supplier_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          supplier_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_products: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price: number
          unit: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price?: number
          unit?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price?: number
          unit?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_receivable_sales: {
        Row: {
          created_at: string
          id: string
          receivable_id: string
          sale_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          receivable_id: string
          sale_id: string
        }
        Update: {
          created_at?: string
          id?: string
          receivable_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_receivable_sales_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "fin_receivables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_receivable_sales_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_receivables: {
        Row: {
          amount: number
          category: string | null
          client_name: string | null
          created_at: string
          description: string
          due_date: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          client_name?: string | null
          created_at?: string
          description: string
          due_date: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          client_name?: string | null
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fin_salary_entries: {
        Row: {
          commission: number
          created_at: string
          employee_id: string
          id: string
          month_key: string
          salary: number
          updated_at: string
          user_id: string
        }
        Insert: {
          commission?: number
          created_at?: string
          employee_id: string
          id?: string
          month_key: string
          salary?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          commission?: number
          created_at?: string
          employee_id?: string
          id?: string
          month_key?: string
          salary?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_salary_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "fin_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_sales: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          month_key: string
          notes: string | null
          product_id: string | null
          quantity: number
          sale_date: string
          total: number
          unit_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          month_key: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sale_date?: string
          total?: number
          unit_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          month_key?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          sale_date?: string
          total?: number
          unit_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fin_products"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_transactions: {
        Row: {
          account: string | null
          amount: number
          category: string
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          origin_cash_flow_id: string | null
          payment_method: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account?: string | null
          amount: number
          category: string
          created_at?: string
          date?: string
          description: string
          id?: string
          notes?: string | null
          origin_cash_flow_id?: string | null
          payment_method?: string
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account?: string | null
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          origin_cash_flow_id?: string | null
          payment_method?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      fleet_maintenances: {
        Row: {
          cost: number
          created_at: string
          description: string | null
          id: string
          maintenance_date: string
          responsible: string | null
          service_type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          maintenance_date: string
          responsible?: string | null
          service_type: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          maintenance_date?: string
          responsible?: string | null
          service_type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_maintenances_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_vehicles: {
        Row: {
          active: boolean
          created_at: string
          id: string
          model: string | null
          name: string
          notes: string | null
          plate: string | null
          updated_at: string
          year: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          model?: string | null
          name: string
          notes?: string | null
          plate?: string | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          model?: string | null
          name?: string
          notes?: string | null
          plate?: string | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      freezer_maintenance: {
        Row: {
          created_at: string
          description: string
          freezer_id: string
          id: string
        }
        Insert: {
          created_at?: string
          description: string
          freezer_id: string
          id?: string
        }
        Update: {
          created_at?: string
          description?: string
          freezer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freezer_maintenance_freezer_id_fkey"
            columns: ["freezer_id"]
            isOneToOne: false
            referencedRelation: "freezers"
            referencedColumns: ["id"]
          },
        ]
      }
      freezers: {
        Row: {
          at_factory: boolean
          client_id: string | null
          contract_signed: boolean
          created_at: string
          freezer_type: string
          id: string
          notes: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          at_factory?: boolean
          client_id?: string | null
          contract_signed?: boolean
          created_at?: string
          freezer_type: string
          id?: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          at_factory?: boolean
          client_id?: string | null
          contract_signed?: boolean
          created_at?: string
          freezer_type?: string
          id?: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "freezers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          address: string | null
          client_name: string
          created_at: string
          id: string
          observations: string | null
          order_projection: string | null
          phone: string | null
          position: number
          region: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          client_name: string
          created_at?: string
          id?: string
          observations?: string | null
          order_projection?: string | null
          phone?: string | null
          position?: number
          region?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          client_name?: string
          created_at?: string
          id?: string
          observations?: string | null
          order_projection?: string | null
          phone?: string | null
          position?: number
          region?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_tables: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          price: number
          stock_quantity: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          price?: number
          stock_quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      route_client_items: {
        Row: {
          created_at: string
          id: string
          price_table_name: string
          product_id: string
          quantity: number
          route_client_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_table_name: string
          product_id: string
          quantity?: number
          route_client_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price_table_name?: string
          product_id?: string
          quantity?: number
          route_client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_client_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_client_items_route_client_id_fkey"
            columns: ["route_client_id"]
            isOneToOne: false
            referencedRelation: "route_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      route_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          observations: string | null
          position: number
          route_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          observations?: string | null
          position?: number
          route_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          observations?: string | null
          position?: number
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_clients_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          batch_number: string | null
          created_at: string
          driver_id: string | null
          id: string
          name: string
          period: string | null
          storage_note: string | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          batch_number?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          name: string
          period?: string | null
          storage_note?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          batch_number?: string | null
          created_at?: string
          driver_id?: string | null
          id?: string
          name?: string
          period?: string | null
          storage_note?: string | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          price_table_name: string | null
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          price_table_name?: string | null
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          price_table_name?: string | null
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          batch_number: string | null
          client_id: string | null
          client_name: string | null
          created_at: string
          driver_id: string | null
          driver_name: string | null
          id: string
          is_overdue: boolean
          is_paid: boolean | null
          observations: string | null
          order_number: number
          route_client_id: string | null
          route_id: string | null
          total: number
        }
        Insert: {
          batch_number?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          is_overdue?: boolean
          is_paid?: boolean | null
          observations?: string | null
          order_number?: number
          route_client_id?: string | null
          route_id?: string | null
          total?: number
        }
        Update: {
          batch_number?: string | null
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          is_overdue?: boolean
          is_paid?: boolean | null
          observations?: string | null
          order_number?: number
          route_client_id?: string | null
          route_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_route_client_id_fkey"
            columns: ["route_client_id"]
            isOneToOne: false
            referencedRelation: "route_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_entries: {
        Row: {
          created_at: string
          entry_date: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity: number
        }
        Update: {
          created_at?: string
          entry_date?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_losses: {
        Row: {
          created_at: string
          id: string
          loss_date: string
          product_id: string
          quantity: number
          reason: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          loss_date?: string
          product_id: string
          quantity: number
          reason?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          loss_date?: string
          product_id?: string
          quantity?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_losses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_approvals: {
        Row: {
          created_at: string
          email: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_tab_permissions: {
        Row: {
          created_at: string
          id: string
          tab: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tab: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tab?: string
          user_id?: string
        }
        Relationships: []
      }
      week_plan_items: {
        Row: {
          client_name: string
          contacted: boolean
          created_at: string
          day: string
          id: string
          notes: string | null
          position: number
          updated_at: string
        }
        Insert: {
          client_name: string
          contacted?: boolean
          created_at?: string
          day: string
          id?: string
          notes?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          client_name?: string
          contacted?: boolean
          created_at?: string
          day?: string
          id?: string
          notes?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_boleto_receivables: { Args: never; Returns: number }
      get_dashboard_stats: {
        Args: {
          p_selected_month: number
          p_selected_year: number
          p_today?: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "driver" | "supervisor"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "driver", "supervisor"],
    },
  },
} as const
