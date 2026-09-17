'use strict';

const Kanban = (() => {
  let draggedId = null;

  function columns() {
    return (State.columns && State.columns.length) ? State.columns : [];
  }

  function card(lead, showOwner) {
    const level = UI.stallLevel(lead.days_stalled, State.config.stalled_days);
    const owner = showOwner
      ? `<span title="${UI.esc(lead.owner_name || 'Sem responsavel')}"><span class="owner-avatar">${UI.initials(lead.owner_name || '?')}</span> ${UI.esc(lead.owner_name || 'Sem resp.')}</span>`
      : '';
    const value = lead.estimated_value ? `<span class="lc-value">${UI.currency(lead.estimated_value)}</span>` : '';
    return `
      <div class="lead-card" draggable="true" data-lead="${lead.id}" style="border-left-color:${UI.esc(lead.status_color || '#64748b')}">
        <button class="lc-move" data-move="${lead.id}" title="Mover lead" aria-label="Mover lead">&#8942;</button>
        <div class="lc-name">${UI.esc(lead.contact_name)}</div>
        ${lead.company ? `<div class="lc-company">${UI.esc(lead.company)}</div>` : ''}
        <div class="lc-meta">
          <span class="pill ${level}"><span class="badge-dot ${level}"></span> ${UI.daysLabel(lead.days_stalled)}</span>
          ${owner}
          ${value}
          <span title="Interacoes registradas">${lead.interaction_count} inter.</span>
        </div>
        ${lead.is_lost && lead.loss_reason ? `<div class="lc-company" title="Motivo da perda">Motivo: ${UI.esc(lead.loss_reason)}</div>` : ''}
      </div>`;
  }

  async function render(view) {
    App.loading(view);
    const isAdmin = State.user.role === 'admin';
    let repOptions = [];
    if (isAdmin) {
      const reps = await Api.get('/api/users/representatives');
      repOptions = reps.representatives;
    }
    const ownerParam = isAdmin ? (State.filterOwner || 'all') : String(State.user.id);

    const query = new URLSearchParams({ limit: '1000' });
    if (isAdmin && ownerParam !== 'all') query.set('owner_id', ownerParam);
    const data = await Api.get('/api/leads?' + query.toString());
    const leads = data.leads;

    const ownerFilter = isAdmin ? `
      <select id="kb-owner" title="Filtrar por representante">
        <option value="all">Todos os representantes</option>
        ${UI.options(repOptions, ownerParam, 'id', 'name')}
      </select>` : '';

    view.innerHTML = `
      ${App.pageHead('Kanban de leads', `
        ${ownerFilter}
        <button class="btn secondary sm" id="kb-refresh">Atualizar</button>
        <button class="btn sm" id="kb-new">${UI.icon('plus')} Novo lead</button>
      `)}
      <div class="legend mb">
        <span><span class="badge-dot green"></span> em dia</span>
        <span><span class="badge-dot amber"></span> esfriando</span>
        <span><span class="badge-dot red"></span> parado ha ${State.config.stalled_days}+ dias</span>
      </div>
      <div class="kanban" id="kanban"></div>
    `;

    view.querySelector('#kb-refresh').onclick = () => render(view);
    view.querySelector('#kb-new').onclick = () => Leads.openForm({ onSaved: () => render(view) });
    const ownerSel = view.querySelector('#kb-owner');
    if (ownerSel) ownerSel.onchange = () => { State.filterOwner = ownerSel.value; render(view); };

    const board = view.querySelector('#kanban');
    const cols = columns();
    if (!cols.length) {
      board.innerHTML = `<div class="panel">Nenhuma coluna configurada.</div>`;
      return;
    }

    for (const col of cols) {
      const items = leads.filter((l) => l.status === col.key);
      const colEl = document.createElement('div');
      colEl.className = 'kanban-col';
      colEl.dataset.status = col.key;
      colEl.innerHTML = `
        <div class="kanban-col-head" style="background:${UI.esc(col.color || '#64748b')}">
          <span>${UI.esc(col.label)}</span><span class="count">${items.length}</span>
        </div>
        <div class="kanban-col-body" data-drop="${col.key}">
          ${items.length
            ? items.map((l) => card(l, isAdmin)).join('')
            : '<div class="kanban-empty">Solte um lead aqui</div>'}
        </div>`;
      board.appendChild(colEl);
    }

    attachDnD(board, view);
    board.onclick = (e) => {
      const moveBtn = e.target.closest('[data-move]');
      if (moveBtn) {
        e.stopPropagation();
        openMoveSheet(Number(moveBtn.dataset.move), leads, view);
        return;
      }
      const cardEl = e.target.closest('[data-lead]');
      if (cardEl) location.hash = `#/leads/${cardEl.dataset.lead}`;
    };
  }

  function attachDnD(board, view) {
    board.querySelectorAll('.lead-card').forEach((c) => {
      c.addEventListener('dragstart', (e) => {
        draggedId = Number(c.dataset.lead);
        e.dataTransfer.setData('text/plain', c.dataset.lead);
        e.dataTransfer.effectAllowed = 'move';
        c.classList.add('dragging');
      });
      c.addEventListener('dragend', () => {
        c.classList.remove('dragging');
        draggedId = null;
        board.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
      });
    });

    board.querySelectorAll('[data-drop]').forEach((zone) => {
      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.parentElement.classList.add('drop-target');
      });
      zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) zone.parentElement.classList.remove('drop-target');
      });
      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.parentElement.classList.remove('drop-target');
        const raw = e.dataTransfer.getData('text/plain');
        const id = Number(raw || draggedId);
        const status = zone.dataset.drop;
        if (!id) return;
        await moveLead(id, status, view);
      });
    });
  }

  function findLead(leads, id) {
    return leads.find((l) => l.id === id);
  }

  function findColumn(key) {
    return columns().find((c) => c.key === key);
  }

  async function moveLead(id, status, view, lossReason) {
    const col = findColumn(status);
    if (!col) return;
    try {
      await Api.post(`/api/leads/${id}/status`, { status, loss_reason: lossReason });
      UI.toast(`Lead movido para "${col.label}".`, 'success');
      render(view);
      App.loadNotifications();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  function openMoveSheet(id, leads, view) {
    const lead = findLead(leads, id);
    if (!lead) return;
    const current = findColumn(lead.status);
    const list = columns().map((c) => `
      <button class="btn ${c.key === lead.status ? '' : 'secondary'} block" data-target="${UI.esc(c.key)}"
        style="justify-content:flex-start; margin-bottom:8px; ${c.key === lead.status ? 'opacity:.7' : ''}">
        <span class="badge-dot" style="background:${UI.esc(c.color)}"></span> ${UI.esc(c.label)}
        ${c.key === lead.status ? '<span class="small">(atual)</span>' : ''}
      </button>`).join('');
    const m = UI.modal({
      title: `Mover: ${lead.contact_name}`,
      body: `<div class="small muted mb">Etapa atual: <b>${UI.esc(current ? current.label : lead.status)}</b></div>${list}`
    });
    m.body.querySelectorAll('[data-target]').forEach((btn) => {
      btn.onclick = async () => {
        const target = btn.dataset.target;
        const col = findColumn(target);
        m.close();
        if (col && col.requires_loss) {
          const reason = await reasonPrompt(lead.contact_name);
          if (!reason) return;
          moveLead(id, target, view, reason);
        } else {
          moveLead(id, target, view);
        }
      };
    });
  }

  function reasonPrompt(name) {
    return new Promise((resolve) => {
      const form = document.createElement('form');
      form.innerHTML = `
        <p class="mb">Informe o motivo da perda do lead <b>${UI.esc(name)}</b>.</p>
        <div class="field">
          <textarea id="loss-reason" placeholder="Ex.: preco acima do orcamento, concorrente escolhido..." required></textarea>
        </div>`;
      const m = UI.modal({
        title: 'Motivo da perda',
        body: form,
        footer: `<button class="btn secondary" data-act="cancel">Cancelar</button>
                 <button class="btn danger" data-act="ok" form="loss-form">Confirmar perda</button>`
      });
      const confirmBtn = m.foot.querySelector('[data-act="ok"]');
      confirmBtn.onclick = () => {
        const value = form.querySelector('#loss-reason').value.trim();
        if (!value) { UI.toast('O motivo da perda e obrigatorio.', 'error'); return; }
        m.close();
        resolve(value);
      };
      m.foot.querySelector('[data-act="cancel"]').onclick = () => { m.close(); resolve(null); };
    });
  }

  return { render, reasonPrompt };
})();
