/* Estadia — frontend SPA (JavaScript puro, roteamento por hash). */
'use strict';

const state = { me: null, meta: { property_types: [], amenities: [] } };
let cleanup = [];          // funções executadas ao trocar de página
let lastPath = null;

const AMENITY_ICONS = {
  'Wi-Fi': '📶', 'Cozinha': '🍳', 'Ar-condicionado': '❄️', 'Estacionamento gratuito': '🚗',
  'Piscina': '🏊', 'TV': '📺', 'Máquina de lavar': '🧺', 'Espaço de trabalho': '💻',
  'Aceita animais': '🐾', 'Café da manhã': '☕', 'Churrasqueira': '🔥', 'Vista para o mar': '🌊',
  'Academia': '🏋️', 'Hidromassagem': '🛁', 'Lareira': '🪵',
};
const STATUS_LABEL = { pending: 'Aguardando anfitrião', confirmed: 'Confirmada', declined: 'Recusada', cancelled: 'Cancelada' };

/* ------------------------------------------------------------ utils */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const money2 = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayISO = () => toISO(new Date());
const fmtDate = (s) => parseISO(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtShort = (s) => parseISO(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const parseTs = (s) => (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? new Date(s) : new Date(s.replace(' ', 'T') + 'Z'));
const fmtDateTime = (s) => parseTs(s).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const nightsBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const go = (path) => { location.hash = '#' + path; };

function avatar(name, url, size = '') {
  if (url) return `<img class="avatar ${size}" src="${esc(url)}" alt="">`;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return `<span class="avatar ${size}">${esc(initial)}</span>`;
}

function stars(rating, count, showCount = true) {
  if (!count) return '<span>★ Novo</span>';
  return `<span>★ ${Number(rating).toFixed(2).replace('.', ',')}${showCount ? ` <span class="muted">(${count})</span>` : ''}</span>`;
}

function statusBadge(b) {
  if (b.status === 'confirmed' && b.is_past) return '<span class="badge done">Concluída</span>';
  return `<span class="badge ${b.status}">${STATUS_LABEL[b.status] || b.status}</span>`;
}

function toast(msg, isError = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.className = 'toast'; }, 3200);
}

async function api(path, { method = 'GET', body } = {}) {
  // Os dados vêm do Supabase (backend.js); a interface não precisa saber disso.
  return Backend.request(method, path, body);
}

/** Envolve um handler async mostrando erros em toast e desabilitando o botão. */
function action(fn) {
  return async (ev) => {
    const btn = ev && ev.currentTarget && ev.currentTarget.tagName === 'BUTTON' ? ev.currentTarget : null;
    if (btn) btn.disabled = true;
    try { await fn(ev); } catch (e) { toast(e.message, true); } finally { if (btn) btn.disabled = false; }
  };
}

function requireLogin() {
  go('/login?next=' + encodeURIComponent(location.hash.slice(1) || '/'));
}

/* ------------------------------------------------------------ header */
function renderNav() {
  const nav = $('#nav');
  const me = state.me;
  nav.innerHTML = `
    ${me && me.is_admin ? '<a class="link hide-sm" href="#/admin">🛡️ Administração</a>' : ''}
    <a class="link hide-sm" href="${me ? '#/host' : '#/login?next=/host'}">${me ? 'Painel do anfitrião' : 'Anuncie seu espaço'}</a>
    <div class="menu" id="menu">
      <button class="menu-btn" aria-haspopup="true" aria-label="Menu">
        <span>☰</span>${me ? avatar(me.name, me.avatar) : '<span class="avatar" style="background:#9ca3af">👤</span>'}
      </button>
      <div class="menu-list">
        ${me ? `
          <div style="padding:8px 16px" class="small muted">Olá, ${esc(me.name.split(' ')[0])}</div>
          <a href="#/trips">Minhas viagens</a>
          <a href="#/favorites">Favoritos</a>
          <a href="#/inbox">Mensagens</a>
          <div class="sep"></div>
          ${me.is_admin ? '<a href="#/admin">🛡️ Administração</a>' : ''}
          <a href="#/host">Painel do anfitrião</a>
          <a href="#/host/new">Criar anúncio</a>
          <a href="#/profile">Perfil</a>
          <div class="sep"></div>
          <button id="logout">Sair</button>
        ` : `
          <a href="#/login">Entrar</a>
          <a href="#/signup">Cadastrar-se</a>
          <div class="sep"></div>
          <a href="#/login?next=/host">Anuncie seu espaço</a>
        `}
      </div>
    </div>`;
  const menu = $('#menu');
  $('.menu-btn', menu).onclick = (e) => { e.stopPropagation(); menu.classList.toggle('open'); };
  const lo = $('#logout');
  if (lo) lo.onclick = action(async () => {
    await api('/auth/logout', { method: 'POST' });
    state.me = null; renderNav(); toast('Você saiu da sua conta.'); go('/');
  });
}
document.addEventListener('click', () => { const m = $('#menu'); if (m) m.classList.remove('open'); });

/* Favoritar (delegado: funciona em qualquer card) */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-fav]');
  if (!btn) return;
  e.preventDefault(); e.stopPropagation();
  if (!state.me) return requireLogin();
  const id = btn.dataset.fav;
  const on = btn.classList.contains('on');
  try {
    await api('/favorites/' + id, { method: on ? 'DELETE' : 'POST' });
    $$(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle('on', !on));
    toast(on ? 'Removido dos favoritos.' : 'Salvo nos favoritos ♥');
  } catch (err) { toast(err.message, true); }
});

/* ------------------------------------------------------------ cards */
function listingCard(l, extraBadge = '') {
  const photo = l.photos[0] || '';
  return `
    <a class="card" href="#/listing/${l.id}">
      <div class="card-img">
        ${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : ''}
        ${extraBadge || (l.instant_book ? '<span class="badge">⚡ Reserva imediata</span>' : '')}
        <button class="fav ${l.is_favorite ? 'on' : ''}" data-fav="${l.id}" aria-label="Favoritar">♥</button>
      </div>
      <div class="card-body">
        <div class="row between"><strong>${esc(l.city)}${l.state ? ', ' + esc(l.state) : ''}</strong>${stars(l.rating, l.review_count, false)}</div>
        <div class="title">${esc(l.title)}</div>
        <div class="muted">${esc(l.property_type)} · ${plural(l.max_guests, 'hóspede', 'hóspedes')}</div>
        ${l.host_name ? `<div class="muted small">Anfitrião: ${esc(l.host_name)}</div>` : ''}
        <div style="margin-top:4px"><strong>${money(l.price_per_night)}</strong> <span class="muted">/ noite</span></div>
      </div>
    </a>`;
}

/* ------------------------------------------------------------ map helpers */
function makeMap(el, center, zoom) {
  if (!window.L) { el.innerHTML = '<div class="empty small">Mapa indisponível (sem conexão).</div>'; return null; }
  const map = L.map(el, { scrollWheelZoom: false }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(map);
  cleanup.push(() => map.remove());
  return map;
}

/* ------------------------------------------------------------ HOME / busca */
async function viewHome(main, _m, params) {
  const p = Object.fromEntries(params.entries());
  const selectedAmen = (p.amenities || '').split(',').filter(Boolean);
  const showMap = p.map === '1';
  main.innerHTML = `
    <form class="search" id="search">
      <div class="seg"><label for="s-q">Destino</label><input id="s-q" name="q" placeholder="Para onde você vai?" value="${esc(p.q || '')}"></div>
      <div class="seg"><label for="s-ci">Check-in</label><input id="s-ci" type="date" name="check_in" min="${todayISO()}" value="${esc(p.check_in || '')}"></div>
      <div class="seg"><label for="s-co">Check-out</label><input id="s-co" type="date" name="check_out" min="${todayISO()}" value="${esc(p.check_out || '')}"></div>
      <div class="seg"><label for="s-g">Hóspedes</label><input id="s-g" type="number" min="1" max="50" name="guests" placeholder="Quantos?" value="${esc(p.guests || '')}"></div>
      <button class="btn primary" type="submit">🔍 Buscar</button>
    </form>
    <div class="chips" id="types">
      <button class="chip ${!p.type ? 'on' : ''}" data-type="">Todos</button>
      ${state.meta.property_types.map((t) => `<button class="chip ${p.type === t ? 'on' : ''}" data-type="${esc(t)}">${esc(t)}</button>`).join('')}
    </div>
    <div class="toolbar">
      <div id="count" class="muted">Carregando…</div>
      <div class="row wrap">
        <select id="sort" style="width:auto">
          <option value="newest">Mais recentes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="rating">Melhor avaliados</option>
        </select>
        <button class="btn sm" id="toggle-filters">⚙ Filtros${selectedAmen.length || p.min_price || p.max_price ? ' •' : ''}</button>
        <button class="btn sm" id="toggle-map">${showMap ? '▦ Ver lista' : '🗺 Ver mapa'}</button>
      </div>
    </div>
    <form class="filters" id="filters">
      <div class="grid-2" style="max-width:420px">
        <div class="field"><label>Preço mínimo / noite<input type="number" min="0" name="min_price" value="${esc(p.min_price || '')}"></label></div>
        <div class="field"><label>Preço máximo / noite<input type="number" min="0" name="max_price" value="${esc(p.max_price || '')}"></label></div>
      </div>
      <label>Comodidades</label>
      <div class="checks" style="margin-bottom:14px">
        ${state.meta.amenities.map((a) => `<label class="check"><input type="checkbox" name="amen" value="${esc(a)}" ${selectedAmen.includes(a) ? 'checked' : ''}> ${AMENITY_ICONS[a] || ''} ${esc(a)}</label>`).join('')}
      </div>
      <div class="row"><button class="btn primary sm" type="submit">Aplicar filtros</button><button class="btn ghost sm" type="button" id="clear">Limpar tudo</button></div>
    </form>
    <div id="results"></div>`;

  $('#sort').value = p.sort || 'newest';
  const update = (changes) => {
    const next = { ...p, ...changes };
    Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] == null) delete next[k]; });
    go('/?' + new URLSearchParams(next).toString());
  };
  $('#search').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const ci = f.get('check_in'), co = f.get('check_out');
    if ((ci && !co) || (!ci && co)) return toast('Informe check-in e check-out.', true);
    if (ci && co && co <= ci) return toast('O check-out deve ser depois do check-in.', true);
    update({ q: f.get('q').trim(), check_in: ci, check_out: co, guests: f.get('guests') });
  };
  $('#s-ci').onchange = (e) => { const co = $('#s-co'); co.min = e.target.value ? toISO(addDays(parseISO(e.target.value), 1)) : todayISO(); if (co.value && co.value <= e.target.value) co.value = co.min; };
  $$('#types .chip').forEach((c) => { c.onclick = () => update({ type: c.dataset.type }); });
  $('#sort').onchange = (e) => update({ sort: e.target.value });
  $('#toggle-filters').onclick = () => $('#filters').classList.toggle('open');
  $('#toggle-map').onclick = () => update({ map: showMap ? '' : '1' });
  $('#filters').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    update({ min_price: f.get('min_price'), max_price: f.get('max_price'), amenities: f.getAll('amen').join(',') });
  };
  $('#clear').onclick = () => go('/');

  const qs = new URLSearchParams();
  ['q', 'check_in', 'check_out', 'guests', 'type', 'sort', 'min_price', 'max_price', 'amenities'].forEach((k) => { if (p[k]) qs.set(k, p[k]); });
  const { listings } = await api('/listings?' + qs.toString());
  $('#count').textContent = listings.length ? `${plural(listings.length, 'acomodação encontrada', 'acomodações encontradas')}` : '';
  const results = $('#results');
  if (!listings.length) {
    results.innerHTML = `<div class="empty"><div class="big">🏝️</div><h3>Nenhuma acomodação encontrada</h3><p>Tente mudar as datas, o destino ou remover alguns filtros.</p><a class="btn" href="#/">Limpar busca</a></div>`;
    return;
  }
  if (showMap) {
    results.innerHTML = '<div class="map tall" id="map"></div>';
    const pts = listings.filter((l) => l.lat != null && l.lng != null);
    const map = makeMap($('#map'), [-15.8, -47.9], 4);
    if (!map) return;
    const markers = pts.map((l) => L.marker([l.lat, l.lng], {
      icon: L.divIcon({ className: '', html: `<div class="price-pin">${money(l.price_per_night)}</div>`, iconSize: null }),
    }).addTo(map).bindPopup(`<a href="#/listing/${l.id}" style="text-decoration:none;color:inherit"><img src="${esc(l.photos[0] || '')}" style="width:200px;height:120px;object-fit:cover;border-radius:8px"><strong>${esc(l.title)}</strong><br>${esc(l.city)} · ${money(l.price_per_night)}/noite</a>`));
    if (markers.length) map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2), { maxZoom: 12 });
  } else {
    results.innerHTML = `<div class="grid">${listings.map((l) => listingCard(l)).join('')}</div>`;
  }
}

/* ------------------------------------------------------------ calendário */
function renderCalendar(el, { unavailable, getRange, onPick }) {
  const booked = new Set();
  unavailable.forEach((r) => {
    for (let d = parseISO(r.check_in); toISO(d) < r.check_out; d = addDays(d, 1)) booked.add(toISO(d));
  });
  const today = todayISO();
  let offset = 0;
  const freeNights = (a, b) => { for (let d = parseISO(a); toISO(d) < b; d = addDays(d, 1)) if (booked.has(toISO(d))) return false; return true; };

  function month(base) {
    const first = new Date(base.getFullYear(), base.getMonth(), 1);
    const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
    const { ci, co } = getRange();
    let cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < first.getDay(); i++) cells += '<div></div>';
    for (let n = 1; n <= days; n++) {
      const iso = toISO(new Date(base.getFullYear(), base.getMonth(), n));
      // Um dia pode ser check-out mesmo que a noite dele esteja ocupada.
      const asCheckout = ci && !co && iso > ci && freeNights(ci, iso);
      const disabled = iso < today || (booked.has(iso) && !asCheckout);
      const sel = iso === ci || iso === co;
      const inRange = ci && co && iso > ci && iso < co;
      cells += `<button type="button" class="cal-day ${sel ? 'sel' : ''} ${inRange ? 'in-range' : ''}" data-day="${iso}" ${disabled ? 'disabled' : ''}>${n}</button>`;
    }
    return `<div class="cal-month"><h4>${(() => { const s = first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); })()}</h4><div class="cal-grid">${cells}</div></div>`;
  }

  function draw() {
    const now = new Date();
    const m1 = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const m2 = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
    el.innerHTML = `
      <div class="cal-head">
        <button type="button" class="btn sm ghost" data-nav="-1" ${offset === 0 ? 'disabled' : ''}>‹ Anterior</button>
        <button type="button" class="btn sm ghost" data-clear>Limpar datas</button>
        <button type="button" class="btn sm ghost" data-nav="1" ${offset >= 11 ? 'disabled' : ''}>Próximo ›</button>
      </div>
      <div class="calendar">${month(m1)}${month(m2)}</div>`;
    $$('[data-nav]', el).forEach((b) => { b.onclick = () => { offset += Number(b.dataset.nav); draw(); }; });
    $('[data-clear]', el).onclick = () => { onPick('', ''); draw(); };
    $$('[data-day]', el).forEach((b) => {
      b.onclick = () => {
        const day = b.dataset.day;
        const { ci, co } = getRange();
        if (ci && !co && day > ci && freeNights(ci, day)) onPick(ci, day);
        else if (!booked.has(day)) onPick(day, '');
        draw();
      };
    });
  }
  draw();
  return { draw, freeNights };
}

/* ------------------------------------------------------------ anúncio */
async function viewListing(main, [id], params) {
  const { listing: l } = await api('/listings/' + id);
  const photos = l.photos.slice(0, 5);
  const range = { ci: params.get('check_in') || '', co: params.get('check_out') || '' };
  main.innerHTML = `
    <div class="row between wrap">
      <h1>${esc(l.title)}</h1>
      <div class="row">
        ${l.is_owner ? `<a class="btn sm" href="#/host/edit/${l.id}">✎ Editar anúncio</a>` : ''}
        <button class="btn sm ghost fav-inline" id="fav-btn">${l.is_favorite ? '♥ Salvo' : '♡ Salvar'}</button>
      </div>
    </div>
    <div class="row wrap small">
      ${stars(l.rating, l.review_count)} · <span>${esc(l.city)}${l.state ? ', ' + esc(l.state) : ''}, ${esc(l.country)}</span>
      ${!l.active ? '<span class="badge declined">Pausado</span>' : ''}
    </div>
    <div class="gallery n${photos.length >= 4 ? 5 : photos.length}">${photos.map((p, i) => `<img src="${esc(p)}" alt="Foto ${i + 1}" data-i="${i}">`).join('')}</div>
    <div class="detail">
      <div>
        <div class="row between">
          <div>
            <h2 style="margin:0">${esc(l.property_type)} hospedado por ${esc(l.host.name)}</h2>
            <div class="facts">${plural(l.max_guests, 'hóspede', 'hóspedes')} · ${plural(l.bedrooms, 'quarto', 'quartos')} · ${plural(l.beds, 'cama', 'camas')} · ${plural(Number(l.bathrooms), 'banheiro', 'banheiros')}</div>
          </div>
          <a href="#/user/${l.host.id}">${avatar(l.host.name, l.host.avatar, 'lg')}</a>
        </div>
        <hr>
        ${l.instant_book ? '<p>⚡ <strong>Reserva imediata</strong> — sua reserva é confirmada na hora, sem esperar o anfitrião.</p>' : '<p>📨 <strong>Solicitação de reserva</strong> — o anfitrião confirma seu pedido em breve.</p>'}
        <p style="white-space:pre-wrap">${esc(l.description)}</p>
        <hr>
        <h2>O que esse lugar oferece</h2>
        <div class="amenities">${l.amenities.length ? l.amenities.map((a) => `<div>${AMENITY_ICONS[a] || '✓'} ${esc(a)}</div>`).join('') : '<div class="muted">Nenhuma comodidade informada.</div>'}</div>
        <hr>
        <h2>Disponibilidade</h2>
        <p class="muted small">Selecione a data de check-in e depois a de check-out.</p>
        <div id="cal"></div>
        <hr>
        <h2>${l.review_count ? `★ ${Number(l.rating).toFixed(2).replace('.', ',')} · ${plural(l.review_count, 'avaliação', 'avaliações')}` : 'Ainda sem avaliações'}</h2>
        <div class="reviews">${l.reviews.map((r) => `
          <div class="review">
            <div class="host-row">${avatar(r.author_name, r.author_avatar)}<div><strong>${esc(r.author_name)}</strong><div class="small muted">${fmtDateTime(r.created_at)} · ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div></div></div>
            <p style="margin:8px 0 0">${esc(r.comment)}</p>
          </div>`).join('')}</div>
        ${l.lat != null ? `<hr><h2>Onde você vai estar</h2><p class="muted">${esc(l.city)}${l.state ? ', ' + esc(l.state) : ''} — o endereço exato é enviado após a confirmação.</p><div class="map" id="map"></div>` : ''}
        <hr>
        <div class="host-row">
          <a href="#/user/${l.host.id}">${avatar(l.host.name, l.host.avatar, 'lg')}</a>
          <div><h3 style="margin:0">Anfitrião: ${esc(l.host.name)}</h3><div class="small muted">No Estadia desde ${new Date(l.host.created_at.replace(' ', 'T')).getFullYear()} · ${plural(l.host.listing_count, 'anúncio', 'anúncios')}</div></div>
        </div>
        ${l.host.bio ? `<p>${esc(l.host.bio)}</p>` : ''}
      </div>
      <aside class="booking-box" id="box"></aside>
    </div>`;

  // Lightbox da galeria
  $$('.gallery img').forEach((img) => { img.onclick = () => lightbox(l.photos, Number(img.dataset.i)); });

  $('#fav-btn').onclick = action(async () => {
    if (!state.me) return requireLogin();
    l.is_favorite = !l.is_favorite;
    await api('/favorites/' + l.id, { method: l.is_favorite ? 'POST' : 'DELETE' });
    $('#fav-btn').textContent = l.is_favorite ? '♥ Salvo' : '♡ Salvar';
  });

  if (l.lat != null) {
    const map = makeMap($('#map'), [l.lat, l.lng], 13);
    if (map) L.circle([l.lat, l.lng], { radius: 400, color: '#0f766e', fillOpacity: 0.2 }).addTo(map);
  }

  const cal = renderCalendar($('#cal'), {
    unavailable: l.unavailable,
    getRange: () => range,
    onPick: (ci, co) => { range.ci = ci; range.co = co; drawBox(); },
  });
  if (range.ci && range.co && !cal.freeNights(range.ci, range.co)) { range.ci = range.co = ''; cal.draw(); }

  function drawBox() {
    const box = $('#box');
    const nights = range.ci && range.co ? nightsBetween(range.ci, range.co) : 0;
    const subtotal = nights * l.price_per_night;
    const guestsVal = (box.querySelector('#b-g') || {}).value || params.get('guests') || 1;
    const msgVal = (box.querySelector('#b-msg') || {}).value || '';
    box.innerHTML = `
      <div style="margin-bottom:14px"><span style="font-size:22px;font-weight:700">${money(l.price_per_night)}</span> <span class="muted">/ noite</span></div>
      <div class="dates">
        <div><label for="b-ci">Check-in</label><input id="b-ci" type="date" min="${todayISO()}" value="${range.ci}"></div>
        <div><label for="b-co">Check-out</label><input id="b-co" type="date" min="${range.ci ? toISO(addDays(parseISO(range.ci), 1)) : todayISO()}" value="${range.co}"></div>
      </div>
      <div class="guests"><label for="b-g">Hóspedes</label><input id="b-g" type="number" min="1" max="${l.max_guests}" value="${esc(guestsVal)}"></div>
      ${l.is_owner ? '<div class="notice">Este é o seu anúncio. Hóspedes verão aqui o formulário de reserva.</div>' : `
        ${!l.instant_book ? `<div class="field"><label for="b-msg" style="text-transform:none;font-size:13px">Mensagem para o anfitrião (opcional)</label><textarea id="b-msg" style="min-height:70px" placeholder="Conte um pouco sobre a sua viagem…">${esc(msgVal)}</textarea></div>` : ''}
        <button class="btn primary block" id="reserve">${l.instant_book ? 'Reservar agora' : 'Solicitar reserva'}</button>
        <div class="notice">💳 Nenhum pagamento é cobrado agora. O pagamento online será adicionado em breve.</div>`}
      ${nights ? `
        <div class="breakdown">
          <div class="row"><span>${money2(l.price_per_night)} × ${plural(nights, 'noite', 'noites')}</span><span>${money2(subtotal)}</span></div>
          ${l.cleaning_fee ? `<div class="row"><span>Taxa de limpeza</span><span>${money2(l.cleaning_fee)}</span></div>` : ''}
          <div class="row total"><span>Total</span><span>${money2(subtotal + l.cleaning_fee)}</span></div>
        </div>` : '<p class="small muted" style="text-align:center;margin-bottom:0">Escolha as datas para ver o preço total.</p>'}`;

    $('#b-ci').onchange = (e) => {
      range.ci = e.target.value;
      if (range.co && range.co <= range.ci) range.co = '';
      if (range.ci && range.co && !cal.freeNights(range.ci, range.co)) { range.co = ''; toast('Algumas noites nesse período já estão reservadas.', true); }
      cal.draw(); drawBox();
    };
    $('#b-co').onchange = (e) => {
      range.co = e.target.value;
      if (range.ci && range.co && (range.co <= range.ci || !cal.freeNights(range.ci, range.co))) { range.co = ''; toast('Período indisponível. Escolha outras datas.', true); }
      cal.draw(); drawBox();
    };
    const r = $('#reserve');
    if (r) r.onclick = action(async () => {
      const guests = Number($('#b-g').value);
      if (!state.me) {
        // Volta para este anúncio com as mesmas datas depois do login.
        const back = `/listing/${l.id}?` + new URLSearchParams({ check_in: range.ci, check_out: range.co, guests: guests || 1 });
        toast('Entre na sua conta para concluir a reserva.');
        return go('/login?next=' + encodeURIComponent(back));
      }
      if (!range.ci || !range.co) throw new Error('Escolha as datas de check-in e check-out no calendário.');
      if (!guests || guests < 1 || guests > l.max_guests) throw new Error(`Informe de 1 a ${l.max_guests} hóspedes.`);
      const res = await api('/bookings', { method: 'POST', body: { listing_id: l.id, check_in: range.ci, check_out: range.co, guests, message: ($('#b-msg') || {}).value || '' } });
      toast(res.status === 'confirmed' ? 'Reserva confirmada! 🎉' : 'Solicitação enviada ao anfitrião.');
      go('/booking/' + res.id);
    });
  }
  drawBox();
}

function lightbox(photos, start) {
  let i = start;
  const el = document.createElement('div');
  el.className = 'lightbox';
  const draw = () => { el.innerHTML = `<img src="${esc(photos[i])}" alt=""><button class="close" aria-label="Fechar">×</button>${photos.length > 1 ? '<button class="prev" aria-label="Anterior">‹</button><button class="next" aria-label="Próxima">›</button>' : ''}`; };
  const close = () => { el.remove(); document.removeEventListener('keydown', key); };
  const move = (d) => { i = (i + d + photos.length) % photos.length; draw(); };
  const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') move(1); if (e.key === 'ArrowLeft') move(-1); };
  el.onclick = (e) => {
    if (e.target.classList.contains('prev')) move(-1);
    else if (e.target.classList.contains('next')) move(1);
    else if (e.target.tagName !== 'IMG') close();
  };
  document.addEventListener('keydown', key);
  cleanup.push(close);
  draw();
  document.body.appendChild(el);
}

/* ------------------------------------------------------------ auth */
function viewLogin(main, _m, params) {
  const next = params.get('next') || '/';
  main.innerHTML = `
    <div class="auth card-box">
      <h1>Entrar</h1>
      <p class="muted">Bem-vindo de volta ao Estadia.</p>
      <form id="f">
        <div class="field"><label>E-mail ou usuário<input name="login" required autocomplete="username" autocapitalize="none"></label></div>
        <div class="field"><label>Senha<input name="password" type="password" required autocomplete="current-password"></label></div>
        <button class="btn primary block">Entrar</button>
      </form>
      <p class="small" style="text-align:center">Não tem conta? <a href="#/signup?next=${encodeURIComponent(next)}">Cadastre-se</a></p>
    </div>`;
  $('#f').onsubmit = (e) => {
    e.preventDefault();
    action(async () => {
      const f = new FormData(e.target);
      const { user } = await api('/auth/login', { method: 'POST', body: { login: f.get('login').trim(), password: f.get('password') } });
      state.me = user; renderNav(); toast(`Olá, ${user.name.split(' ')[0]}!`); go(next);
    })();
  };
}

function viewSignup(main, _m, params) {
  const next = params.get('next') || '/';
  main.innerHTML = `
    <div class="auth card-box">
      <h1>Criar conta</h1>
      <p class="muted">Viaje ou anuncie seu espaço com a mesma conta.</p>
      <form id="f">
        <div class="field"><label>Nome completo<input name="name" required autocomplete="name"></label></div>
        <div class="field"><label>E-mail<input name="email" type="email" required autocomplete="email"></label></div>
        <div class="field"><label>Senha (mín. 6 caracteres)<input name="password" type="password" minlength="6" required autocomplete="new-password"></label></div>
        <button class="btn primary block">Cadastrar</button>
      </form>
      <p class="small" style="text-align:center">Já tem conta? <a href="#/login?next=${encodeURIComponent(next)}">Entrar</a></p>
    </div>`;
  $('#f').onsubmit = (e) => {
    e.preventDefault();
    action(async () => {
      const f = new FormData(e.target);
      const { user } = await api('/auth/register', { method: 'POST', body: Object.fromEntries(f.entries()) });
      state.me = user; renderNav(); toast('Conta criada! Bem-vindo(a) ao Estadia.'); go(next);
    })();
  };
}

/* ------------------------------------------------------------ viagens */
function bookingItem(b, { showGuest = false, actions = '' } = {}) {
  return `
    <a class="list-item" href="#/booking/${b.id}">
      ${b.listing_photo ? `<img src="${esc(b.listing_photo)}" alt="">` : '<div class="ph"></div>'}
      <div class="grow">
        <div class="row wrap">${statusBadge(b)}${b.message_count ? `<span class="small muted">💬 ${b.message_count}</span>` : ''}</div>
        <strong>${esc(b.listing_title)}</strong>
        <div class="small muted">${fmtShort(b.check_in)} – ${fmtDate(b.check_out)} · ${plural(b.nights, 'noite', 'noites')} · ${plural(b.guests, 'hóspede', 'hóspedes')}</div>
        <div class="small">${showGuest ? `Hóspede: ${esc(b.guest_name)} · ` : `${esc(b.listing_city)} · Anfitrião: ${esc(b.host_name)} · `}<strong>${money2(b.total_price)}</strong></div>
      </div>
      ${actions ? `<div class="actions">${actions}</div>` : ''}
    </a>`;
}

async function viewTrips(main) {
  const { bookings } = await api('/bookings');
  const t = todayISO();
  const groups = [
    ['Próximas viagens', bookings.filter((b) => b.status === 'confirmed' && b.check_out > t).reverse()],
    ['Aguardando confirmação', bookings.filter((b) => b.status === 'pending')],
    ['Viagens anteriores', bookings.filter((b) => b.status === 'confirmed' && b.check_out <= t)],
    ['Canceladas ou recusadas', bookings.filter((b) => b.status === 'cancelled' || b.status === 'declined')],
  ];
  main.innerHTML = `<h1>Minhas viagens</h1>` + (bookings.length ? groups.filter(([, list]) => list.length).map(([title, list]) => `
      <h2 style="margin-top:24px">${title}</h2>
      ${list.map((b) => bookingItem(b, { actions: b.can_review ? '<span class="btn sm primary">★ Avaliar</span>' : '' })).join('')}`).join('')
    : `<div class="empty"><div class="big">🧳</div><h3>Nenhuma viagem ainda</h3><p>Hora de tirar o pó das malas e planejar a próxima aventura.</p><a class="btn primary" href="#/">Explorar acomodações</a></div>`);
}

async function viewFavorites(main) {
  const { listings } = await api('/favorites');
  main.innerHTML = `<h1>Favoritos</h1>` + (listings.length
    ? `<div class="grid" style="margin-top:20px">${listings.map((l) => listingCard(l)).join('')}</div>`
    : `<div class="empty"><div class="big">♡</div><h3>Nenhum favorito ainda</h3><p>Toque no coração de um anúncio para salvá-lo aqui.</p><a class="btn primary" href="#/">Explorar</a></div>`);
}

async function viewInbox(main) {
  const { conversations } = await api('/inbox');
  main.innerHTML = `<h1>Mensagens</h1>` + (conversations.length ? conversations.map((c) => {
    const other = c.role === 'host' ? c.guest_name : c.host_name;
    const otherAv = c.role === 'host' ? c.guest_avatar : c.host_avatar;
    const mine = c.last_message.sender_id === state.me.id;
    return `<a class="list-item" href="#/booking/${c.id}">
        ${avatar(other, otherAv, 'lg')}
        <div class="grow">
          <div class="row between"><strong>${esc(other)}</strong><span class="small muted">${fmtDateTime(c.last_message.created_at)}</span></div>
          <div class="small muted">${esc(c.listing_title)} · ${fmtShort(c.check_in)} – ${fmtShort(c.check_out)} · ${c.role === 'host' ? 'você é o anfitrião' : 'sua viagem'}</div>
          <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${mine ? 'Você: ' : ''}${esc(c.last_message.body)}</div>
        </div>
      </a>`;
  }).join('') : `<div class="empty"><div class="big">💬</div><h3>Nenhuma conversa ainda</h3><p>As conversas com anfitriões e hóspedes aparecem aqui.</p></div>`);
}

/* ------------------------------------------------------------ reserva */
async function viewBooking(main, [id]) {
  let b = (await api('/bookings/' + id)).booking;

  function draw() {
    const isAdmin = b.role === 'admin';
    const other = b.role === 'host' ? { name: b.guest_name, avatar: b.guest_avatar, label: 'Hóspede' } : { name: b.host_name, avatar: b.host_avatar, label: 'Anfitrião' };
    const back = { host: ['#/host', 'Painel do anfitrião'], guest: ['#/trips', 'Minhas viagens'], admin: ['#/admin', 'Administração'] }[b.role];
    main.innerHTML = `
      <a href="${back[0]}" class="small">‹ ${back[1]}</a>
      <div class="detail" style="margin-top:12px">
        <div>
          <div class="row wrap" style="margin-bottom:8px">${statusBadge(b)}<span class="small muted">Reserva nº ${b.id}</span></div>
          <h1>${esc(b.listing_title)}</h1>
          <p class="muted" style="margin-top:0">${esc(b.listing_city)}${b.listing_state ? ', ' + esc(b.listing_state) : ''}</p>
          ${b.status === 'pending' && b.role === 'guest' ? '<div class="notice">Sua solicitação foi enviada. O anfitrião vai confirmar ou recusar em breve.</div>' : ''}
          ${b.status === 'pending' && b.role === 'host' ? '<div class="notice">Este hóspede está aguardando sua resposta. Confirme ou recuse a solicitação.</div>' : ''}
          ${isAdmin ? '<div class="notice">🛡️ Você está vendo esta reserva como administrador. Pode confirmar, recusar ou cancelar em nome do anfitrião.</div>' : ''}
          <h2 style="margin-top:28px">${isAdmin ? `Mensagens entre ${esc(b.guest_name)} e ${esc(b.host_name)}` : `Mensagens com ${esc(other.name)}`}</h2>
          <div class="chat">
            <div class="chat-log" id="log">
              ${b.messages.length ? b.messages.map((m) => `
                <div class="bubble ${m.sender_id === state.me.id ? 'me' : ''}">${esc(m.body)}<div class="meta">${m.sender_id === state.me.id ? 'Você' : esc(m.sender_name)} · ${fmtDateTime(m.created_at)}</div></div>`).join('')
                : '<div class="muted small" style="text-align:center;margin:auto">Nenhuma mensagem ainda. Diga olá! 👋</div>'}
            </div>
            <form id="msg-form"><textarea name="body" placeholder="Escreva uma mensagem…" required maxlength="2000"></textarea><button class="btn primary">Enviar</button></form>
          </div>
          ${b.can_review ? `
            <h2 style="margin-top:28px">Avalie sua estadia</h2>
            <form id="review-form" class="card-box">
              <div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-label="${n} estrelas">★</button>`).join('')}</div>
              <div class="field" style="margin-top:10px"><textarea name="comment" placeholder="Como foi a experiência?" maxlength="2000"></textarea></div>
              <button class="btn primary">Publicar avaliação</button>
            </form>` : ''}
          ${b.review ? `<h2 style="margin-top:28px">Avaliação</h2><div class="card-box"><div>${'★'.repeat(b.review.rating)}${'☆'.repeat(5 - b.review.rating)}</div><p style="margin-bottom:0">${esc(b.review.comment) || '<span class="muted">Sem comentário.</span>'}</p></div>` : ''}
        </div>
        <aside class="booking-box">
          ${b.listing_photo ? `<img src="${esc(b.listing_photo)}" alt="" style="border-radius:10px;width:100%;height:170px;object-fit:cover;margin-bottom:14px">` : ''}
          <a href="#/listing/${b.listing_id}" class="small">Ver anúncio ›</a>
          ${isAdmin ? `
            <div class="host-row" style="margin:14px 0 8px">${avatar(b.host_name, b.host_avatar)}<div><div class="small muted">Anfitrião</div><strong>${esc(b.host_name)}</strong></div></div>
            <div class="host-row" style="margin:0 0 14px">${avatar(b.guest_name, b.guest_avatar)}<div><div class="small muted">Hóspede</div><strong>${esc(b.guest_name)}</strong></div></div>`
          : `<div class="host-row" style="margin:14px 0">${avatar(other.name, other.avatar)}<div><div class="small muted">${other.label}</div><strong>${esc(other.name)}</strong></div></div>`}
          <div class="breakdown">
            <div class="row"><span>Check-in</span><strong>${fmtDate(b.check_in)}</strong></div>
            <div class="row"><span>Check-out</span><strong>${fmtDate(b.check_out)}</strong></div>
            <div class="row"><span>Hóspedes</span><strong>${b.guests}</strong></div>
            ${b.listing_address ? `<div class="row"><span>Endereço</span><strong style="text-align:right">${esc(b.listing_address)}</strong></div>` : ''}
            <hr style="margin:12px 0">
            <div class="row"><span>${money2(b.price_per_night)} × ${plural(b.nights, 'noite', 'noites')}</span><span>${money2(b.price_per_night * b.nights)}</span></div>
            ${b.cleaning_fee ? `<div class="row"><span>Taxa de limpeza</span><span>${money2(b.cleaning_fee)}</span></div>` : ''}
            <div class="row total"><span>Total</span><span>${money2(b.total_price)}</span></div>
          </div>
          <div class="notice">💳 Pagamento online ainda não disponível — combine os detalhes pelo chat.</div>
          <div class="stack" style="margin-top:14px">
            ${b.can_confirm ? '<button class="btn primary block" data-act="confirm">✓ Confirmar reserva</button>' : ''}
            ${b.can_decline ? '<button class="btn block" data-act="decline">Recusar</button>' : ''}
            ${b.can_cancel ? '<button class="btn danger block" data-act="cancel">Cancelar reserva</button>' : ''}
          </div>
        </aside>
      </div>`;
    const log = $('#log'); log.scrollTop = log.scrollHeight;

    $('#msg-form').onsubmit = (e) => {
      e.preventDefault();
      action(async () => {
        const body = new FormData(e.target).get('body').trim();
        if (!body) return;
        b = (await api(`/bookings/${b.id}/messages`, { method: 'POST', body: { body } })).booking;
        draw();
      })();
    };
    $('#msg-form textarea').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#msg-form').requestSubmit(); } };

    const labels = { confirm: 'Confirmar esta reserva?', decline: 'Recusar esta solicitação?', cancel: 'Tem certeza que deseja cancelar esta reserva?' };
    $$('[data-act]').forEach((btn) => {
      btn.onclick = action(async () => {
        if (!confirm(labels[btn.dataset.act])) return;
        b = (await api(`/bookings/${b.id}/${btn.dataset.act}`, { method: 'POST' })).booking;
        toast({ confirm: 'Reserva confirmada.', decline: 'Solicitação recusada.', cancel: 'Reserva cancelada.' }[btn.dataset.act]);
        draw();
      });
    });

    const rf = $('#review-form');
    if (rf) {
      let rating = 0;
      $$('#stars button').forEach((s) => {
        s.onclick = () => { rating = Number(s.dataset.n); $$('#stars button').forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= rating)); };
      });
      rf.onsubmit = (e) => {
        e.preventDefault();
        action(async () => {
          if (!rating) throw new Error('Escolha uma nota de 1 a 5 estrelas.');
          b = (await api(`/bookings/${b.id}/review`, { method: 'POST', body: { rating, comment: new FormData(rf).get('comment') } })).booking;
          toast('Obrigado pela avaliação!'); draw();
        })();
      };
    }
  }
  draw();

  // Atualiza o chat periodicamente (sem atrapalhar quem está digitando).
  const timer = setInterval(async () => {
    const ta = $('#msg-form textarea');
    if (document.hidden || (ta && ta.value) || $('#review-form textarea')?.value) return;
    try {
      const fresh = (await api('/bookings/' + id)).booking;
      if (fresh.messages.length !== b.messages.length || fresh.status !== b.status) { b = fresh; draw(); }
    } catch (_) { /* ignora */ }
  }, 8000);
  cleanup.push(() => clearInterval(timer));
}

/* ------------------------------------------------------------ anfitrião */
async function viewHost(main, _m, params) {
  const [{ listings }, { bookings }] = await Promise.all([api('/host/listings'), api('/host/bookings')]);
  const t = todayISO();
  const tab = params.get('tab') || (bookings.some((b) => b.can_confirm) ? 'requests' : 'upcoming');
  const pending = bookings.filter((b) => b.can_confirm);
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.check_out > t).reverse();
  const past = bookings.filter((b) => (b.status === 'confirmed' && b.check_out <= t) || ['declined', 'cancelled'].includes(b.status) || (b.status === 'pending' && !b.can_confirm));
  const revenue = bookings.filter((b) => b.status === 'confirmed').reduce((s, b) => s + b.total_price, 0);

  const tabs = [
    ['requests', `Solicitações (${pending.length})`],
    ['upcoming', `Próximas (${upcoming.length})`],
    ['past', 'Histórico'],
    ['listings', `Meus anúncios (${listings.length})`],
  ];
  let body = '';
  const actionsFor = (b) => (b.can_confirm ? `<button class="btn sm primary" data-act="confirm" data-id="${b.id}">Confirmar</button><button class="btn sm" data-act="decline" data-id="${b.id}">Recusar</button>` : '');
  if (tab === 'requests') body = pending.length ? pending.map((b) => bookingItem(b, { showGuest: true, actions: actionsFor(b) })).join('') : '<div class="empty"><div class="big">📭</div><p>Nenhuma solicitação pendente.</p></div>';
  if (tab === 'upcoming') body = upcoming.length ? upcoming.map((b) => bookingItem(b, { showGuest: true })).join('') : '<div class="empty"><div class="big">📅</div><p>Nenhuma estadia confirmada por vir.</p></div>';
  if (tab === 'past') body = past.length ? past.map((b) => bookingItem(b, { showGuest: true })).join('') : '<div class="empty"><p>Sem histórico ainda.</p></div>';
  if (tab === 'listings') {
    body = listings.length ? listings.map((l) => `
      <div class="list-item">
        <img src="${esc(l.photos[0] || '')}" alt="">
        <div class="grow">
          <div class="row wrap">${l.active ? '<span class="badge confirmed">Ativo</span>' : '<span class="badge declined">Pausado</span>'}${l.instant_book ? '<span class="badge">⚡ Imediata</span>' : ''}</div>
          <strong>${esc(l.title)}</strong>
          <div class="small muted">${esc(l.city)} · ${money(l.price_per_night)}/noite · ${stars(l.rating, l.review_count)}</div>
        </div>
        <div class="actions">
          <a class="btn sm" href="#/listing/${l.id}">Ver</a>
          <a class="btn sm" href="#/host/edit/${l.id}">Editar</a>
          <button class="btn sm" data-toggle="${l.id}">${l.active ? 'Pausar' : 'Ativar'}</button>
          <button class="btn sm danger" data-del="${l.id}">Excluir</button>
        </div>
      </div>`).join('') : '<div class="empty"><div class="big">🏡</div><h3>Você ainda não tem anúncios</h3><p>Ganhe uma renda extra hospedando viajantes.</p><a class="btn primary" href="#/host/new">Criar meu primeiro anúncio</a></div>';
  }

  main.innerHTML = `
    <div class="row between wrap"><h1>Painel do anfitrião</h1><a class="btn primary" href="#/host/new">+ Novo anúncio</a></div>
    <div class="stats" style="margin-top:16px">
      <div class="stat"><div class="small muted">Anúncios ativos</div><div class="n">${listings.filter((l) => l.active).length}</div></div>
      <div class="stat"><div class="small muted">Solicitações pendentes</div><div class="n">${pending.length}</div></div>
      <div class="stat"><div class="small muted">Próximas estadias</div><div class="n">${upcoming.length}</div></div>
      <div class="stat"><div class="small muted">Valor reservado (confirmadas)</div><div class="n">${money(revenue)}</div></div>
    </div>
    <div class="tabs">${tabs.map(([k, label]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${label}</button>`).join('')}</div>
    <div>${body}</div>`;

  $$('[data-tab]').forEach((b) => { b.onclick = () => go('/host?tab=' + b.dataset.tab); });
  $$('[data-act]').forEach((btn) => {
    btn.onclick = action(async (e) => {
      e.preventDefault(); e.stopPropagation();
      await api(`/bookings/${btn.dataset.id}/${btn.dataset.act}`, { method: 'POST' });
      toast(btn.dataset.act === 'confirm' ? 'Reserva confirmada.' : 'Solicitação recusada.');
      router();
    });
  });
  $$('[data-toggle]').forEach((btn) => {
    btn.onclick = action(async () => {
      const r = await api(`/listings/${btn.dataset.toggle}/toggle`, { method: 'POST' });
      toast(r.active ? 'Anúncio ativado.' : 'Anúncio pausado — ele não aparece mais nas buscas.');
      router();
    });
  });
  $$('[data-del]').forEach((btn) => {
    btn.onclick = action(async () => {
      if (!confirm('Excluir este anúncio permanentemente? Essa ação não pode ser desfeita.')) return;
      await api('/listings/' + btn.dataset.del, { method: 'DELETE' });
      toast('Anúncio excluído.'); router();
    });
  });
}

/* Reduz a imagem no navegador antes do upload. */
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function viewListingForm(main, [id]) {
  const editing = Boolean(id);
  let l = { title: '', description: '', property_type: 'Apartamento', city: '', state: '', country: 'Brasil', address: '', lat: null, lng: null, price_per_night: '', cleaning_fee: 0, max_guests: 2, bedrooms: 1, beds: 1, bathrooms: 1, amenities: [], photos: [], instant_book: false };
  if (editing) {
    l = (await api('/listings/' + id)).listing;
    if (!l.is_owner) throw new Error('Você não é o anfitrião deste anúncio.');
  }
  const photos = [...l.photos];
  main.innerHTML = `
    <a href="#/host?tab=listings" class="small">‹ Painel do anfitrião</a>
    <h1 style="margin-top:8px">${editing ? 'Editar anúncio' : 'Anuncie seu espaço'}</h1>
    <form id="lf" style="max-width:820px" novalidate>
      <div class="card-box" style="margin-top:16px">
        <h2>Sobre o lugar</h2>
        <div class="field"><label>Título<input name="title" maxlength="100" required value="${esc(l.title)}" placeholder="Ex.: Casa aconchegante com vista para o mar"></label></div>
        <div class="field"><label>Tipo de imóvel<select name="property_type">${state.meta.property_types.map((t) => `<option ${t === l.property_type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label></div>
        <div class="field"><label>Descrição<textarea name="description" maxlength="5000" placeholder="O que torna seu espaço especial?">${esc(l.description)}</textarea></label></div>
        <div class="grid-4">
          <div class="field"><label>Hóspedes<input name="max_guests" type="number" min="1" max="50" value="${l.max_guests}"></label></div>
          <div class="field"><label>Quartos<input name="bedrooms" type="number" min="0" max="50" value="${l.bedrooms}"></label></div>
          <div class="field"><label>Camas<input name="beds" type="number" min="1" max="100" value="${l.beds}"></label></div>
          <div class="field"><label>Banheiros<input name="bathrooms" type="number" min="0" max="50" step="0.5" value="${l.bathrooms}"></label></div>
        </div>
      </div>

      <div class="card-box" style="margin-top:16px">
        <h2>Fotos</h2>
        <p class="small muted">A primeira foto é a capa. Envie arquivos do seu computador ou cole um link de imagem.</p>
        <div class="photos" id="photos"></div>
        <div class="row wrap">
          <label class="btn sm" style="margin:0">📷 Enviar fotos<input type="file" id="files" accept="image/*" multiple hidden></label>
          <input id="photo-url" placeholder="https://… (link da imagem)" style="flex:1;min-width:200px">
          <button type="button" class="btn sm" id="add-url">Adicionar link</button>
        </div>
        <div id="upload-status" class="small muted" style="margin-top:6px"></div>
      </div>

      <div class="card-box" style="margin-top:16px">
        <h2>Localização</h2>
        <div class="grid-2">
          <div class="field"><label>Cidade<input name="city" required value="${esc(l.city)}"></label></div>
          <div class="field"><label>Estado<input name="state" value="${esc(l.state)}"></label></div>
          <div class="field"><label>País<input name="country" value="${esc(l.country)}"></label></div>
          <div class="field"><label>Endereço (só aparece para hóspedes confirmados)<input name="address" value="${esc(l.address || '')}"></label></div>
        </div>
        <p class="small muted">Clique no mapa para marcar a localização aproximada.</p>
        <div class="map" id="map"></div>
        <div class="small muted" id="coords" style="margin-top:6px"></div>
      </div>

      <div class="card-box" style="margin-top:16px">
        <h2>Comodidades</h2>
        <div class="checks">${state.meta.amenities.map((a) => `<label class="check"><input type="checkbox" name="amenities" value="${esc(a)}" ${l.amenities.includes(a) ? 'checked' : ''}> ${AMENITY_ICONS[a] || ''} ${esc(a)}</label>`).join('')}</div>
      </div>

      <div class="card-box" style="margin-top:16px">
        <h2>Preço e reservas</h2>
        <div class="grid-2">
          <div class="field"><label>Preço por noite (R$)<input name="price_per_night" type="number" min="1" step="1" required value="${l.price_per_night}"></label></div>
          <div class="field"><label>Taxa de limpeza (R$)<input name="cleaning_fee" type="number" min="0" step="1" value="${l.cleaning_fee}"></label></div>
        </div>
        <label class="check"><input type="checkbox" name="instant_book" ${l.instant_book ? 'checked' : ''}> ⚡ Reserva imediata — confirmar reservas automaticamente, sem minha aprovação</label>
      </div>

      <div class="row" style="margin-top:20px">
        <button class="btn primary" id="save">${editing ? 'Salvar alterações' : 'Publicar anúncio'}</button>
        <a class="btn ghost" href="#/host?tab=listings">Cancelar</a>
      </div>
    </form>`;

  const drawPhotos = () => {
    $('#photos').innerHTML = photos.length ? photos.map((p, i) => `
      <div class="photo"><img src="${esc(p)}" alt="">
        ${i === 0 ? '<span class="badge cover">Capa</span>' : ''}
        <div class="tools">
          ${i > 0 ? `<button type="button" data-cover="${i}">Tornar capa</button>` : ''}
          <button type="button" data-rm="${i}">✕</button>
        </div>
      </div>`).join('') : '<div class="muted small">Nenhuma foto ainda.</div>';
    $$('[data-rm]').forEach((b) => { b.onclick = () => { photos.splice(Number(b.dataset.rm), 1); drawPhotos(); }; });
    $$('[data-cover]').forEach((b) => { b.onclick = () => { const [p] = photos.splice(Number(b.dataset.cover), 1); photos.unshift(p); drawPhotos(); }; });
  };
  drawPhotos();

  $('#files').onchange = async (e) => {
    const files = Array.from(e.target.files);
    const status = $('#upload-status');
    for (let i = 0; i < files.length; i++) {
      status.textContent = `Enviando foto ${i + 1} de ${files.length}…`;
      try {
        const data = await resizeImage(files[i]);
        const { url } = await api('/uploads', { method: 'POST', body: { data } });
        photos.push(url); drawPhotos();
      } catch (err) { toast(err.message, true); }
    }
    status.textContent = '';
    e.target.value = '';
  };
  $('#add-url').onclick = () => {
    const u = $('#photo-url').value.trim();
    if (!/^https?:\/\//.test(u)) return toast('Informe um link começando com http:// ou https://', true);
    photos.push(u); $('#photo-url').value = ''; drawPhotos();
  };

  let coords = l.lat != null ? { lat: l.lat, lng: l.lng } : null;
  const showCoords = () => { $('#coords').textContent = coords ? `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Nenhum ponto marcado.'; };
  showCoords();
  const map = makeMap($('#map'), coords ? [coords.lat, coords.lng] : [-15.8, -47.9], coords ? 13 : 4);
  if (map) {
    let marker = coords ? L.marker([coords.lat, coords.lng]).addTo(map) : null;
    map.on('click', (e) => {
      coords = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (marker) marker.setLatLng(e.latlng); else marker = L.marker(e.latlng).addTo(map);
      showCoords();
    });
  }

  $('#lf').onsubmit = (e) => {
    e.preventDefault();
    action(async () => {
      const f = new FormData(e.target);
      const body = {
        title: f.get('title'), description: f.get('description'), property_type: f.get('property_type'),
        city: f.get('city'), state: f.get('state'), country: f.get('country'), address: f.get('address'),
        lat: coords ? coords.lat : null, lng: coords ? coords.lng : null,
        price_per_night: f.get('price_per_night'), cleaning_fee: f.get('cleaning_fee') || 0,
        max_guests: f.get('max_guests'), bedrooms: f.get('bedrooms'), beds: f.get('beds'), bathrooms: f.get('bathrooms'),
        amenities: f.getAll('amenities'), photos, instant_book: f.get('instant_book') === 'on',
      };
      const res = editing ? await api('/listings/' + id, { method: 'PUT', body }) : await api('/listings', { method: 'POST', body });
      toast(editing ? 'Anúncio atualizado.' : 'Anúncio publicado! 🎉');
      go('/listing/' + res.id);
    })();
  };
}

/* ------------------------------------------------------------ perfis */
async function viewProfile(main) {
  const me = state.me;
  let avatarUrl = me.avatar;
  main.innerHTML = `
    <div class="auth card-box" style="max-width:560px">
      <h1>Seu perfil</h1>
      <form id="pf">
        <div class="row" style="gap:16px;margin-bottom:16px">
          <span id="av">${avatar(me.name, avatarUrl, 'xl')}</span>
          <div class="stack">
            <label class="btn sm" style="margin:0">Trocar foto<input type="file" id="av-file" accept="image/*" hidden></label>
            <button type="button" class="btn sm ghost" id="av-rm">Remover foto</button>
          </div>
        </div>
        <div class="field"><label>Nome<input name="name" required value="${esc(me.name)}"></label></div>
        <div class="field"><label>E-mail<input value="${esc(me.email)}" disabled></label></div>
        <div class="field"><label>Sobre você<textarea name="bio" maxlength="1000" placeholder="Conte um pouco sobre você para anfitriões e hóspedes.">${esc(me.bio)}</textarea></label></div>
        <div class="row"><button class="btn primary">Salvar</button><a class="btn ghost" href="#/user/${me.id}">Ver perfil público</a></div>
      </form>
    </div>`;
  const redraw = () => { $('#av').innerHTML = avatar(me.name, avatarUrl, 'xl'); };
  $('#av-file').onchange = action(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const data = await resizeImage(file, 400);
    avatarUrl = (await api('/uploads', { method: 'POST', body: { data } })).url;
    redraw();
  });
  $('#av-rm').onclick = () => { avatarUrl = null; redraw(); };
  $('#pf').onsubmit = (e) => {
    e.preventDefault();
    action(async () => {
      const f = new FormData(e.target);
      state.me = (await api('/me', { method: 'PUT', body: { name: f.get('name'), bio: f.get('bio'), avatar: avatarUrl } })).user;
      renderNav(); toast('Perfil atualizado.');
    })();
  };
}

async function viewUser(main, [id]) {
  const { user, listings } = await api('/users/' + id);
  main.innerHTML = `
    <div class="host-row" style="margin-bottom:12px">${avatar(user.name, user.avatar, 'xl')}
      <div><h1 style="margin:0">${esc(user.name)}</h1><div class="muted">No Estadia desde ${new Date(user.created_at.replace(' ', 'T')).getFullYear()}</div></div>
    </div>
    ${user.bio ? `<p style="max-width:680px">${esc(user.bio)}</p>` : ''}
    <hr>
    <h2>Anúncios de ${esc(user.name.split(' ')[0])}</h2>
    ${listings.length ? `<div class="grid">${listings.map((l) => listingCard(l)).join('')}</div>` : '<p class="muted">Nenhum anúncio ativo.</p>'}`;
}

/* ------------------------------------------------------------ administração */
async function viewAdmin(main, _m, params) {
  if (!state.me.is_admin) throw new Error('Acesso restrito ao administrador.');
  const { stats: s, bookings, listings, users } = await api('/admin/overview');
  const tab = params.get('tab') || 'bookings';
  const filter = params.get('status') || 'all';
  const t = todayISO();
  const FILTERS = [
    ['all', 'Todas', () => true],
    ['pending', 'Pendentes', (b) => b.status === 'pending'],
    ['upcoming', 'Confirmadas (futuras)', (b) => b.status === 'confirmed' && b.check_out > t],
    ['done', 'Concluídas', (b) => b.status === 'confirmed' && b.check_out <= t],
    ['cancelled', 'Canceladas/recusadas', (b) => b.status === 'cancelled' || b.status === 'declined'],
  ];
  const [, , fn] = FILTERS.find((f) => f[0] === filter) || FILTERS[0];
  const shown = bookings.filter(fn);
  const shownTotal = shown.reduce((sum, b) => sum + b.total_price, 0);
  const roleOf = (u) => (u.is_admin ? '<span class="badge done">Admin</span> ' : '') + (u.listing_count ? '<span class="badge confirmed">Anfitrião</span> ' : '') + (u.trip_count || !u.listing_count ? '<span class="badge">Hóspede</span>' : '');

  let body = '';
  if (tab === 'bookings') {
    body = `
      <div class="chips">${FILTERS.map(([k, label, f]) => `<button class="chip ${k === filter ? 'on' : ''}" data-status="${k}">${label} (${bookings.filter(f).length})</button>`).join('')}</div>
      <p class="small muted">${plural(shown.length, 'reserva', 'reservas')} · valor total ${money2(shownTotal)}</p>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Nº</th><th>Anúncio</th><th>Anfitrião</th><th>Hóspede</th><th>Período</th><th class="num">Diária</th><th class="num">Limpeza</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
        <tbody>${shown.map((b) => `
          <tr>
            <td>${b.id}</td>
            <td><a href="#/listing/${b.listing_id}">${esc(b.listing_title)}</a><div class="small muted">${esc(b.listing_city)}</div></td>
            <td>${esc(b.host_name)}</td>
            <td>${esc(b.guest_name)}<div class="small muted">${plural(b.guests, 'hóspede', 'hóspedes')}</div></td>
            <td class="nowrap">${fmtShort(b.check_in)} – ${fmtShort(b.check_out)}<div class="small muted">${plural(b.nights, 'noite', 'noites')}</div></td>
            <td class="num">${money2(b.price_per_night)}</td>
            <td class="num">${money2(b.cleaning_fee)}</td>
            <td class="num"><strong>${money2(b.total_price)}</strong></td>
            <td>${statusBadge(b)}</td>
            <td class="nowrap">
              <a class="btn sm" href="#/booking/${b.id}">Ver${b.message_count ? ` 💬${b.message_count}` : ''}</a>
              ${b.can_confirm ? `<button class="btn sm primary" data-act="confirm" data-id="${b.id}">Confirmar</button><button class="btn sm" data-act="decline" data-id="${b.id}">Recusar</button>` : ''}
            </td>
          </tr>`).join('') || '<tr><td colspan="10" class="muted" style="text-align:center;padding:30px">Nenhuma reserva nesse filtro.</td></tr>'}
        </tbody>
      </table></div>`;
  }
  if (tab === 'listings') {
    body = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Anúncio</th><th>Anfitrião</th><th class="num">Diária</th><th class="num">Reservas</th><th class="num">Noites vendidas</th><th class="num">Faturamento confirmado</th><th>Nota</th><th>Status</th></tr></thead>
        <tbody>${listings.map((l) => `
          <tr>
            <td><div class="row"><img src="${esc(l.photo || '')}" alt="" class="thumb"><div><a href="#/listing/${l.id}">${esc(l.title)}</a><div class="small muted">${esc(l.property_type)} · ${esc(l.city)}${l.state ? ', ' + esc(l.state) : ''}</div></div></div></td>
            <td>${esc(l.host_name)}</td>
            <td class="num">${money2(l.price_per_night)}</td>
            <td class="num">${l.booking_count}${l.pending_count ? ` <span class="badge pending">${l.pending_count} pend.</span>` : ''}</td>
            <td class="num">${l.nights}</td>
            <td class="num"><strong>${money2(l.revenue)}</strong></td>
            <td class="nowrap">${stars(l.rating, l.review_count)}</td>
            <td>${l.active ? '<span class="badge confirmed">Ativo</span>' : '<span class="badge declined">Pausado</span>'}${l.instant_book ? ' <span class="badge">⚡</span>' : ''}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }
  if (tab === 'users') {
    body = `
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Usuário</th><th>Login</th><th>E-mail</th><th>Perfil</th><th class="num">Anúncios</th><th class="num">Reservas feitas</th><th class="num">Gasto como hóspede</th><th class="num">Recebido como anfitrião</th></tr></thead>
        <tbody>${users.map((u) => `
          <tr>
            <td><div class="row">${avatar(u.name, u.avatar)}<a href="#/user/${u.id}">${esc(u.name)}</a></div></td>
            <td>${esc(u.username || '—')}</td>
            <td>${esc(u.email)}</td>
            <td class="nowrap">${roleOf(u)}</td>
            <td class="num">${u.listing_count}</td>
            <td class="num">${u.trip_count}</td>
            <td class="num">${money2(u.spent)}</td>
            <td class="num"><strong>${money2(u.earned)}</strong></td>
          </tr>`).join('')}
        </tbody>
      </table></div>`;
  }

  main.innerHTML = `
    <div class="row between wrap"><h1>🛡️ Administração</h1><span class="small muted">Visão geral de toda a plataforma</span></div>
    <div class="stats" style="margin-top:16px">
      <div class="stat"><div class="small muted">Reservas pendentes</div><div class="n">${s.pending}</div><div class="small muted">${money(s.pending_value)} aguardando</div></div>
      <div class="stat"><div class="small muted">Confirmadas a realizar</div><div class="n">${s.upcoming}</div><div class="small muted">${money(s.upcoming_value)}</div></div>
      <div class="stat"><div class="small muted">Estadias concluídas</div><div class="n">${s.completed}</div><div class="small muted">${money(s.completed_value)}</div></div>
      <div class="stat"><div class="small muted">Volume total confirmado</div><div class="n">${money(s.upcoming_value + s.completed_value)}</div><div class="small muted">${plural(s.nights, 'noite', 'noites')}</div></div>
      <div class="stat"><div class="small muted">Usuários</div><div class="n">${s.users}</div><div class="small muted">${plural(s.hosts, 'anfitrião', 'anfitriões')}</div></div>
      <div class="stat"><div class="small muted">Anúncios</div><div class="n">${s.listings}</div><div class="small muted">${s.active_listings} ativos</div></div>
      <div class="stat"><div class="small muted">Total de reservas</div><div class="n">${s.bookings}</div><div class="small muted">${s.cancelled} canceladas/recusadas</div></div>
      <div class="stat"><div class="small muted">Pagamentos</div><div class="n" style="font-size:18px;padding-top:6px">Em breve</div><div class="small muted">valores apenas simulados</div></div>
    </div>
    <div class="tabs">
      ${[['bookings', `Reservas (${bookings.length})`], ['listings', `Anúncios (${listings.length})`], ['users', `Usuários (${users.length})`]].map(([k, label]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${label}</button>`).join('')}
    </div>
    ${body}`;

  $$('[data-tab]').forEach((b) => { b.onclick = () => go('/admin?tab=' + b.dataset.tab); });
  $$('[data-status]').forEach((b) => { b.onclick = () => go('/admin?tab=bookings&status=' + b.dataset.status); });
  $$('[data-act]').forEach((btn) => {
    btn.onclick = action(async () => {
      const verb = btn.dataset.act === 'confirm' ? 'Confirmar' : 'Recusar';
      if (!confirm(`${verb} a reserva nº ${btn.dataset.id}?`)) return;
      await api(`/bookings/${btn.dataset.id}/${btn.dataset.act}`, { method: 'POST' });
      toast(btn.dataset.act === 'confirm' ? 'Reserva confirmada.' : 'Solicitação recusada.');
      router();
    });
  });
}

/* ------------------------------------------------------------ roteador */
const routes = [
  [/^\/$/, viewHome],
  [/^\/listing\/(\d+)$/, viewListing],
  [/^\/user\/([\w-]+)$/, viewUser],
  [/^\/login$/, viewLogin],
  [/^\/signup$/, viewSignup],
  [/^\/trips$/, viewTrips, true],
  [/^\/favorites$/, viewFavorites, true],
  [/^\/inbox$/, viewInbox, true],
  [/^\/booking\/(\d+)$/, viewBooking, true],
  [/^\/host$/, viewHost, true],
  [/^\/host\/new$/, viewListingForm, true],
  [/^\/host\/edit\/(\d+)$/, viewListingForm, true],
  [/^\/profile$/, viewProfile, true],
  [/^\/admin$/, viewAdmin, true],
];

async function router() {
  cleanup.forEach((fn) => { try { fn(); } catch (_) { /* ignora */ } });
  cleanup = [];
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const params = new URLSearchParams(qs || '');
  const main = $('#app');
  const changed = path !== lastPath;
  if (changed) window.scrollTo(0, 0);
  lastPath = path;
  for (const [re, view, auth] of routes) {
    const m = path.match(re);
    if (!m) continue;
    if (auth && !state.me) return requireLogin();
    if (changed || main.children.length === 0) main.innerHTML = '<div class="loading">Carregando…</div>';
    try {
      await view(main, m.slice(1), params);
    } catch (e) {
      if (e.status === 401) { state.me = null; renderNav(); return requireLogin(); }
      main.innerHTML = `<div class="empty"><div class="big">😕</div><h3>${esc(e.message)}</h3><a class="btn" href="#/">Voltar ao início</a></div>`;
    }
    return;
  }
  main.innerHTML = '<div class="empty"><div class="big">🧭</div><h3>Página não encontrada</h3><a class="btn" href="#/">Voltar ao início</a></div>';
}

(async function boot() {
  if (!Backend.configured) {
    $('#app').innerHTML = `<div class="auth card-box"><h1>Quase lá!</h1>
      <p>O Estadia precisa ser conectado ao banco de dados (Supabase).</p>
      <p class="muted small">Preencha <code>docs/config.js</code> com a Project URL e a chave anon do seu projeto
      Supabase. Veja o passo a passo no README do repositório.</p></div>`;
    return;
  }
  try {
    const [meRes, meta] = await Promise.all([api('/auth/me'), api('/meta')]);
    state.me = meRes.user; state.meta = meta;
  } catch (e) { toast('Não foi possível conectar ao servidor.', true); }
  renderNav();
  window.addEventListener('hashchange', router);
  router();
})();
