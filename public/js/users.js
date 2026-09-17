'use strict';

const Users = (() => {
  const filters = { status: '', role: '', q: '' };

  const ROLE_OPTIONS = [
    { value: 'rep_internal', label: 'Representante Interno' },
    { value: 'rep_external', label: 'Representante Externo' },
    { value: 'admin', label: 'Administrador' }
  ];
  const STATUS_OPTIONS = [
    { value: 'active', label: 'Ativo' },
    { value: 'pending', label: 'Pendente' },
    { value: 'disabled', label: 'Desativado' },
    { value: 'rejected', label: 'Rejeitado' }
  ];

  function showTemporaryPassword(name, password, onDone) {
    const body = document.createElement('div');
    body.innerHTML = `
      <p class="mb">Senha temporaria gerada para <b>${UI.esc(name)}</b>. Informe-a com seguranca: ela sera exibida apenas esta vez.</p>
      <div class="temp-password">
        <code id="tmp-pass">${UI.esc(password)}</code>
        <button class="btn secondary sm" data-copy>Copiar</button>
      </div>
      <div class="small muted">No proximo login o usuario sera obrigado a definir uma nova senha.</div>
    `;
    const m = UI.modal({
      title: 'Senha temporaria',
      body,
      footer: '<button class="btn" data-act="ok">Entendi</button>'
    });
    body.querySelector('[data-copy]').onclick = async () => {
      try {
        await navigator.clipboard.writeText(password);
        UI.toast('Senha copiada.', 'success');
      } catch {
        UI.toast('Nao foi possivel copiar automaticamente. Anote a senha exibida.', 'info');
      }
    };
    m.foot.querySelector('[data-act="ok"]').onclick = () => {
      m.close();
      if (typeof onDone === 'function') onDone();
    };
  }

  async function render(view) {
    App.loading(view);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.role) params.set('role', filters.role);
    if (filters.q) params.set('q', filters.q);
    const data = await Api.get('/api/users?' + params.toString());
    const users = data.users;
    const pending = users.filter((u) => u.status === 'pending');

    view.innerHTML = `
      ${App.pageHead('Gestao de usuarios', `<span class="pill amber">${data.pendingCount} pendente(s)</span>`)}
      ${pending.length ? `
      <div class="panel mb" style="border-color:#fde68a;background:#fffbeb">
        <h3 class="panel-title">Cadastros aguardando aprovacao</h3>
        <div id="pending-list">
          ${pending.map((u) => `
            <div class="panel mb" style="box-shadow:none">
              <div class="flex flex-wrap">
                <div class="grow">
                  <b>${UI.esc(u.name)}</b>
                  <div class="small muted">${UI.esc(u.email)}${u.phone ? ' - ' + UI.esc(u.phone) : ''}</div>
                  <div class="small muted">Solicitado em ${UI.fmtDateTime(u.createdAt)}</div>
                </div>
                <select data-role-for="${u.id}">${UI.options(ROLE_OPTIONS, 'rep_external')}</select>
                <button class="btn success sm" data-approve="${u.id}">${UI.icon('check')} Aprovar</button>
                <button class="btn-outline-danger btn sm" data-reject="${u.id}">Rejeitar</button>
              </div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="panel">
        <div class="toolbar">
          <input class="search" id="us-q" placeholder="Buscar por nome ou e-mail" value="${UI.esc(filters.q)}">
          <select id="us-status"><option value="">Todos os status</option>${UI.options(STATUS_OPTIONS, filters.status)}</select>
          <select id="us-role"><option value="">Todos os perfis</option>${UI.options(ROLE_OPTIONS, filters.role)}</select>
          <button class="btn secondary sm" id="us-clear">Limpar</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Acoes</th></tr></thead>
            <tbody>
              ${users.length ? users.map((u) => `
                <tr>
                  <td><b>${UI.esc(u.name)}</b>${u.mustChangePassword ? ' <span class="pill amber">senha temporaria</span>' : ''}</td>
                  <td class="small">${UI.esc(u.email)}</td>
                  <td class="small">${UI.esc(u.phone || '-')}</td>
                  <td><select data-field="role" data-id="${u.id}" ${u.id === State.user.id ? 'disabled' : ''}>${UI.options(ROLE_OPTIONS, u.role)}</select></td>
                  <td><select data-field="status" data-id="${u.id}" ${u.id === State.user.id ? 'disabled' : ''}>${UI.options(STATUS_OPTIONS, u.status)}</select></td>
                  <td class="small">${UI.fmtDate(u.createdAt)}</td>
                  <td><button class="btn secondary sm" data-reset="${u.id}" data-name="${UI.esc(u.name)}">Resetar senha</button></td>
                </tr>`).join('') : '<tr><td colspan="7" class="muted">Nenhum usuario encontrado.</td></tr>'}
            </tbody>
          </table>
        </div>
        ${users.some((u) => u.id === State.user.id) ? '<div class="small muted mt">Voce nao pode alterar o proprio perfil/status (protecao contra perda de acesso).</div>' : ''}
      </div>
    `;

    view.querySelectorAll('[data-approve]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.approve;
        const role = view.querySelector(`[data-role-for="${id}"]`).value;
        try {
          await Api.post(`/api/users/${id}/approve`, { role });
          UI.toast('Usuario aprovado.', 'success');
          render(view);
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });

    view.querySelectorAll('[data-reject]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.reject;
        if (!await UI.confirm('Rejeitar este cadastro? O usuario nao podera acessar o sistema.', { okLabel: 'Rejeitar', danger: true })) return;
        try {
          await Api.post(`/api/users/${id}/reject`, {});
          UI.toast('Cadastro rejeitado.', 'success');
          render(view);
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });

    view.querySelectorAll('[data-reset]').forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.dataset.reset;
        const name = btn.dataset.name;
        if (!await UI.confirm(
          `Gerar uma senha temporaria para ${name}? As sessoes ativas dele serao encerradas.`,
          { title: 'Resetar senha', okLabel: 'Gerar senha' }
        )) return;
        try {
          const data = await Api.post(`/api/users/${id}/reset-password`, {});
          showTemporaryPassword(name, data.temporaryPassword, () => render(view));
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    });

    view.querySelectorAll('select[data-field]').forEach((sel) => {
      sel.onchange = async () => {
        const id = Number(sel.dataset.id);
        const field = sel.dataset.field;
        const payload = { [field]: sel.value };
        if (field === 'status' && sel.value === 'disabled') {
          if (!await UI.confirm('Desativar este usuario? Ele perdera o acesso imediatamente.', { okLabel: 'Desativar', danger: true })) {
            render(view); return;
          }
        }
        try {
          await Api.patch(`/api/users/${id}`, payload);
          UI.toast('Usuario atualizado.', 'success');
          render(view);
        } catch (err) {
          UI.toast(err.message, 'error');
          render(view);
        }
      };
    });

    const apply = () => {
      filters.q = view.querySelector('#us-q').value.trim();
      filters.status = view.querySelector('#us-status').value;
      filters.role = view.querySelector('#us-role').value;
      render(view);
    };
    view.querySelector('#us-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    view.querySelector('#us-status').onchange = apply;
    view.querySelector('#us-role').onchange = apply;
    view.querySelector('#us-clear').onclick = () => {
      filters.q = ''; filters.status = ''; filters.role = '';
      render(view);
    };
  }

  return { render };
})();
