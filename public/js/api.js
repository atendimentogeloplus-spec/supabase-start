'use strict';

const State = {
  user: null,
  config: { company_name: 'LeadTrack', stalled_days: 7, columns: [], isAdmin: false },
  columns: [],
  sources: [],
  unreadCount: 0,
  filterOwner: null
};

const Api = (() => {
  async function request(method, path, body, options = {}) {
    const init = {
      method,
      headers: {},
      credentials: 'same-origin'
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await fetch(path, init);
    let data = null;
    const text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Erro ${res.status}`);
      err.status = res.status;
      err.code = data && data.code;
      err.existingId = data && data.existingId;
      if (res.status === 401 && !options.skipAuthRedirect) {
        if (window.App && App.onUnauthorized) App.onUnauthorized();
      }
      throw err;
    }
    return data;
  }

  return {
    get: (p, o) => request('GET', p, undefined, o),
    post: (p, b, o) => request('POST', p, b === undefined ? {} : b, o),
    patch: (p, b, o) => request('PATCH', p, b === undefined ? {} : b, o),
    request
  };
})();
