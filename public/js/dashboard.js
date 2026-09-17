'use strict';

const Dashboard = (() => {
  const filters = { from: '', to: '', owner_id: 'all' };

  async function render(view) {
    App.loading(view);
    const isAdmin = State.user.role === 'admin';
    let reps = [];
    if (isAdmin) {
      try { reps = (await Api.get('/api/users/representatives')).representatives; } catch { reps = []; }
    }

    const params = new URLSearchParams();
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (isAdmin && filters.owner_id !== 'all') params.set('owner_id', filters.owner_id);

    const data = await Api.get('/api/dashboard?' + params.toString());
    const s = data.summary;

    view.innerHTML = `
      ${App.pageHead('Painel de acompanhamento')}
      <div class="panel mb">
        <div class="toolbar" style="margin-bottom:0">
          <div><label class="small mb" for="db-from">Criado de</label><input type="date" id="db-from" value="${UI.esc(filters.from)}"></div>
          <div><label class="small mb" for="db-to">Criado ate</label><input type="date" id="db-to" value="${UI.esc(filters.to)}"></div>
          ${isAdmin ? `<div><label class="small mb" for="db-owner">Representante</label>
            <select id="db-owner"><option value="all">Todos</option>${UI.options(reps, filters.owner_id, 'id', 'name')}</select></div>` : ''}
          <button class="btn secondary sm" id="db-apply" style="margin-top:18px">Aplicar</button>
          <button class="btn ghost sm" id="db-clear" style="margin-top:18px">Limpar periodo</button>
        </div>
      </div>

      <div class="kpis">
        <div class="kpi"><div class="k-label">Total de leads</div><div class="k-value">${s.total}</div>
          <div class="k-sub">${data.period.from || data.period.to ? 'no periodo filtrado' : 'todos os leads'}</div></div>
        <div class="kpi"><div class="k-label">Em aberto</div><div class="k-value">${s.open}</div><div class="k-sub">em andamento</div></div>
        <div class="kpi"><div class="k-label">Ganhos</div><div class="k-value" style="color:var(--green)">${s.won}</div><div class="k-sub">fechados com sucesso</div></div>
        <div class="kpi"><div class="k-label">Taxa de conversao</div><div class="k-value">${s.conversionRate}%</div><div class="k-sub">${s.won} ganhos / ${s.total} leads</div></div>
      </div>

      <div class="detail-grid">
        <div>
          <div class="panel mb">
            <h3 class="panel-title">Leads por etapa</h3>
            ${data.byStatus.map((c) => bar(c.label, c.count, s.total, c.color)).join('') || '<div class="muted small">Sem dados.</div>'}
          </div>
          <div class="panel">
            <h3 class="panel-title">Leads por origem</h3>
            ${data.bySource.length ? data.bySource.map((x) => bar(x.name, x.count, s.total, '#6366f1')).join('') : '<div class="muted small">Sem dados.</div>'}
          </div>
        </div>
        <div>
          <div class="panel" style="border-color:#fecaca">
            <h3 class="panel-title" style="color:var(--red)">Leads parados ha ${data.stalledDays}+ dias (${data.stalled.count})</h3>
            ${data.stalled.leads.length ? `
              <div class="table-wrap">
                <table class="data">
                  <thead><tr><th>Contato</th>${isAdmin ? '<th>Responsavel</th>' : ''}<th>Etapa</th><th>Parado ha</th></tr></thead>
                  <tbody>
                    ${data.stalled.leads.slice(0, 40).map((l) => `
                      <tr class="row-danger" data-lead="${l.id}" style="cursor:pointer">
                        <td><b>${UI.esc(l.contact_name)}</b>${l.company ? `<div class="small muted">${UI.esc(l.company)}</div>` : ''}</td>
                        ${isAdmin ? `<td>${UI.esc(l.owner_name || 'Sem resp.')}</td>` : ''}
                        <td class="small">${UI.esc(l.status_label || l.status)}</td>
                        <td><span class="pill red">${l.days_stalled} dias</span></td>
                      </tr>`).join('')}
                  </tbody>
                </table>
              </div>
              <div class="small muted mt">Exibindo os ${Math.min(40, data.stalled.leads.length)} leads mais criticos, ordenados pelo tempo parado.</div>
            ` : '<div class="muted small">Nenhum lead parado no momento. Otimo trabalho!</div>'}
          </div>
        </div>
      </div>

      ${isAdmin ? `
      <div class="panel mt">
        <h3 class="panel-title">Desempenho por representante</h3>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Representante</th><th>Perfil</th><th>Leads</th><th>Ganhos</th><th>Perdidos</th><th>Parados</th><th>Conversao</th></tr></thead>
            <tbody>
              ${data.byOwner.length ? data.byOwner.map((r) => `
                <tr>
                  <td><b>${UI.esc(r.name)}</b></td>
                  <td class="small">${UI.roleLabel(r.role)}</td>
                  <td>${r.total}</td>
                  <td style="color:var(--green);font-weight:700">${r.won}</td>
                  <td style="color:var(--red)">${r.lost}</td>
                  <td>${r.stalled ? `<span class="pill red">${r.stalled}</span>` : '0'}</td>
                  <td><b>${r.conversionRate}%</b></td>
                </tr>`).join('') : '<tr><td colspan="7" class="muted">Nenhum representante ativo.</td></tr>'}
            </tbody>
          </table>
        </div>
        ${data.unassigned ? `<div class="form-error mt">${data.unassigned} lead(s) sem representante atribuido.</div>` : ''}
      </div>` : ''}
    `;

    view.querySelector('#db-apply').onclick = () => {
      filters.from = view.querySelector('#db-from').value;
      filters.to = view.querySelector('#db-to').value;
      const o = view.querySelector('#db-owner');
      if (o) filters.owner_id = o.value;
      render(view);
    };
    view.querySelector('#db-clear').onclick = () => {
      filters.from = ''; filters.to = '';
      render(view);
    };

    view.onclick = (e) => {
      const tr = e.target.closest('[data-lead]');
      if (tr) location.hash = `#/leads/${tr.dataset.lead}`;
    };
  }

  function bar(label, count, total, color) {
    const pct = total > 0 ? Math.round((count / total) * 100) : (count > 0 ? 100 : 0);
    return `
      <div class="bar-row">
        <span class="bar-label">${UI.esc(label)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${UI.esc(color)}"></span></span>
        <span class="bar-val">${count}</span>
      </div>`;
  }

  return { render };
})();
