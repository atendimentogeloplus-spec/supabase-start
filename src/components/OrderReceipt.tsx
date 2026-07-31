import { format } from "date-fns";
import logoGeloplus from "@/assets/logo-geloplus.jpg";
import pixQrCode from "@/assets/pix-qrcode.png";

interface ReceiptProps {
  data: {
    sale: { id: string; created_at: string; order_number?: number; batch_number?: string | null };
    client: {
      name: string;
      cpf_cnpj?: string | null;
      whatsapp?: string | null;
      contact?: string | null;
      address_street?: string | null;
      address_number?: string | null;
      address_neighborhood?: string | null;
      address_city?: string | null;
      address_state?: string | null;
      address_zip?: string | null;
      payment_type?: string | null;
    } | undefined;
    items: { product_name: string; quantity: number; unit_price: number; subtotal: number; price_table_name?: string }[];
    total: number;
    driverName?: string | null;
    observations?: string | null;
  };
}

export function OrderReceipt({ data }: ReceiptProps) {
  const { sale, client, items, total, driverName, observations } = data;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const isAvulso = client?.payment_type === "avulso";

  const formatPayment = (pt: string) => {
    const map: Record<string, string> = { avulso: "Avulso", mensal: "Mensal", quinzenal: "Quinzenal", semanal: "Semanal" };
    return map[pt] || pt;
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "200mm",
        margin: "0 auto",
        background: "#fff",
        padding: "4px 2px",
        color: "#111",
        fontSize: "19px",
        lineHeight: 1.35,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: "2px solid #333", paddingBottom: "6px", marginBottom: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <img src={logoGeloplus} alt="Gelo Plus" style={{ height: "56px", width: "auto", display: "block" }} />
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 2px", letterSpacing: "0.5px" }}>ESPELHO DE PEDIDO</p>
            <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>Rua Piranguinhos, 165, São Geraldo · 31 9 8860-3991</p>
          </div>
          {isAvulso && (
            <div style={{ textAlign: "center" }}>
              <img src={pixQrCode} alt="PIX" style={{ height: "90px", width: "90px", display: "block" }} />
              <p style={{ fontSize: "12px", fontWeight: 700, margin: "2px 0 0", color: "#000" }}>PIX</p>
            </div>
          )}
        </div>
      </div>

      {/* Info do pedido */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "18px", marginBottom: "6px", fontWeight: 700 }}>
        <span>Pedido: #{sale.order_number ?? sale.id.slice(0, 8).toUpperCase()}</span>
        {sale.batch_number && <span>Lote: {sale.batch_number}</span>}
        <span style={{ fontSize: "20px" }}>{format(new Date(sale.created_at), "dd/MM/yyyy")}</span>
      </div>

      {/* Cliente */}
      {client && (
        <div style={{ borderBottom: "1px solid #ccc", paddingBottom: "5px", marginBottom: "6px" }}>
          <p style={{ fontWeight: 700, fontSize: "19px", margin: 0 }}>
            {client.name}
            {client.cpf_cnpj ? ` — ${client.cpf_cnpj}` : ""}
          </p>
          {(client.address_street || client.address_number || client.address_neighborhood || client.address_city) && (
            <p style={{ fontSize: "16px", margin: "2px 0 0", color: "#222", fontWeight: 600 }}>
              {[client.address_street, client.address_number].filter(Boolean).join(", ")}
              {client.address_neighborhood ? ` · ${client.address_neighborhood}` : ""}
              {client.address_city ? ` · ${client.address_city}` : ""}
              {client.address_state ? `/${client.address_state}` : ""}
              {client.address_zip ? ` — ${client.address_zip}` : ""}
            </p>
          )}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "15px", marginTop: "3px", color: "#444" }}>
            {client.contact && <span><strong>Contato:</strong> {client.contact}</span>}
            {client.whatsapp && <span>WhatsApp: {client.whatsapp}</span>}
            {client.payment_type && <span style={{ fontWeight: 700 }}>Pagamento: {formatPayment(client.payment_type)}</span>}
          </div>
        </div>
      )}

      {/* Tabela de itens */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #333" }}>
            <th style={{ textAlign: "left", padding: "5px 6px", fontSize: "17px", fontWeight: 700 }}>Produto</th>
            <th style={{ textAlign: "left", padding: "5px 6px", fontSize: "17px", fontWeight: 700 }}>Tabela</th>
            <th style={{ textAlign: "center", padding: "5px 6px", fontSize: "17px", fontWeight: 700 }}>Qtd</th>
            <th style={{ textAlign: "right", padding: "5px 6px", fontSize: "17px", fontWeight: 700 }}>Unit.</th>
            <th style={{ textAlign: "right", padding: "5px 6px", fontSize: "17px", fontWeight: 700 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#f5f5f5" }}>
              <td style={{ padding: "5px 6px", fontSize: "18px", fontWeight: 700 }}>{item.product_name}</td>
              <td style={{ padding: "5px 6px", fontSize: "16px", color: "#444" }}>{item.price_table_name || "—"}</td>
              <td style={{ padding: "5px 6px", fontSize: "18px", textAlign: "center", fontWeight: 700 }}>{item.quantity}</td>
              <td style={{ padding: "5px 6px", fontSize: "17px", textAlign: "right" }}>R$ {item.unit_price.toFixed(2)}</td>
              <td style={{ padding: "5px 6px", fontSize: "17px", textAlign: "right", fontWeight: 700 }}>R$ {item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Resumo */}
      <div style={{ borderTop: "2px solid #333", marginTop: "5px", paddingTop: "5px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", marginBottom: "2px" }}>
          <span>Total de pacotes:</span>
          <strong>{totalQty}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "23px", fontWeight: 700, borderTop: "1px solid #ccc", paddingTop: "5px", marginTop: "3px" }}>
          <span>TOTAL</span>
          <span>R$ {total.toFixed(2)}</span>
        </div>
      </div>

      {/* Motorista */}
      {driverName && (
        <div style={{ marginTop: "5px", paddingTop: "4px", borderTop: "1px solid #ddd", fontSize: "16px", color: "#222" }}>
          <strong>Motorista:</strong> {driverName}
        </div>
      )}

      {/* Observações em linha separada */}
      {observations && (
        <div style={{ marginTop: "3px", paddingTop: "3px", borderTop: "1px solid #eee", fontSize: "16px", color: "#222" }}>
          <strong>Obs:</strong> {observations}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "6px", paddingTop: "4px", borderTop: "1px solid #ddd" }}>
        <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>Obrigado pela preferência!</p>
      </div>
    </div>
  );
}
