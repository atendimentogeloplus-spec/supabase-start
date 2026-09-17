'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, '.env'));

const { db, migrate, seed, bootstrapAdmin } = require('../server/db');
const { hashPassword } = require('../server/auth');

migrate();
seed();
bootstrapAdmin();

const force = process.argv.includes('--force');
const existing = db.prepare('SELECT COUNT(*) AS n FROM leads').get().n;
if (existing > 0 && !force) {
  console.log(`Banco ja possui ${existing} lead(s). Use --force para adicionar dados de exemplo mesmo assim.`);
  process.exit(0);
}

const now = Date.now();
const iso = (daysAgo, hour = 10) => {
  const d = new Date(now - daysAgo * 86400000);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function upsertUser(name, email, role, status, phone) {
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) return existingUser.id;
  const info = db.prepare(`
    INSERT INTO users (name,email,password_hash,phone,role,status,approved_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(name, email, hashPassword('senha123'), phone, role, status,
    status === 'active' ? iso(20) : null, iso(21), iso(21));
  return info.lastInsertRowid;
}

const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
const adminId = admin ? admin.id : null;

const carla = upsertUser('Carla Mendes', 'carla@leadtrack.local', 'rep_internal', 'active', '(11) 98888-1111');
const joao = upsertUser('Joao Souza', 'joao@leadtrack.local', 'rep_external', 'active', '(21) 97777-2222');
const paula = upsertUser('Paula Lima', 'paula@leadtrack.local', 'rep_external', 'pending', '(31) 96666-3333');

// Espelha a notificacao que o endpoint de cadastro cria para os administradores.
for (const admin of db.prepare("SELECT id FROM users WHERE role = 'admin' AND status = 'active'").all()) {
  db.prepare(`INSERT OR IGNORE INTO notifications (user_id,type,title,body,dedupe_key,created_at)
              VALUES (?,?,?,?,?,?)`).run(
    admin.id, 'user_pending', 'Novo cadastro aguardando aprovacao',
    'Paula Lima (paula@leadtrack.local) solicitou acesso ao sistema.',
    `user_pending:${paula}`, iso(21)
  );
}

const sources = db.prepare('SELECT id,name FROM sources').all();
const src = (name) => {
  const found = sources.find((s) => s.name.toLowerCase() === name.toLowerCase());
  return found ? found.id : (sources[0] ? sources[0].id : null);
};

const columnByKey = (key) => db.prepare('SELECT * FROM kanban_columns WHERE key = ?').get(key);

let leadCount = 0;

function addLead(data) {
  const info = db.prepare(`
    INSERT INTO leads (contact_name,company,phone,email,source_id,owner_id,status,estimated_value,notes,loss_reason,created_by,created_at,updated_at,last_interaction_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    data.contact, data.company, data.phone, data.email, data.sourceId, data.ownerId, data.status,
    data.value, data.notes || null, data.lossReason || null, adminId,
    data.createdAt, data.updatedAt, data.lastInteractionAt || null
  );
  leadCount++;
  return info.lastInsertRowid;
}

function addInteraction(leadId, userId, type, summary, at) {
  db.prepare('INSERT INTO interactions (lead_id,user_id,type,summary,created_at) VALUES (?,?,?,?,?)')
    .run(leadId, userId, type, summary, at);
}

// 1. Carla - em negociacao, ativo
let id = addLead({
  contact: 'Construtora Horizonte', company: 'Horizonte Engenharia', phone: '(11) 3456-7890',
  email: 'contato@horizonte.com.br', sourceId: src('Indicacao'), ownerId: carla,
  status: 'negotiation', value: 45000, notes: 'Interesse em pacote anual.',
  createdAt: iso(12), updatedAt: iso(2), lastInteractionAt: iso(2)
});
addInteraction(id, carla, 'call', 'Liguei para o diretor; pediu proposta detalhada.', iso(8));
addInteraction(id, carla, 'meeting', 'Reuniao na sede; definimos escopo inicial.', iso(2));

// 2. Carla - novo, parado (10 dias)
id = addLead({
  contact: 'Padaria Bom Pao', company: 'Bom Pao Alimentos', phone: '(11) 2222-1010',
  email: 'bompao@email.com', sourceId: src('Site'), ownerId: carla,
  status: 'new', value: 3500, notes: 'Lead vindo do formulario do site.',
  createdAt: iso(10), updatedAt: iso(10)
});

// 3. Carla - proposta enviada
id = addLead({
  contact: 'Tech Solutions Ltda', company: 'Tech Solutions', phone: '(11) 4002-8922',
  email: 'compras@techsolutions.io', sourceId: src('Redes sociais'), ownerId: carla,
  status: 'proposal', value: 28000, notes: 'Aguardando retorno do financeiro.',
  createdAt: iso(9), updatedAt: iso(1), lastInteractionAt: iso(1)
});
addInteraction(id, carla, 'email', 'Enviei proposta comercial revisada.', iso(4));
addInteraction(id, carla, 'whatsapp', 'Cliente confirmou recebimento da proposta.', iso(1));

// 4. Carla - ganho
id = addLead({
  contact: 'Mercado Central', company: 'Central Distribuidora', phone: '(11) 3333-2020',
  email: 'gerencia@central.com', sourceId: src('Evento'), ownerId: carla,
  status: 'won', value: 12000, notes: 'Contrato assinado por 12 meses.',
  createdAt: iso(25), updatedAt: iso(0), lastInteractionAt: iso(0)
});
addInteraction(id, carla, 'visit', 'Visita tecnica para levantamento.', iso(15));
addInteraction(id, carla, 'email', 'Enviei minuta do contrato.', iso(6));
addInteraction(id, carla, 'meeting', 'Reuniao de fechamento; contrato assinado.', iso(0));

// 5. Joao - primeiro contato, parado (15 dias)
id = addLead({
  contact: 'Clinica Vida', company: 'Vida Saude', phone: '(21) 2555-8080',
  email: 'contato@clinicavida.com', sourceId: src('Prospeccao ativa'), ownerId: joao,
  status: 'first_contact', value: 9000, notes: 'Retornar apos ferias do responsavel.',
  createdAt: iso(20), updatedAt: iso(15), lastInteractionAt: iso(15)
});
addInteraction(id, joao, 'call', 'Primeiro contato; agendar retorno em duas semanas.', iso(15));

// 6. Joao - perdido
id = addLead({
  contact: 'Auto Pecas Silva', company: 'Silva Auto Pecas', phone: '(21) 2444-7070',
  email: 'silva@autopecas.com', sourceId: src('Indicacao'), ownerId: joao,
  status: 'lost', value: 7000, notes: 'Retomar no proximo semestre.',
  lossReason: 'Cliente fechou com concorrente por preco.', createdAt: iso(30),
  updatedAt: iso(5), lastInteractionAt: iso(5)
});
addInteraction(id, joao, 'whatsapp', 'Enviei orcamento.', iso(12));
addInteraction(id, joao, 'call', 'Cliente informou que fechou com concorrente.', iso(5));

// 7. Joao - novo, parado (8 dias)
id = addLead({
  contact: 'Escola Aprender', company: 'Colegio Aprender', phone: '(21) 2333-6060',
  email: 'direcao@escolaaprender.edu', sourceId: src('Site'), ownerId: joao,
  status: 'new', value: null, notes: 'Contato inicial ainda nao realizado.',
  createdAt: iso(8), updatedAt: iso(8)
});

// 8. Joao - em negociacao recente
id = addLead({
  contact: 'Restaurante Sabor', company: 'Sabor Gastronomia', phone: '(21) 2666-5050',
  email: 'reservas@saborgastro.com', sourceId: src('Redes sociais'), ownerId: joao,
  status: 'negotiation', value: 8000, notes: 'Negociando condicoes de pagamento.',
  createdAt: iso(11), updatedAt: iso(0), lastInteractionAt: iso(0)
});
addInteraction(id, joao, 'meeting', 'Apresentei a solucao ao proprietario.', iso(11));
addInteraction(id, joao, 'call', 'Negociando prazo de implantacao.', iso(0));

// 9. Sem responsavel (para o admin atribuir)
addLead({
  contact: 'Distribuidora Norte', company: 'Norte Log', phone: '(91) 3222-4040',
  email: 'contato@nortelog.com', sourceId: src('Indicacao'), ownerId: null,
  status: 'new', value: 15000, notes: 'Lead sem responsavel, precisa ser distribuido.',
  createdAt: iso(3), updatedAt: iso(3)
});

const cols = db.prepare('SELECT COUNT(*) AS n FROM kanban_columns').get().n;
console.log('Dados de exemplo criados com sucesso.');
console.log(`  Leads: ${leadCount}`);
console.log(`  Colunas do kanban: ${cols}`);
console.log('');
console.log('Contas para teste:');
console.log('  Admin:                  admin@leadtrack.local / admin123');
console.log('  Representante interno:  carla@leadtrack.local / senha123');
console.log('  Representante externo:  joao@leadtrack.local / senha123');
console.log('  Pendente de aprovacao:  paula@leadtrack.local / senha123');
