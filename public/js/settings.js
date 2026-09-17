'use strict';

const Settings = (() => {
  async function render(view) {
    App.loading(view);
    const data = await Api.get('/api/settings');
    const cols = data.columns.slice().sort((a, b) => a.position - b.position);

    view.innerHTML = `
      ${App.pageHead('Configuracoes')}

      <div class="panel mb">
        <h3 class="panel-title">Preferencias gerais</h3>
        <div class="field-row">
          <div class="field">
            <label for="st-company">Nome da empresa</label>
            <input id="st-company" value="${UI.esc(data.company_name)}">
          </div>
          <div class="field">
            <label for="st-days">Alerta de lead parado (dias)</label>
            <input id="st-days" type="number" min="1" max="365" value="${UI.esc(data.stalled_days)}">
            <div class="form-hint">Leads sem movimentacao por este periodo aparecem em vermelho e geram notificacao ao admin.</div>
          </div>
        </div>
        <label class="flex small" style="margin-bottom:14px">
          <input type="checkbox" id="st-alert" style="width:auto" ${data.stalled_alert_enabled ? 'checked' : ''}>
          Ativar notificacoes de leads parados para o administrador
        </label>
        <button class="btn" id="st-save">Salvar preferencias</button>
      </div>

      <div class="panel mb">
        <h3 class="panel-title">Colunas do kanban</h3>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Ordem</th><th>Nome</th><th>Cor</th><th title="Minimo de interacoes para entrar na etapa">Min. inter.</th><th title="Exige motivo da perda">Exige motivo</th><th>Acoes</th></tr></thead>
            <tbody>
              ${cols.map((c, idx) => `
                <tr data-col="${UI.esc(c.key)}">
                  <td>
                    <button class="btn ghost sm" data-up="${UI.esc(c.key)}" ${idx === 0 ? 'disabled' : ''}>&#8593;</button>
                    <button class="btn ghost sm" data-down="${UI.esc(c.key)}" ${idx === cols.length - 1 ? 'disabled' : ''}>&#8595;</button>
                  </td>
                  <td><input data-cf="label" value="${UI.esc(c.label)}" style="min-width:160px"></td>
                  <td><input data-cf="color" type="color" value="${UI.esc(c.color)}" style="width:48px;padding:2px"></td>
                  <td><input data-cf="min_interactions" type="number" min="0" value="${c.min_interactions}" style="width:72px"></td>
                  <td class="center"><input data-cf="requires_loss" type="checkbox" style="width:auto" ${c.requires_loss ? 'checked' : ''}></td>
                  <td><button class="btn secondary sm" data-save-col="${UI.esc(c.key)}">Salvar</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="field-row mt">
          <div class="field">
            <label for="st-new-col">Nova coluna</label>
            <input id="st-new-col" placeholder="Ex.: Em analise">
          </div>
          <div class="field">
            <label for="st-new-color">Cor</label>
            <input id="st-new-color" type="color" value="#64748b">
          </div>
        </div>
        <button class="btn secondary" id="st-add-col">Adicionar coluna</button>
      </div>

      <div class="panel">
        <h3 class="panel-title">Origens de lead</h3>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nome</th><th>Ativa</th><th>Acoes</th></tr></thead>
            <tbody>
              ${data.sources.map((s) => `
                <tr data-src="${s.id}">
                  <td><input data-sf="name" value="${UI.esc(s.name)}" style="min-width:180px"></td>
                  <td class="center"><input data-sf="active" type="checkbox" style="width:auto" ${s.active ? 'checked' : ''}></td>
                  <td><button class="btn secondary sm" data-save-src="${s.id}">Salvar</button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="flex mt">
          <input id="st-new-src" placeholder="Nova origem (ex.: Parceria)">
          <button class="btn secondary" id="st-add-src">Adicionar origem</button>
        </div>
      </div>
    `;

    view.querySelector('#st-save').onclick = async () => {
      try {
        await Api.patch('/api/settings', {
          company_name: view.querySelector('#st-company').value.trim(),
          stalled_days: Number(view.querySelector('#st-days').value),
          stalled_alert_enabled: view.querySelector('#st-alert').checked
        });
        UI.toast('Preferencias salvas.', 'success');
        await App.refreshConfig();
        render(view);
      } catch (err) { UI.toast(err.message, 'error'); }
    };

    view.querySelectorAll('[data-save-col]').forEach((btn) => {
      btn.onclick = async () => {
        const key = btn.dataset.saveCol;
        const row = view.querySelector(`tr[data-col="${key}"]`);
        try {
          await Api.patch(`/api/settings/columns/${encodeURIComponent(key)}`, {
            label: row.querySelector('[data-cf="label"]').value.trim(),
            color: row.querySelector('[data-cf="color"]').value,
            min_interactions: Number(row.querySelector('[data-cf="min_interactions"]').value),
            requires_loss: row.querySelector('[data-cf="requires_loss"]').checked
          });
          UI.toast('Coluna atualizada.', 'success');
          await App.refreshConfig();
          render(view);
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });

    async function reorder(key, dir) {
      const order = cols.map((c) => c.key);
      const i = order.indexOf(key);
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      try {
        await Api.post('/api/settings/columns/reorder', { order });
        await App.refreshConfig();
        render(view);
      } catch (err) { UI.toast(err.message, 'error'); }
    }
    view.querySelectorAll('[data-up]').forEach((b) => { b.onclick = () => reorder(b.dataset.up, -1); });
    view.querySelectorAll('[data-down]').forEach((b) => { b.onclick = () => reorder(b.dataset.down, 1); });

    view.querySelector('#st-add-col').onclick = async () => {
      const label = view.querySelector('#st-new-col').value.trim();
      if (!label) { UI.toast('Informe o nome da nova coluna.', 'error'); return; }
      try {
        await Api.post('/api/settings/columns', { label, color: view.querySelector('#st-new-color').value });
        UI.toast('Coluna adicionada.', 'success');
        await App.refreshConfig();
        render(view);
      } catch (err) { UI.toast(err.message, 'error'); }
    };

    view.querySelectorAll('[data-save-src]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.saveSrc;
        const row = view.querySelector(`tr[data-src="${id}"]`);
        try {
          await Api.patch(`/api/settings/sources/${id}`, {
            name: row.querySelector('[data-sf="name"]').value.trim(),
            active: row.querySelector('[data-sf="active"]').checked
          });
          UI.toast('Origem atualizada.', 'success');
          await App.refreshConfig();
          render(view);
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });

    view.querySelector('#st-add-src').onclick = async () => {
      const input = view.querySelector('#st-new-src');
      const name = input.value.trim();
      if (!name) { UI.toast('Informe o nome da origem.', 'error'); return; }
      try {
        await Api.post('/api/settings/sources', { name });
        UI.toast('Origem adicionada.', 'success');
        await App.refreshConfig();
        render(view);
      } catch (err) { UI.toast(err.message, 'error'); }
    };
  }

  return { render };
})();
