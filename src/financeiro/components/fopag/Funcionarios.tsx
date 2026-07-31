import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEmployees, EmployeeType } from "@/financeiro/lib/fopag-store";
import { Plus, Pencil, Trash2, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Funcionarios() {
  const { employees, loading, addEmployee, updateEmployee, deleteEmployee } = useEmployees();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", birth_date: "", cpf: "", employee_type: "funcionario" as EmployeeType });

  function resetForm() {
    setForm({ name: "", address: "", birth_date: "", cpf: "", employee_type: "funcionario" });
    setShowForm(false);
    setEditId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }

    if (editId) {
      await updateEmployee(editId, {
        name: form.name,
        address: form.address,
        birth_date: form.birth_date || null,
        cpf: form.cpf,
        employee_type: form.employee_type,
      });
      toast.success("Cadastro atualizado");
    } else {
      await addEmployee({
        name: form.name,
        address: form.address,
        birth_date: form.birth_date || null,
        cpf: form.cpf,
        employee_type: form.employee_type,
      });
      toast.success("Cadastro realizado");
    }
    resetForm();
  }

  function startEdit(emp: typeof employees[0]) {
    setEditId(emp.id);
    setForm({
      name: emp.name,
      address: emp.address,
      birth_date: emp.birth_date || "",
      cpf: emp.cpf,
      employee_type: emp.employee_type,
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    await deleteEmployee(id);
    toast.success("Removido");
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Funcionários e Sócios</h2>
        {!showForm && (
          <Button onClick={() => { resetForm(); setShowForm(true); }} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Cadastro
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle>{editId ? "Editar" : "Novo"} Cadastro</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select value={form.employee_type} onValueChange={(v) => setForm(f => ({ ...f, employee_type: v as EmployeeType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="pj">PJ</SelectItem>
                    <SelectItem value="socio">Sócio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm(f => ({ ...f, cpf: e.target.value }))} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => setForm(f => ({ ...f, birth_date: e.target.value }))} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Endereço completo" />
              </div>
              <div className="col-span-full flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                <Button type="submit"><Check className="h-4 w-4 mr-1" /> {editId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">CPF</TableHead>
                <TableHead className="hidden md:table-cell">Nascimento</TableHead>
                <TableHead className="hidden lg:table-cell">Endereço</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cadastro encontrado</TableCell></TableRow>
              ) : employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell>
                    <Badge variant={emp.employee_type === "socio" ? "secondary" : emp.employee_type === "pj" ? "outline" : "default"}>
                      {emp.employee_type === "socio" ? "Sócio" : emp.employee_type === "pj" ? "PJ" : "Funcionário"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{emp.cpf || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {emp.birth_date ? new Date(emp.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{emp.address || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(emp)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
