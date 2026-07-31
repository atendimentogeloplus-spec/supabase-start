import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type EmployeeType = "funcionario" | "socio" | "pj";

export interface Employee {
  id: string;
  name: string;
  address: string;
  birth_date: string | null;
  cpf: string;
  active: boolean;
  employee_type: EmployeeType;
}

export interface SalaryEntry {
  id: string;
  employee_id: string;
  month_key: string;
  salary: number;
  commission: number;
}

export interface Provisioning {
  salary: number;
  fgts: number;
  thirteenth: number;
  vacation: number;
  fgtsThirteenthVacation: number;
  total: number;
}

export function calculateProvisioning(salary: number, type: EmployeeType = "funcionario", commission: number = 0): Provisioning {
  const base = salary + commission;
  if (type === "socio" || type === "pj") {
    return { salary: base, fgts: 0, thirteenth: 0, vacation: 0, fgtsThirteenthVacation: 0, total: base };
  }
  const fgts = base * 0.08;
  const thirteenth = base / 12;
  const vacation = (base + base / 3) / 12;
  const fgtsThirteenthVacation = (thirteenth + vacation) * 0.08;
  const total = base + fgts + thirteenth + vacation + fgtsThirteenthVacation;
  return { salary: base, fgts, thirteenth, vacation, fgtsThirteenthVacation, total };
}

export function useEmployees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("fin_employees")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    if (data) {
      setEmployees(data.map((e: any) => ({
        id: e.id,
        name: e.name,
        address: e.address,
        birth_date: e.birth_date,
        cpf: e.cpf,
        active: e.active,
        employee_type: e.employee_type || "funcionario",
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  async function addEmployee(emp: Omit<Employee, "id" | "active">) {
    if (!user) return;
    await supabase.from("fin_employees").insert({
      user_id: user.id,
      name: emp.name,
      address: emp.address,
      birth_date: emp.birth_date || null,
      cpf: emp.cpf,
      employee_type: emp.employee_type,
    });
    fetchEmployees();
  }

  async function updateEmployee(id: string, emp: Partial<Employee>) {
    if (!user) return;
    await supabase.from("fin_employees").update(emp).eq("id", id).eq("user_id", user.id);
    fetchEmployees();
  }

  async function deleteEmployee(id: string) {
    if (!user) return;
    await supabase.from("fin_employees").delete().eq("id", id).eq("user_id", user.id);
    fetchEmployees();
  }

  return { employees, loading, addEmployee, updateEmployee, deleteEmployee, refetch: fetchEmployees };
}

export function useSalaryEntries(year: number) {
  const { user } = useAuth();
  const [entries, setEntries] = useState<SalaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("fin_salary_entries")
      .select("*")
      .eq("user_id", user.id)
      .like("month_key", `${year}-%`);
    if (data) {
      setEntries(data.map((e: any) => ({
        id: e.id,
        employee_id: e.employee_id,
        month_key: e.month_key,
        salary: Number(e.salary),
        commission: Number(e.commission || 0),
      })));
    }
    setLoading(false);
  }, [user, year]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  async function upsertEntry(employeeId: string, monthKey: string, salary: number, commission: number = 0) {
    if (!user) return;
    await supabase.from("fin_salary_entries").upsert({
      user_id: user.id,
      employee_id: employeeId,
      month_key: monthKey,
      salary,
      commission,
    }, { onConflict: "employee_id,month_key" });
    fetchEntries();
  }

  async function deleteEntry(id: string) {
    if (!user) return;
    await supabase.from("fin_salary_entries").delete().eq("id", id).eq("user_id", user.id);
    fetchEntries();
  }

  return { entries, loading, upsertEntry, deleteEntry, refetch: fetchEntries };
}
