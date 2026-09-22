'use strict';

const Leads = (() => {
  const filters = { q: '', status: '', source_id: '', owner_id: 'all', stalled: false, from: '', to: '' };

  function statusPill(lead) {
    const color = lead.status_color || '#64748b';
    return `<span class="pill" style="background:${UI.esc(color)}1f; color:${UI.esc(color)}; border:1px solid ${UI.esc(color)}40">${UI.esc(lead.status_label || lead.status)}</span>`;
  }

  function stallCell(lead) {
    const level = UI.stallLevel(lead.days_stalled, State.config.stalled_days);
    return `<span class="pill ${level}"><span class="badge-dot ${level}"></span> ${UI.daysLabel(lead.days_stalled)}</span>`;
  }

  async function ensureSources() {
    if (State.sources && State.sources.length) return State.sources;
    try {
      const data = await Api.get('/api/settings');
      State.sources = data.sources || [];
    } catch { State.sources = []; }
    return State.sources;
  }

  async function renderList(view) {
    App.loading(view);
    const isAdmin = State.user.role === 'admin';
    await ensureSources();
    let reps = [];
    if (isAdmin) {
      try { reps = (await Api.get('/api/users/representatives')).representatives; } catch { reps = []; }
    }

    const params = new URLSearchParams({ limit: '1000' });
    if (filters.q) params.set('q', filters.q);
    if (filters.status) params.set('status', filters.status);
    if (filters.source_id) params.set('source_id', filters.source_id);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.stalled) params.set('stalled', '1');
    if (isAdmin && filters.owner_id !== 'all') params.set('owner_id', filters.owner_id);

    const data = await Api.get('/api/leads?' + params.toString());
    const leads = data.leads;

    const statusOpts = [{ value: '', label: 'Todas as etapas' }]
      .concat(State.columns.map((c) => ({ value: c.key, label: c.label })));
    const sourceOpts = [{ value: '', label: 'Todas as origens' }]
      .concat(State.sources.map((s) => ({ value: s.id, label: s.name })));

    view.innerHTML = `
      ${App.pageHead('Leads', `
        <button class="btn secondary sm" id="ld-pdf" ${leads.length ? '' : 'disabled'}>${UI.icon('download')} Exportar para pdf</button>
        <button class="btn sm" id="ld-new">${UI.icon('plus')} Novo lead</button>
      `)}
      <div class="panel">
        <div class="toolbar">
          <input class="search" id="ld-q" placeholder="Buscar por contato, empresa, e-mail ou telefone" value="${UI.esc(filters.q)}">
          <select id="ld-status">${UI.options(statusOpts, filters.status)}</select>
          <select id="ld-source">${UI.options(sourceOpts, filters.source_id)}</select>
          ${isAdmin ? `<select id="ld-owner"><option value="all">Todos os representantes</option>${UI.options(reps, filters.owner_id, 'id', 'name')}</select>` : ''}
          <input type="date" id="ld-from" value="${UI.esc(filters.from)}" title="Criado de">
          <input type="date" id="ld-to" value="${UI.esc(filters.to)}" title="Criado ate">
           <label class="flex small nowrap" style="margin:0"><input type="checkbox" id="ld-stalled" style="width:auto" ${filters.stalled ? 'checked' : ''}> Somente parados</label>
           <button class="btn secondary sm" id="ld-clear">Limpar</button>
         </div>
         <div class="flex small muted mb">${leads.length} lead(s) encontrado(s)</div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr>
              <th>Contato</th><th>Empresa</th><th>Contato</th>${isAdmin ? '<th>Responsavel</th>' : ''}
              <th>Etapa</th><th>Valor</th><th>Parado ha</th><th>Inter.</th>
            </tr></thead>
            <tbody id="ld-rows"></tbody>
          </table>
        </div>
      </div>
    `;

    const tbody = view.querySelector('#ld-rows');
    if (!leads.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><h3>Nenhum lead encontrado</h3><p>Ajuste os filtros ou cadastre um novo lead.</p></div></td></tr>`;
    } else {
      tbody.innerHTML = leads.map((l) => `
        <tr data-lead="${l.id}" style="cursor:pointer">
          <td><b>${UI.esc(l.contact_name)}</b></td>
          <td>${UI.esc(l.company || '-')}</td>
          <td class="small">${UI.esc(l.phone || '')}${l.phone && l.email ? '<br>' : ''}${UI.esc(l.email || '') || (!l.phone ? '-' : '')}</td>
          ${isAdmin ? `<td>${l.owner_name ? UI.esc(l.owner_name) : '<span class="muted">Sem resp.</span>'}</td>` : ''}
          <td>${statusPill(l)}</td>
          <td class="nowrap">${l.estimated_value ? UI.currency(l.estimated_value) : '-'}</td>
          <td>${stallCell(l)}</td>
          <td>${l.interaction_count}</td>
        </tr>`).join('');
    }

    tbody.onclick = (e) => {
      const tr = e.target.closest('[data-lead]');
      if (tr) location.hash = `#/leads/${tr.dataset.lead}`;
    };

    const apply = () => {
      filters.q = view.querySelector('#ld-q').value.trim();
      filters.status = view.querySelector('#ld-status').value;
      filters.source_id = view.querySelector('#ld-source').value;
      filters.from = view.querySelector('#ld-from').value;
      filters.to = view.querySelector('#ld-to').value;
      filters.stalled = view.querySelector('#ld-stalled').checked;
      const ownerSel = view.querySelector('#ld-owner');
      if (ownerSel) filters.owner_id = ownerSel.value;
      renderList(view);
    };

    let listSearchTimer = null;
    view.querySelector('#ld-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    view.querySelector('#ld-q').addEventListener('input', () => {
      clearTimeout(listSearchTimer);
      listSearchTimer = setTimeout(apply, 180);
    });
    ['#ld-status', '#ld-source', '#ld-from', '#ld-to', '#ld-stalled'].forEach((sel) => {
      view.querySelector(sel).addEventListener('change', apply);
    });
    const ownerSel = view.querySelector('#ld-owner');
    if (ownerSel) ownerSel.addEventListener('change', apply);
    view.querySelector('#ld-clear').onclick = () => {
      Object.assign(filters, { q: '', status: '', source_id: '', owner_id: 'all', stalled: false, from: '', to: '' });
      renderList(view);
    };
    view.querySelector('#ld-new').onclick = () => openForm({ onSaved: () => renderList(view) });
    const pdfBtn = view.querySelector('#ld-pdf');
    if (pdfBtn) pdfBtn.onclick = () => exportPdf(leads, { isAdmin, reps });
  }

  function filterSummary(reps) {
    const parts = [];
    if (filters.q) parts.push('Busca: ' + filters.q);
    if (filters.status) {
      const col = (State.columns || []).find((c) => c.key === filters.status);
      parts.push('Etapa: ' + (col ? col.label : filters.status));
    }
    if (filters.source_id) {
      const src = (State.sources || []).find((s) => String(s.id) === String(filters.source_id));
      parts.push('Origem: ' + (src ? src.name : filters.source_id));
    }
    if (filters.owner_id && filters.owner_id !== 'all') {
      const rep = (reps || []).find((r) => String(r.id) === String(filters.owner_id));
      parts.push('Representante: ' + (rep ? rep.name : filters.owner_id));
    }
    if (filters.from) parts.push('De: ' + filters.from.split('-').reverse().join('/'));
    if (filters.to) parts.push('Ate: ' + filters.to.split('-').reverse().join('/'));
    if (filters.stalled) parts.push('Somente parados');
    return parts.length ? parts.join('  |  ') : 'Nenhum filtro aplicado (todos os leads visiveis)';
  }

  function exportPdf(leads, { isAdmin, reps }) {
    if (!leads || !leads.length) {
      UI.toast('Nenhum lead para exportar com os filtros atuais.', 'error');
      return;
    }
    const company = (State.config && State.config.company_name) || 'LeadTrack';
    const generated = UI.fmtDateTime(new Date().toISOString());
    const summary = filterSummary(reps);
    const totalValue = leads.reduce((acc, l) => acc + (Number(l.estimated_value) || 0), 0);

    const rows = leads.map((l, i) => {
      const contact = [l.phone, l.email].filter(Boolean).join(' / ') || '-';
      return `<tr>
        <td>${i + 1}</td>
        <td>${UI.esc(l.contact_name)}</td>
        <td>${UI.esc(l.company || '-')}</td>
        <td>${UI.esc(contact)}</td>
        ${isAdmin ? `<td>${UI.esc(l.owner_name || 'Sem resp.')}</td>` : ''}
        <td>${UI.esc(l.status_label || l.status)}</td>
        <td class="num">${l.estimated_value ? UI.esc(UI.currency(l.estimated_value)) : '-'}</td>
        <td>${UI.esc(UI.daysLabel(l.days_stalled))}</td>
        <td class="num">${UI.esc(l.interaction_count)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Leads - ${UI.esc(company)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #64748b; margin-bottom: 10px; line-height: 1.45; }
    .meta b { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #eef2ff; font-size: 10px; text-transform: uppercase; letter-spacing: .02em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .num { text-align: right; white-space: nowrap; }
    .foot { margin-top: 10px; color: #64748b; display: flex; justify-content: space-between; }
    @media print { .no-print { display: none !important; } }
    .no-print { margin-bottom: 12px; }
    .no-print button {
      background: #4f46e5; color: #fff; border: 0; border-radius: 6px;
      padding: 8px 14px; font-weight: 600; cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="no-print"><button type="button" onclick="window.print()">Salvar / imprimir PDF</button></div>
  <h1>${UI.esc(company)} - Relatorio de leads</h1>
  <div class="meta">
    Gerado em ${UI.esc(generated)} por ${UI.esc(State.user.name)}<br>
    Filtros: ${UI.esc(summary)}<br>
    <b>${leads.length}</b> lead(s)  |  Valor estimado total: <b>${UI.esc(UI.currency(totalValue) || 'R$ 0,00')}</b>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Contato</th>
        <th>Empresa</th>
        <th>Telefone / E-mail</th>
        ${isAdmin ? '<th>Responsavel</th>' : ''}
        <th>Etapa</th>
        <th>Valor</th>
        <th>Parado ha</th>
        <th>Inter.</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">
    <span>LeadTrack - acompanhamento de leads</span>
    <span>${leads.length} registro(s)</span>
  </div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 250); });<\/script>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) {
      UI.toast('Permita pop-ups neste site para exportar o PDF.', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  function firstName(name) {
    const parts = String(name || '').trim().split(/\s+/);
    return parts[0] || name || '';
  }

  function whatsappDigits(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length >= 12 && digits.startsWith('55')) return digits;
    if (digits.length >= 10 && digits.length <= 11) return '55' + digits;
    return digits;
  }

  function offerWhatsAppNotify(lead, reps, existingModal) {
    if (!lead || !lead.owner_id) return false;
    const ownerFromList = (reps || []).find((r) => String(r.id) === String(lead.owner_id));
    const ownerName = lead.owner_name || (ownerFromList && ownerFromList.name) || 'responsavel';
    const ownerPhone = lead.owner_phone || (ownerFromList && ownerFromList.phone) || '';
    const phone = whatsappDigits(ownerPhone);
    const text = `OI ${firstName(ownerName)}, acabou de chegar um lead pra voce. Abra o sistema e de andamento por gentileza.`;
    const encoded = encodeURIComponent(text);
    const href = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    const html = phone
      ? `<p class="mb">Lead cadastrado e atribuido a <b>${UI.esc(ownerName)}</b>.</p>
         <p>Avise pelo WhatsApp para dar andamento:</p>
         <p class="small muted mt">"${UI.esc(text)}"</p>`
      : `<p class="mb">Lead cadastrado e atribuido a <b>${UI.esc(ownerName)}</b>, mas este representante nao tem telefone no cadastro.</p>
         <p>Abra o WhatsApp e escolha o contato. Cadastre o telefone em Usuarios para o aviso ir direto.</p>
         <p class="small muted mt">"${UI.esc(text)}"</p>`;

    const footer = `<button class="btn secondary" data-act="skip">Agora nao</button>
      <a class="btn" data-act="wa" href="${href}" target="_blank" rel="noopener">${UI.icon('whatsapp')} Avisar ${UI.esc(firstName(ownerName))} no WhatsApp</a>`;

    if (existingModal) {
      existingModal.card.querySelector('.modal-head h3').textContent = 'Avisar responsavel';
      existingModal.body.innerHTML = html;
      if (existingModal.foot) existingModal.foot.innerHTML = footer;
      existingModal.foot.querySelector('[data-act="skip"]').onclick = () => existingModal.close();
      existingModal.foot.querySelector('[data-act="wa"]').onclick = () => existingModal.close();
      return true;
    }

    const body = document.createElement('div');
    body.innerHTML = html;
    const modal = UI.modal({ title: 'Avisar responsavel', body, footer });
    modal.foot.querySelector('[data-act="skip"]').onclick = () => modal.close();
    modal.foot.querySelector('[data-act="wa"]').onclick = () => modal.close();
    return true;
  }

  async function openForm({ lead = null, onSaved } = {}) {
    const isAdmin = State.user.role === 'admin';
    await ensureSources();
    let reps = [];
    if (isAdmin) {
      try { reps = (await Api.get('/api/users/representatives')).representatives; } catch { reps = []; }
    }

    const sourceOpts = [{ value: '', label: 'Selecione a origem' }]
      .concat(State.sources.filter((s) => s.active !== 0 || String(s.id) === String(lead && lead.source_id))
        .map((s) => ({ value: s.id, label: s.name })));

    const form = document.createElement('form');
    form.innerHTML = `
      <div class="field">
        <label for="lf-name">Contato / empresa *</label>
        <div class="name-suggest">
          <input id="lf-name" required autocomplete="off" value="${UI.esc(lead ? lead.contact_name : '')}" placeholder="Nome do contato ou empresa">
          <div class="name-suggest-list hidden" id="lf-suggest"></div>
        </div>
        <div class="form-error hidden" id="lf-dup">Lead ja cadastrado com esse nome.</div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="lf-company">Empresa</label>
          <input id="lf-company" value="${UI.esc(lead ? lead.company || '' : '')}" placeholder="Razao social / nome fantasia">
        </div>
        <div class="field">
          <label for="lf-source">Origem do lead</label>
          <select id="lf-source">${UI.options(sourceOpts, lead ? lead.source_id : '')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="lf-phone">Telefone</label>
          <input id="lf-phone" value="${UI.esc(lead ? lead.phone || '' : '')}" placeholder="(00) 00000-0000">
        </div>
        <div class="field">
          <label for="lf-email">E-mail</label>
          <input id="lf-email" type="email" value="${UI.esc(lead ? lead.email || '' : '')}" placeholder="contato@empresa.com">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="lf-value">Valor estimado (R$)</label>
          <input id="lf-value" type="number" step="0.01" min="0" value="${lead && lead.estimated_value != null ? UI.esc(lead.estimated_value) : ''}" placeholder="0,00">
        </div>
        ${isAdmin ? `<div class="field">
          <label for="lf-owner">Representante responsavel</label>
          <select id="lf-owner">
            <option value="">Sem responsavel</option>
            ${UI.options(reps, lead ? lead.owner_id : (filters.owner_id !== 'all' ? filters.owner_id : ''), 'id', 'name')}
          </select>
        </div>` : ''}
      </div>
      <div class="field">
        <label for="lf-notes">Observacoes gerais</label>
        <textarea id="lf-notes" placeholder="Anotacoes iniciais sobre o lead">${UI.esc(lead ? lead.notes || '' : '')}</textarea>
      </div>
      ${!lead && !isAdmin ? '<div class="small muted">O lead sera atribuido automaticamente a voce na etapa "Novo lead".</div>' : ''}
    `;

    const m = UI.modal({
      title: lead ? `Editar lead: ${lead.contact_name}` : 'Novo lead',
      body: form,
      footer: `<button class="btn secondary" data-act="cancel">Cancelar</button>
               <button class="btn" data-act="save">${lead ? 'Salvar' : 'Cadastrar lead'}</button>`
    });

    m.foot.querySelector('[data-act="cancel"]').onclick = () => m.close();
    const saveBtn = m.foot.querySelector('[data-act="save"]');
    const nameInput = form.querySelector('#lf-name');
    const suggestBox = form.querySelector('#lf-suggest');
    const dupBox = form.querySelector('#lf-dup');
    let nameCheckTimer = null;
    let duplicateLead = null;

    function setDuplicate(found) {
      duplicateLead = found || null;
      if (duplicateLead) {
        dupBox.classList.remove('hidden');
        dupBox.textContent = 'Lead ja cadastrado com esse nome.';
        saveBtn.disabled = true;
      } else {
        dupBox.classList.add('hidden');
        saveBtn.disabled = false;
      }
    }

    function hideSuggest() {
      suggestBox.classList.add('hidden');
      suggestBox.innerHTML = '';
    }

    function renderSuggest(items) {
      if (!items.length) {
        hideSuggest();
        return;
      }
      suggestBox.classList.remove('hidden');
      suggestBox.innerHTML = items.map((l) => `
        <button type="button" class="name-suggest-item" data-id="${l.id}">
          <b>${UI.esc(l.contact_name)}</b>
          <span>${UI.esc(l.company || l.status_label || '')}${l.owner_name ? ' · ' + UI.esc(l.owner_name) : ''}</span>
        </button>
      `).join('');
      suggestBox.querySelectorAll('[data-id]').forEach((btn) => {
        btn.onclick = () => {
          m.close();
          location.hash = `#/leads/${btn.dataset.id}`;
        };
      });
    }

    async function checkName() {
      const q = nameInput.value.trim();
      if (q.length < 1) {
        hideSuggest();
        setDuplicate(null);
        return;
      }
      try {
        const params = new URLSearchParams({ q });
        if (lead) params.set('exclude_id', String(lead.id));
        const data = await Api.get('/api/leads/suggest?' + params.toString());
        const matches = data.leads || [];
        renderSuggest(matches);
        setDuplicate(data.duplicate || null);
      } catch {
        hideSuggest();
      }
    }

    nameInput.addEventListener('input', () => {
      saveBtn.disabled = false;
      clearTimeout(nameCheckTimer);
      nameCheckTimer = setTimeout(checkName, 180);
    });
    nameInput.addEventListener('focus', () => {
      if (nameInput.value.trim().length >= 1) checkName();
    });
    form.addEventListener('click', (e) => {
      if (!suggestBox.contains(e.target) && e.target !== nameInput) hideSuggest();
    });

    saveBtn.onclick = async () => {
      const payload = {
        contact_name: nameInput.value.trim(),
        company: form.querySelector('#lf-company').value.trim(),
        source_id: form.querySelector('#lf-source').value || null,
        phone: form.querySelector('#lf-phone').value.trim(),
        email: form.querySelector('#lf-email').value.trim(),
        estimated_value: form.querySelector('#lf-value').value,
        notes: form.querySelector('#lf-notes').value.trim()
      };
      if (!payload.contact_name) { UI.toast('Informe o contato ou empresa.', 'error'); return; }
      if (duplicateLead) {
        UI.toast('Lead ja cadastrado com esse nome.', 'error');
        return;
      }
      const ownerSel = form.querySelector('#lf-owner');
      if (ownerSel) payload.owner_id = ownerSel.value || null;

      saveBtn.disabled = true;
      try {
        if (lead) {
          await Api.patch(`/api/leads/${lead.id}`, payload);
          UI.toast('Lead atualizado.', 'success');
          m.close();
          if (typeof onSaved === 'function') onSaved();
        } else {
          const created = await Api.post('/api/leads', payload);
          UI.toast('Lead cadastrado.', 'success');
          const savedLead = (created && created.lead) || created || { owner_id: payload.owner_id };
          if (!savedLead.owner_id && payload.owner_id) savedLead.owner_id = payload.owner_id;
          const showed = offerWhatsAppNotify(savedLead, reps, m);
          if (!showed) m.close();
          if (typeof onSaved === 'function') onSaved();
        }
      } catch (err) {
        saveBtn.disabled = false;
        if (err.status === 409) {
          setDuplicate({ id: err.existingId });
          UI.toast('Lead ja cadastrado com esse nome.', 'error');
        } else {
          UI.toast(err.message, 'error');
        }
      }
    };
  }

  async function renderDetail(view, id) {
    App.loading(view);
    const isAdmin = State.user.role === 'admin';
    let data;
    try {
      data = await Api.get(`/api/leads/${id}`);
    } catch (err) {
      view.innerHTML = `${backButton()}${App.pageHead('Lead')}<div class="panel"><div class="form-error">${UI.esc(err.message)}</div></div>`;
      wireBack(view);
      return;
    }
    const lead = data.lead;
    const [intData, auditData] = await Promise.all([
      Api.get(`/api/leads/${id}/interactions`),
      Api.get(`/api/leads/${id}/audit`).catch(() => ({ audit: [] }))
    ]);
    const interactions = intData.interactions;
    const level = UI.stallLevel(lead.days_stalled, data.stalledDays || State.config.stalled_days);

    view.innerHTML = `
      ${backButton()}
      ${App.pageHead(lead.contact_name, `
         <button class="btn secondary sm" id="dt-edit">${UI.icon('edit')} Editar</button>
         ${lead.owner_id ? `<button class="btn secondary sm" id="dt-wa">${UI.icon('whatsapp')} Avisar no WhatsApp</button>` : ''}
         ${isAdmin ? '<button class="btn secondary sm" id="dt-assign">Atribuir</button>' : ''}
        ${!isAdmin ? '<button class="btn secondary sm" id="dt-help">Solicitar ajuda</button>' : ''}
      `)}
      <div class="panel mb">
        <div class="flex flex-wrap">
          ${statusPill(lead)}
          <span class="pill ${level}"><span class="badge-dot ${level}"></span> Ultima movimentacao: ${UI.daysLabel(lead.days_stalled)}</span>
          ${lead.estimated_value ? `<span class="pill blue">${UI.currency(lead.estimated_value)}</span>` : ''}
          <span class="pill gray">${lead.interaction_count} interacao(oes)</span>
        </div>
        ${lead.is_lost && lead.loss_reason ? `<div class="form-error mt"><b>Motivo da perda:</b> ${UI.esc(lead.loss_reason)}</div>` : ''}
      </div>
      <div class="detail-grid">
        <div>
          <div class="panel">
            <h3 class="panel-title">Dados do lead</h3>
            <div class="info-list">
              <div class="il"><div class="il-label">Empresa</div><div class="il-value">${UI.esc(lead.company || '-')}</div></div>
              <div class="il"><div class="il-label">Responsavel</div><div class="il-value">${UI.esc(lead.owner_name || 'Sem responsavel')}</div></div>
              <div class="il"><div class="il-label">Telefone</div><div class="il-value">${lead.phone ? `<a href="tel:${UI.esc(lead.phone)}">${UI.esc(lead.phone)}</a>` : '-'}</div></div>
              <div class="il"><div class="il-label">E-mail</div><div class="il-value">${lead.email ? `<a href="mailto:${UI.esc(lead.email)}">${UI.esc(lead.email)}</a>` : '-'}</div></div>
              <div class="il"><div class="il-label">Origem</div><div class="il-value">${UI.esc(lead.source_name || '-')}</div></div>
              <div class="il"><div class="il-label">Criado em</div><div class="il-value">${UI.fmtDate(lead.created_at)}</div></div>
              <div class="il"><div class="il-label">Ultima atualizacao</div><div class="il-value">${UI.fmtDateTime(lead.updated_at)}</div></div>
              <div class="il"><div class="il-label">Ultima interacao</div><div class="il-value">${lead.last_interaction_at ? UI.fmtDateTime(lead.last_interaction_at) : 'Nenhuma'}</div></div>
            </div>
            ${lead.notes ? `<div class="mt"><div class="il-label">Observacoes</div><div style="white-space:pre-wrap">${UI.esc(lead.notes)}</div></div>` : ''}
          </div>
          <div class="panel">
            <h3 class="panel-title">Etapa do lead</h3>
            <div class="field">
              <select id="dt-status">${UI.options(State.columns.map((c) => ({ value: c.key, label: c.label })), lead.status)}</select>
              <div class="form-hint">Para "Em negociacao" ou etapas seguintes e exigido ao menos 1 interacao. "Perdido" exige motivo.</div>
            </div>
            <button class="btn block" id="dt-status-btn">Alterar etapa</button>
          </div>
          <details class="panel">
            <summary style="cursor:pointer;font-weight:700">Auditoria (${auditData.audit.length})</summary>
            <div class="mt">
              ${auditData.audit.length ? auditData.audit.map((a) => `
                <div class="tl-item">
                  <div class="tl-body">
                    <div class="tl-head"><span class="tl-type">${UI.esc(a.action)}</span><span class="tl-meta">${UI.fmtDateTime(a.created_at)}</span></div>
                    <div class="tl-note">${UI.esc(a.detail || '')} ${a.author_name ? '- ' + UI.esc(a.author_name) : ''}</div>
                  </div>
                </div>`).join('') : '<div class="muted small">Sem registros.</div>'}
            </div>
          </details>
        </div>
        <div>
          <div class="panel">
            <h3 class="panel-title">Registrar interacao</h3>
            <div class="interaction-form">
              <div class="field-row">
                <div class="field">
                  <label for="it-type">Tipo</label>
                  <select id="it-type">
                    ${UI.options(['call', 'whatsapp', 'email', 'meeting', 'visit', 'other']
                      .map((t) => ({ value: t, label: UI.interactionLabel(t) })), 'call')}
                  </select>
                </div>
              </div>
              <div class="field">
                <label for="it-summary">Resumo do que foi feito / conversado *</label>
                <textarea id="it-summary" placeholder="Descreva o contato realizado com o lead..."></textarea>
              </div>
              <button class="btn block" id="it-submit">Registrar interacao</button>
            </div>
            <h3 class="panel-title mt">Historico de interacoes</h3>
            <div class="timeline" id="dt-timeline">
              ${interactions.length ? interactions.map(interactionItem).join('')
                : '<div class="empty-state"><h3>Nenhuma interacao</h3><p>Registre o primeiro contato para dar rastreabilidade ao lead.</p></div>'}
            </div>
          </div>
        </div>
      </div>
    `;

    wireBack(view);
    view.querySelector('#dt-edit').onclick = () => openForm({ lead, onSaved: () => renderDetail(view, id) });
    const waBtn = view.querySelector('#dt-wa');
    if (waBtn) waBtn.onclick = () => offerWhatsAppNotify(lead, []);
    const assignBtn = view.querySelector('#dt-assign');
    if (assignBtn) assignBtn.onclick = () => openAssign(lead, () => renderDetail(view, id));
    const helpBtn = view.querySelector('#dt-help');
    if (helpBtn) helpBtn.onclick = () => requestHelp(lead);
    view.querySelector('#dt-status-btn').onclick = () => changeStatus(lead, () => renderDetail(view, id));

    view.querySelector('#it-submit').onclick = async () => {
      const type = view.querySelector('#it-type').value;
      const summary = view.querySelector('#it-summary').value.trim();
      if (!summary) { UI.toast('Descreva o que foi feito.', 'error'); return; }
      const btn = view.querySelector('#it-submit');
      btn.disabled = true;
      try {
        const res = await Api.post(`/api/leads/${id}/interactions`, { type, summary });
        UI.toast('Interacao registrada.', 'success');
        if (res.autoMovedTo) UI.toast(`Etapa avancada automaticamente para "${res.autoMovedTo}".`, 'info');
        renderDetail(view, id);
      } catch (err) {
        btn.disabled = false;
        UI.toast(err.message, 'error');
      }
    };
  }

  function interactionItem(i) {
    return `
      <div class="tl-item">
        <div class="tl-icon" title="${UI.esc(UI.interactionLabel(i.type))}">${UI.interactionGlyph(i.type)}</div>
        <div class="tl-body">
          <div class="tl-head">
            <span class="tl-type">${UI.esc(UI.interactionLabel(i.type))}</span>
            <span class="tl-meta">${UI.esc(i.author_name || 'Sistema')} - ${UI.fmtDateTime(i.created_at)}</span>
          </div>
          <div class="tl-summary">${UI.esc(i.summary)}</div>
        </div>
      </div>`;
  }

  async function changeStatus(lead, onDone) {
    const target = document.getElementById('dt-status').value;
    const col = State.columns.find((c) => c.key === target);
    if (!col || col.key === lead.status) { UI.toast('Selecione uma etapa diferente.', 'info'); return; }
    let reason;
    if (col.requires_loss) {
      reason = await Kanban.reasonPrompt(lead.contact_name);
      if (!reason) return;
    }
    try {
      await Api.post(`/api/leads/${lead.id}/status`, { status: target, loss_reason: reason });
      UI.toast('Etapa atualizada.', 'success');
      onDone();
    } catch (err) {
      UI.toast(err.message, 'error');
    }
  }

  async function openAssign(lead, onDone) {
    const reps = (await Api.get('/api/users/representatives')).representatives;
    const form = document.createElement('form');
    form.innerHTML = `
      <p class="mb">Reatribua o lead <b>${UI.esc(lead.contact_name)}</b> para outro representante.</p>
      <div class="field">
        <label for="as-owner">Representante</label>
        <select id="as-owner">
          <option value="">Sem responsavel</option>
          ${UI.options(reps, lead.owner_id || '', 'id', 'name')}
        </select>
      </div>`;
    const m = UI.modal({
      title: 'Atribuir lead',
      body: form,
      footer: `<button class="btn secondary" data-act="cancel">Cancelar</button>
               <button class="btn" data-act="ok">Salvar</button>`
    });
    m.foot.querySelector('[data-act="cancel"]').onclick = () => m.close();
    m.foot.querySelector('[data-act="ok"]').onclick = async () => {
      const ownerId = form.querySelector('#as-owner').value || null;
      try {
        await Api.post(`/api/leads/${lead.id}/assign`, { owner_id: ownerId });
        UI.toast('Representante atualizado.', 'success');
        m.close();
        onDone();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    };
  }

  function requestHelp(lead) {
    const form = document.createElement('form');
    form.innerHTML = `
      <p class="mb">Envie uma solicitacao de apoio ao administrador sobre o lead <b>${UI.esc(lead.contact_name)}</b>.</p>
      <div class="field">
        <label for="hp-msg">Mensagem</label>
        <textarea id="hp-msg" placeholder="Ex.: preciso de desconto especial, o cliente vai fechar hoje..."></textarea>
      </div>`;
    const m = UI.modal({
      title: 'Solicitar ajuda ao admin',
      body: form,
      footer: `<button class="btn secondary" data-act="cancel">Cancelar</button>
               <button class="btn" data-act="ok">Enviar</button>`
    });
    m.foot.querySelector('[data-act="cancel"]').onclick = () => m.close();
    m.foot.querySelector('[data-act="ok"]').onclick = async () => {
      const message = form.querySelector('#hp-msg').value.trim();
      try {
        await Api.post(`/api/leads/${lead.id}/request-assistance`, { message });
        UI.toast('Solicitacao enviada ao administrador.', 'success');
        m.close();
      } catch (err) {
        UI.toast(err.message, 'error');
      }
    };
  }

  function backButton() {
    return `<button class="btn ghost sm mb" id="dt-back">${UI.icon('back')} Voltar</button>`;
  }
  function wireBack(view) {
    const b = view.querySelector('#dt-back');
    if (b) b.onclick = () => { history.length > 1 ? history.back() : (location.hash = '#/leads'); };
  }

  return { renderList, renderDetail, openForm };
})();
