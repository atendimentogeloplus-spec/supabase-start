# LeadTrack - Sistema de Acompanhamento de Leads

Sistema web responsivo para gestão e acompanhamento de leads de uma equipe de vendas com
representantes internos e externos. O objetivo central é garantir **rastreabilidade total**:
todo lead tem um responsável, um histórico de interações e um motivo claro quando é perdido,
resolvendo o problema de "não saber o que foi feito com o lead".

## Stack

- **Backend**: Node.js 22 + Express, API REST.
- **Banco**: SQLite via módulo nativo `node:sqlite` (sem dependências nativas para compilar).
- **Autenticação**: sessão em cookie `HttpOnly` + `SameSite=Lax`, senha com `scrypt`.
- **Frontend**: SPA em JavaScript puro, CSS responsivo (mobile-first), sem etapa de build.
- **Servidor único**: o mesmo processo serve o frontend e a API na mesma porta.

## Requisitos

- Node.js **>= 22.5.0** (necessário para o `node:sqlite`).

## Como rodar

```bash
# Instalar dependências
npm install

# (Opcional) Criar arquivo de ambiente
cp .env.example .env

# Popular com dados de exemplo (apenas se o banco estiver vazio)
npm run seed:demo

# Iniciar o servidor
npm start
```

Acesse `http://localhost:3000`.

### Contas de demonstração

| Perfil                     | E-mail                    | Senha    |
|----------------------------|---------------------------|----------|
| Administrador              | admin@leadtrack.local     | admin123 |
| Representante interno      | carla@leadtrack.local     | senha123 |
| Representante externo      | joao@leadtrack.local      | senha123 |
| Pendente de aprovação      | paula@leadtrack.local     | senha123 |

> O administrador padrão também é criado automaticamente na primeira inicialização, mesmo sem
> rodar o seed. As credenciais vêm de `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (padrão
> `admin@leadtrack.local` / `admin123`). **Troque em produção.**

## Variáveis de ambiente

Definidas em `.env` (veja `.env.example`):

| Variável               | Descrição                                              | Padrão                  |
|------------------------|--------------------------------------------------------|-------------------------|
| `PORT`                 | Porta HTTP (frontend + API)                            | `3000`                  |
| `DB_PATH`              | Caminho do arquivo SQLite                              | `./data/leadtrack.db`   |
| `SESSION_SECRET`       | Reservado para assinatura/uso futuro da sessão         | -                       |
| `SEED_ADMIN_NAME`      | Nome do admin criado no bootstrap                      | `Administrador`         |
| `SEED_ADMIN_EMAIL`     | E-mail do admin criado no bootstrap                    | `admin@leadtrack.local` |
| `SEED_ADMIN_PASSWORD`  | Senha do admin criado no bootstrap                     | `admin123`              |

## Perfis e permissões

- **Admin**: acesso total. Vê todos os representantes e leads, reatribui leads, aprova/rejeita
  cadastros, define perfis, gerencia configurações e vê o painel completo.
- **Representante (interno ou externo)**: vê e gerencia apenas os leads atribuídos a ele.
  Registra interações, move etapas, cria leads e solicita ajuda ao admin. Interno e externo têm
  as mesmas permissões; a distinção serve para relatórios e filtros.

As regras de acesso são aplicadas no backend: consultas de representante são sempre filtradas por
`owner_id`, e tentativas de ler/escrever leads de terceiros retornam `403`.

## Fluxo de cadastro e aprovação

1. O usuário se cadastra (nome, e-mail, telefone, senha). A conta nasce como `pending`.
2. Enquanto pendente, o login é bloqueado e o usuário vê a tela "aguardando aprovação".
3. O admin recebe notificação no sino e aprova/rejeita na tela **Usuários**, definindo o perfil
   (Administrador / Representante Interno / Representante Externo).
4. O admin pode, a qualquer momento, desativar o usuário ou trocar o perfil. O sistema impede
   desativar o último administrador ativo e impede que o admin desative a própria conta.

## Instalação como aplicativo (PWA)

O sistema é um PWA instalável: pode ser adicionado à tela inicial e roda em tela cheia, sem barra
do navegador — útil para os representantes externos que usam o celular.

- **Android/Chrome**: aparece o botão "Instalar" no topo (ícone de download no mobile) ou use o
  menu do navegador em "Instalar aplicativo". O prompt nativo é capturado via `beforeinstallprompt`.
- **iPhone/iPad (Safari)**: como o iOS não dispara prompt automático, use o botão "Instalar
  aplicativo" na tela de login ou em "Minha conta" para ver o passo a passo (Compartilhar >
  Adicionar à Tela de Início).
- **Desktop**: botão "Instalar app" no topo, ao lado do sino.

Detalhes técnicos:

- `public/manifest.webmanifest` — nome, ícones (192/512 + maskable), `display: standalone`,
  cores e atalhos para Kanban, Leads e Notificações.
- `public/sw.js` — service worker com precache do shell (app abre offline) e estratégia
  *network-first* para navegação. **A API nunca é cacheada**, pois são dados privados por usuário.
- Ícones gerados por `scripts/generate-icons.js` (PNG escrito à mão, sem dependências externas);
  para regenerar: `npm run icons`.
- O `manifest` e o `sw.js` são servidos com `Content-Type` e `Cache-Control: no-cache` corretos.

> Requisito: o PWA precisa ser acessado via **HTTPS** (ou `localhost`) para o service worker ser
> registrado. A URL de preview já usa HTTPS.

## Senhas: troca, recuperação e reset

Como a primeira versão não envia e-mail, a recuperação funciona via administrador:

- **Trocar senha (usuário logado)**: clique no seu nome no topo ("Minha conta"), informe a senha
  atual e a nova. As demais sessões autenticadas do usuário são encerradas por segurança.
- **Esqueci minha senha (não consegue entrar)**: na tela de login, link "Esqueci minha senha".
  O usuário informa o e-mail e o administrador recebe uma notificação no sino. A resposta é sempre
  genérica, sem revelar se o e-mail existe (evita enumeração de usuários).
- **Reset pelo admin**: na tela **Usuários**, botão "Resetar senha" gera uma senha temporária
  exibida uma única vez (com botão de copiar). As sessões do usuário são encerradas e, no próximo
  login, ele é obrigado a definir uma nova senha antes de usar o sistema.

A troca de senha exige a senha atual, mínimo de 6 caracteres e impede reutilizar a senha atual.

## Gestão de leads

Campos: contato/empresa, telefone, e-mail, origem (configurável), responsável, status,
valor estimado (opcional), observações, datas de criação/atualização e última interação.

- Leads podem ser criados pelo admin (para qualquer representante, ou sem responsável) ou pelo
  representante (atribuído a si mesmo).
- O admin pode atribuir/reatribuir qualquer lead a qualquer representante, com notificação.

## Kanban e regras de negócio

Colunas padrão (todas ajustáveis em **Configurações**):

1. Novo lead
2. Primeiro contato feito
3. Em negociação *(exige ao menos 1 interação)*
4. Proposta enviada *(exige ao menos 1 interação)*
5. Fechado (ganho)
6. Perdido *(exige motivo da perda)*

Regras aplicadas no backend:

- Não é possível entrar em "Em negociação" ou etapas seguintes sem pelo menos um registro de
  interação.
- Mover para "Perdido" exige o preenchimento do **motivo da perda**.
- Ao registrar a primeira interação de um lead em "Novo lead", ele avança automaticamente para
  "Primeiro contato feito".
- Cada card mostra o tempo desde a última movimentação, com indicador visual: **verde** (em dia),
  **amarelo** (esfriando) e **vermelho** (parado há mais de X dias, X configurável).
- Arrastar e soltar entre colunas no desktop. No celular, o botão de mover (ou a tela de detalhe)
  permite trocar a etapa com um toque.

## Histórico de interações

Núcleo do sistema. Cada lead tem uma linha do tempo com:

- Data/hora automática, tipo (ligação, WhatsApp, e-mail, reunião, visita, outro), resumo livre e
  autor (usuário logado).

O admin vê o histórico completo de qualquer lead. Alterações de status e reatribuições também
ficam registradas em uma trilha de auditoria do lead.

## Painel do Admin

- Total de leads por status, por representante e por origem.
- **Leads parados há mais de X dias** (lista destacada, ordenada do mais crítico para o menos).
- Taxa de conversão geral e por representante.
- Filtro por período (data de criação) e por representante.

## Notificações

- Representante: ao receber um novo lead.
- Admin: novo cadastro pendente, lead parado além do prazo configurado e leads ganhos/perdidos.
- Solicitações de ajuda do representante chegam ao admin.

As notificações ficam no sino dentro do sistema. A verificação de leads parados roda na
inicialização e a cada 30 minutos, com deduplicação diária por lead.

## Estrutura do projeto

```text
server/
  index.js            Bootstrap do Express, rotas, agendador de leads parados
  db.js               Conexão SQLite, schema, migrations e seed
  auth.js             Hash de senha, sessões, cookies e middlewares de permissão
  notify.js           Criação de notificações
  util.js             Helpers de validação e datas
  routes/
    auth.js           Cadastro, login, logout, sessão
    users.js          Aprovação e gestão de usuários (admin)
    leads.js          Leads, status, interações, reatribuição e auditoria
    dashboard.js      Métricas do painel
    notifications.js  Listagem e leitura de notificações
    settings.js       Configurações, colunas do kanban e origens
public/
  index.html          Shell da SPA
  css/styles.css      Estilos responsivos
  js/                 Modulos da SPA (api, auth, kanban, leads, dashboard, usuarios, etc.)
scripts/
  seed-demo.js        Dados de exemplo
tests/
  app.test.js         Testes automatizados (unitarios + integracao)
data/                 Banco SQLite local (ignorado pelo git)
```

## Banco de dados

- `users` - usuários com `role` e `status` de aprovação.
- `leads` - leads com `owner_id` (responsável), `status`, `loss_reason`, timestamps.
- `interactions` - interações com `lead_id`, `user_id`, tipo e resumo.
- `lead_audit` - trilha de auditoria (criação, status, atribuição, interações, ajuda).
- `kanban_columns` - colunas configuráveis com regras (`min_interactions`, `requires_loss`).
- `sources` - origens de lead configuráveis.
- `notifications` - notificações com deduplicação opcional.
- `sessions` - sessões de login.
- `settings` - chave/valor (dias de alerta, nome da empresa, etc.).

O schema é criado automaticamente na inicialização (`CREATE TABLE IF NOT EXISTS`).

## API (resumo)

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `POST /api/auth/change-password`, `POST /api/auth/forgot-password`
- `POST /api/users/:id/reset-password`
- `GET /api/users`, `GET /api/users/representatives`, `PATCH /api/users/:id`,
  `POST /api/users/:id/approve`, `POST /api/users/:id/reject`
- `GET/POST /api/leads`, `GET/PATCH /api/leads/:id`, `POST /api/leads/:id/assign`,
  `POST /api/leads/:id/status`, `POST /api/leads/:id/request-assistance`
- `GET/POST /api/leads/:id/interactions`, `GET /api/leads/:id/audit`
- `GET /api/dashboard`
- `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all`
- `GET/PATCH /api/settings`, `POST/PATCH /api/settings/columns`, `POST /api/settings/columns/reorder`,
  `POST/PATCH /api/settings/sources`

## Testes

```bash
npm test
```

Cobrem hash de senha, migrations/seed, rollback de transação, o fluxo completo
(cadastro -> aprovação -> lead -> kanban -> permissões) e o agendador de leads parados.

## Notas de produção

- Troque as credenciais do administrador e defina `SESSION_SECRET`.
- Sirva atrás de HTTPS e habilite o atributo `Secure` no cookie de sessão.
- Para volumes maiores, considere migrar de SQLite para PostgreSQL; a camada de acesso está
  concentrada em `server/db.js`.
