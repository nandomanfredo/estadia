/*
 * Estadia — "backend" no navegador, sobre o Supabase.
 * Implementa as mesmas rotas que o servidor Python tinha (GET /listings, POST /bookings, ...),
 * para o restante do app (app.js) continuar igual. As regras de segurança ficam no banco
 * (RLS + funções em supabase/schema.sql); aqui só montamos as consultas e os formatos.
 */
'use strict';

const Backend = (() => {
  const cfg = window.ESTADIA_CONFIG || {};
  const configured = /^https:\/\/.+\.supabase\.co\/?$/.test(cfg.supabaseUrl || '') && cfg.supabaseAnonKey && !/COLE-AQUI/.test(cfg.supabaseAnonKey);
  const sb = configured && window.supabase ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

  const PROPERTY_TYPES = ['Casa', 'Apartamento', 'Chalé', 'Pousada', 'Quarto', 'Cabana', 'Sítio', 'Loft'];
  const AMENITIES = ['Wi-Fi', 'Cozinha', 'Ar-condicionado', 'Estacionamento gratuito', 'Piscina', 'TV',
    'Máquina de lavar', 'Espaço de trabalho', 'Aceita animais', 'Café da manhã', 'Churrasqueira',
    'Vista para o mar', 'Academia', 'Hidromassagem', 'Lareira'];
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  /* ---------------------------------------------------------- erros */
  class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  const fail = (status, msg) => { throw new HttpError(status, msg); };

  const FRIENDLY = [
    [/Invalid login credentials/i, 'Usuário ou senha incorretos.'],
    [/User already registered/i, 'Já existe uma conta com esse e-mail.'],
    [/Email not confirmed/i, 'Confirme seu e-mail antes de entrar (veja sua caixa de entrada).'],
    [/Password should be at least/i, 'A senha deve ter pelo menos 6 caracteres.'],
    [/rate limit/i, 'Muitas tentativas. Aguarde um pouco e tente de novo.'],
    [/JWT expired/i, 'Sua sessão expirou. Entre novamente.'],
    [/Failed to fetch|NetworkError/i, 'Sem conexão com o servidor. Verifique sua internet.'],
  ];
  function check({ data, error }) {
    if (!error) return data;
    const raw = error.message || String(error);
    // Exceções das funções do banco (raise exception) já vêm em português.
    if (error.code === 'P0001') fail(400, raw);
    if (error.code === '23514' || error.code === '22P02' || error.code === '23502') fail(400, 'Verifique os campos do formulário.');
    if (error.code === '42501') fail(403, 'Você não tem permissão para isso.');
    for (const [re, msg] of FRIENDLY) if (re.test(raw)) fail(error.status || 400, msg);
    console.error('[Supabase]', error);
    fail(error.status || 500, 'Algo deu errado. Tente novamente.');
  }

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const num = (v) => (v == null ? v : Number(v));

  /* ---------------------------------------------------------- sessão */
  let meCache;      // undefined = ainda não carregado
  async function me() {
    if (meCache !== undefined) return meCache;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return (meCache = null);
    const p = check(await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle());
    meCache = p ? { ...p, email: session.user.email } : null;
    return meCache;
  }
  async function requireMe() {
    const u = await me();
    if (!u) fail(401, 'Faça login para continuar.');
    return u;
  }

  /* ---------------------------------------------------------- formatos (iguais aos do servidor antigo) */
  function listingOut(l, favs) {
    return {
      ...l,
      price_per_night: num(l.price_per_night), cleaning_fee: num(l.cleaning_fee), bathrooms: num(l.bathrooms),
      rating: l.rating == null ? null : Number(l.rating),
      amenities: l.amenities || [], photos: l.photos || [],
      is_favorite: favs ? favs.has(l.id) : false,
    };
  }

  function bookingOut(b, user) {
    const t = today();
    const role = user.id === b.host_id ? 'host' : user.id === b.guest_id ? 'guest' : 'admin';
    const out = {
      ...b,
      price_per_night: num(b.price_per_night), cleaning_fee: num(b.cleaning_fee), total_price: num(b.total_price),
      listing_photo: (b.listing_photos || [])[0] || null,
      role,
      is_past: b.check_out <= t,
    };
    delete out.listing_photos;
    out.can_confirm = (role === 'host' || role === 'admin') && b.status === 'pending' && b.check_in >= t;
    out.can_decline = out.can_confirm;
    out.can_cancel = (b.status === 'pending' || b.status === 'confirmed') && b.check_in > t;
    out.can_review = role === 'guest' && b.status === 'confirmed' && out.is_past && !b.has_review;
    return out;
  }

  async function favoriteIds(user) {
    if (!user) return new Set();
    const rows = check(await sb.from('favorites').select('listing_id').eq('user_id', user.id));
    return new Set(rows.map((r) => r.listing_id));
  }

  /* ---------------------------------------------------------- auth */
  async function login({ login: ident, email, password }) {
    ident = String(ident || email || '').trim();
    if (!ident || !password) fail(400, 'Preencha usuário e senha.');
    let mail = ident;
    if (!ident.includes('@')) {
      mail = check(await sb.rpc('login_email', { p_login: ident }));
      if (!mail) fail(401, 'Usuário ou senha incorretos.');
    }
    check(await sb.auth.signInWithPassword({ email: mail.toLowerCase(), password }));
    meCache = undefined;
    return { user: await me() };
  }

  async function register({ name, email, password }) {
    name = String(name || '').trim(); email = String(email || '').trim().toLowerCase();
    if (name.length < 2) fail(400, 'Preencha o campo nome.');
    if (!EMAIL_RE.test(email)) fail(400, 'E-mail inválido.');
    if (String(password || '').length < 6) fail(400, 'A senha deve ter pelo menos 6 caracteres.');
    const data = check(await sb.auth.signUp({ email, password, options: { data: { name } } }));
    if (!data.session) fail(400, 'Conta criada! Confirme seu e-mail pelo link que enviamos e depois entre.');
    meCache = undefined;
    return { user: await me() };
  }

  async function logout() {
    await sb.auth.signOut();
    meCache = null;
    return { ok: true };
  }

  async function updateMe({ name, bio, avatar }) {
    const u = await requireMe();
    name = String(name || '').trim();
    if (!name) fail(400, 'Preencha o campo nome.');
    check(await sb.from('profiles').update({ name, bio: String(bio || ''), avatar: avatar || null }).eq('id', u.id));
    meCache = undefined;
    return { user: await me() };
  }

  /* ---------------------------------------------------------- uploads */
  async function upload({ data }) {
    const u = await requireMe();
    const m = /^data:(image\/(png|jpeg|webp|gif));base64,(.+)$/.exec(String(data || ''));
    if (!m) fail(400, 'Envie uma imagem PNG, JPEG, WEBP ou GIF.');
    const bytes = Uint8Array.from(atob(m[3]), (c) => c.charCodeAt(0));
    if (bytes.length > 5 * 1024 * 1024) fail(413, 'A imagem deve ter no máximo 5 MB.');
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
    const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
    check(await sb.storage.from('uploads').upload(path, new Blob([bytes], { type: m[1] }), { contentType: m[1] }));
    return { url: sb.storage.from('uploads').getPublicUrl(path).data.publicUrl };
  }

  /* ---------------------------------------------------------- anúncios */
  async function searchListings(q) {
    const user = await me();
    let query = sb.from('listing_cards').select('*').eq('active', true);
    const term = (q.q || '').replace(/[,()*%\\]/g, ' ').trim();
    if (term) query = query.or(['city', 'state', 'title', 'country'].map((c) => `${c}.ilike.*${term}*`).join(','));
    if (q.guests) query = query.gte('max_guests', Number(q.guests));
    if (q.type) query = query.eq('property_type', q.type);
    if (q.min_price) query = query.gte('price_per_night', Number(q.min_price));
    if (q.max_price) query = query.lte('price_per_night', Number(q.max_price));
    const wanted = (q.amenities || '').split(',').filter(Boolean);
    if (wanted.length) query = query.contains('amenities', wanted);
    if (q.sort === 'price_asc') query = query.order('price_per_night', { ascending: true });
    else if (q.sort === 'price_desc') query = query.order('price_per_night', { ascending: false });
    else query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
    let rows = check(await query);
    if (q.check_in && q.check_out) {
      if (q.check_out <= q.check_in) fail(400, 'O check-out deve ser depois do check-in.');
      const busy = new Set(check(await sb.rpc('booked_listing_ids', { p_check_in: q.check_in, p_check_out: q.check_out })));
      rows = rows.filter((l) => !busy.has(l.id));
    }
    if (q.sort === 'rating') rows.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
    const favs = await favoriteIds(user);
    return { listings: rows.map((l) => listingOut(l, favs)) };
  }

  async function getListing(id) {
    const user = await me();
    const row = check(await sb.from('listing_cards').select('*').eq('id', id).maybeSingle());
    if (!row) fail(404, 'Anúncio não encontrado.');
    const l = listingOut(row, await favoriteIds(user));
    l.is_owner = !!user && user.id === row.host_id;
    const [host, count, reviews, unavailable, priv] = await Promise.all([
      sb.from('profiles').select('id, name, avatar, bio, created_at').eq('id', row.host_id).single(),
      sb.from('listings').select('id', { count: 'exact', head: true }).eq('host_id', row.host_id).eq('active', true),
      sb.from('reviews').select('id, rating, comment, created_at, author_id, author:profiles!reviews_author_id_fkey(name, avatar)')
        .eq('listing_id', id).order('created_at', { ascending: false }),
      sb.rpc('listing_unavailable', { p_listing_id: id }),
      l.is_owner ? sb.from('listing_private').select('address').eq('listing_id', id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    l.host = { ...check(host), listing_count: count.count || 0 };
    l.reviews = check(reviews).map((r) => ({ ...r, author_name: r.author && r.author.name, author_avatar: r.author && r.author.avatar }));
    l.unavailable = check(unavailable);
    l.address = (check(priv) || {}).address || '';
    return { listing: l };
  }

  function cleanListing(b) {
    const n = (v, d) => (v === '' || v == null ? d : Number(v));
    const photos = Array.isArray(b.photos) ? b.photos.filter((p) => /^https?:\/\//.test(p)) : [];
    if (!String(b.title || '').trim()) fail(400, 'Preencha o campo título.');
    if (!String(b.city || '').trim()) fail(400, 'Preencha o campo cidade.');
    if (!photos.length) fail(400, 'Adicione pelo menos uma foto.');
    if (!(n(b.price_per_night) >= 1)) fail(400, 'Informe o preço por noite.');
    const hasPos = b.lat != null && b.lat !== '' && b.lng != null && b.lng !== '';
    return {
      title: String(b.title).trim(), description: String(b.description || ''),
      property_type: PROPERTY_TYPES.includes(b.property_type) ? b.property_type : 'Apartamento',
      city: String(b.city).trim(), state: String(b.state || '').trim(), country: String(b.country || 'Brasil').trim() || 'Brasil',
      lat: hasPos ? Number(b.lat) : null, lng: hasPos ? Number(b.lng) : null,
      price_per_night: n(b.price_per_night), cleaning_fee: n(b.cleaning_fee, 0),
      max_guests: n(b.max_guests, 1), bedrooms: n(b.bedrooms, 1), beds: n(b.beds, 1), bathrooms: n(b.bathrooms, 1),
      amenities: (b.amenities || []).filter((a) => AMENITIES.includes(a)),
      photos: photos.slice(0, 20), instant_book: !!b.instant_book,
    };
  }

  async function createListing(body) {
    const u = await requireMe();
    const row = check(await sb.from('listings').insert({ ...cleanListing(body), host_id: u.id }).select('id').single());
    check(await sb.from('listing_private').insert({ listing_id: row.id, address: String(body.address || '').slice(0, 200) }));
    return { id: row.id };
  }

  async function updateListing(id, body) {
    await requireMe();
    const rows = check(await sb.from('listings').update(cleanListing(body)).eq('id', id).select('id'));
    if (!rows.length) fail(403, 'Você não é o anfitrião deste anúncio.');
    check(await sb.from('listing_private').upsert({ listing_id: id, address: String(body.address || '').slice(0, 200) }));
    return { id };
  }

  async function toggleListing(id) {
    await requireMe();
    const row = check(await sb.from('listings').select('active').eq('id', id).maybeSingle());
    if (!row) fail(404, 'Anúncio não encontrado.');
    const rows = check(await sb.from('listings').update({ active: !row.active }).eq('id', id).select('active'));
    if (!rows.length) fail(403, 'Você não é o anfitrião deste anúncio.');
    return { active: rows[0].active };
  }

  async function deleteListing(id) {
    await requireMe();
    const { count } = await sb.from('bookings').select('id', { count: 'exact', head: true }).eq('listing_id', id);
    if (count) fail(409, 'Este anúncio já tem reservas. Pause-o em vez de excluir.');
    const rows = check(await sb.from('listings').delete().eq('id', id).select('id'));
    if (!rows.length) fail(403, 'Não foi possível excluir este anúncio.');
    return { ok: true };
  }

  async function getUser(id) {
    const user = await me();
    const profile = check(await sb.from('profiles').select('id, name, avatar, bio, created_at').eq('id', id).maybeSingle());
    if (!profile) fail(404, 'Usuário não encontrado.');
    const rows = check(await sb.from('listing_cards').select('*').eq('host_id', id).eq('active', true).order('created_at', { ascending: false }));
    const favs = await favoriteIds(user);
    return { user: profile, listings: rows.map((l) => listingOut(l, favs)) };
  }

  async function hostListings() {
    const u = await requireMe();
    const rows = check(await sb.from('listing_cards').select('*').eq('host_id', u.id).order('created_at', { ascending: false }));
    return { listings: rows.map((l) => listingOut(l)) };
  }

  /* ---------------------------------------------------------- favoritos */
  async function listFavorites() {
    const u = await requireMe();
    const favs = check(await sb.from('favorites').select('listing_id').eq('user_id', u.id).order('created_at', { ascending: false }));
    if (!favs.length) return { listings: [] };
    const rows = check(await sb.from('listing_cards').select('*').in('id', favs.map((f) => f.listing_id)));
    const order = favs.map((f) => f.listing_id);
    rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    return { listings: rows.map((l) => ({ ...listingOut(l), is_favorite: true })) };
  }
  async function addFavorite(id) {
    const u = await requireMe();
    check(await sb.from('favorites').upsert({ user_id: u.id, listing_id: id }, { ignoreDuplicates: true }));
    return { is_favorite: true };
  }
  async function removeFavorite(id) {
    const u = await requireMe();
    check(await sb.from('favorites').delete().eq('user_id', u.id).eq('listing_id', id));
    return { is_favorite: false };
  }

  /* ---------------------------------------------------------- reservas */
  async function myBookings() {
    const u = await requireMe();
    const rows = check(await sb.from('booking_details').select('*').eq('guest_id', u.id).order('check_in', { ascending: false }));
    return { bookings: rows.map((b) => bookingOut(b, u)) };
  }
  async function hostBookings() {
    const u = await requireMe();
    const rows = check(await sb.from('booking_details').select('*').eq('host_id', u.id).order('check_in', { ascending: false }));
    return { bookings: rows.map((b) => bookingOut(b, u)) };
  }

  async function createBooking(b) {
    await requireMe();
    const res = check(await sb.rpc('create_booking', {
      p_listing_id: Number(b.listing_id), p_check_in: b.check_in || null, p_check_out: b.check_out || null,
      p_guests: Number(b.guests) || 1, p_message: String(b.message || ''),
    }));
    return res;
  }

  async function getBooking(id) {
    const u = await requireMe();
    const row = check(await sb.from('booking_details').select('*').eq('id', id).maybeSingle());
    if (!row) fail(404, 'Reserva não encontrada.');
    const b = bookingOut(row, u);
    const [msgs, review, priv] = await Promise.all([
      sb.from('messages').select('id, body, created_at, sender_id, sender:profiles!messages_sender_id_fkey(name, avatar)')
        .eq('booking_id', id).order('id'),
      sb.from('reviews').select('rating, comment, created_at').eq('booking_id', id).maybeSingle(),
      sb.from('listing_private').select('address').eq('listing_id', row.listing_id).maybeSingle(),
    ]);
    b.messages = check(msgs).map((m) => ({ ...m, sender_name: m.sender && m.sender.name, sender_avatar: m.sender && m.sender.avatar }));
    b.review = check(review);
    const address = (check(priv) || {}).address;
    // O hóspede só vê o endereço depois da confirmação (o banco também garante isso).
    b.listing_address = b.role === 'guest' && b.status !== 'confirmed' ? null : address || null;
    return { booking: b };
  }

  async function bookingAction(id, act) {
    await requireMe();
    check(await sb.rpc('booking_action', { p_booking_id: id, p_action: act }));
    return getBooking(id);
  }

  async function postMessage(id, { body }) {
    const u = await requireMe();
    body = String(body || '').trim();
    if (!body) fail(400, 'Escreva uma mensagem.');
    check(await sb.from('messages').insert({ booking_id: id, sender_id: u.id, body: body.slice(0, 2000) }));
    return getBooking(id);
  }

  async function postReview(id, { rating, comment }) {
    await requireMe();
    check(await sb.rpc('create_review', { p_booking_id: id, p_rating: Number(rating), p_comment: String(comment || '') }));
    return getBooking(id);
  }

  async function inbox() {
    const u = await requireMe();
    const rows = check(await sb.from('booking_details').select('*')
      .or(`guest_id.eq.${u.id},host_id.eq.${u.id}`).gt('message_count', 0));
    if (!rows.length) return { conversations: [] };
    const msgs = check(await sb.from('messages').select('booking_id, body, created_at, sender_id')
      .in('booking_id', rows.map((r) => r.id)).order('id', { ascending: false }));
    const last = {};
    msgs.forEach((m) => { if (!last[m.booking_id]) last[m.booking_id] = m; });
    const out = rows.filter((r) => last[r.id]).map((r) => ({ ...bookingOut(r, u), last_message: last[r.id] }));
    out.sort((a, b) => (a.last_message.created_at < b.last_message.created_at ? 1 : -1));
    return { conversations: out };
  }

  /* ---------------------------------------------------------- administração */
  async function adminOverview() {
    const u = await requireMe();
    if (!u.is_admin) fail(403, 'Acesso restrito ao administrador.');
    const [bRes, lRes, pRes, eRes] = await Promise.all([
      sb.from('booking_details').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }),
      sb.from('listing_cards').select('*'),
      sb.from('profiles').select('id, name, username, is_admin, avatar, created_at'),
      sb.rpc('admin_users'),
    ]);
    const bookings = check(bRes).map((b) => bookingOut(b, u));
    const listingRows = check(lRes);
    const profiles = check(pRes);
    const emails = Object.fromEntries(check(eRes).map((r) => [r.id, r.email]));
    const t = today();
    const sum = (arr) => arr.reduce((s, b) => s + b.total_price, 0);
    const confirmed = bookings.filter((b) => b.status === 'confirmed');
    const upcoming = confirmed.filter((b) => b.check_out > t);
    const completed = confirmed.filter((b) => b.check_out <= t);
    const pending = bookings.filter((b) => b.status === 'pending');
    const stats = {
      users: profiles.length,
      hosts: new Set(listingRows.map((l) => l.host_id)).size,
      listings: listingRows.length,
      active_listings: listingRows.filter((l) => l.active).length,
      bookings: bookings.length,
      pending: pending.length, pending_value: sum(pending),
      upcoming: upcoming.length, upcoming_value: sum(upcoming),
      completed: completed.length, completed_value: sum(completed),
      cancelled: bookings.filter((b) => b.status === 'cancelled' || b.status === 'declined').length,
      nights: confirmed.reduce((s, b) => s + b.nights, 0),
    };
    const listings = listingRows.map((l) => {
      const mine = bookings.filter((b) => b.listing_id === l.id);
      const conf = mine.filter((b) => b.status === 'confirmed');
      return {
        id: l.id, title: l.title, city: l.city, state: l.state, property_type: l.property_type,
        price_per_night: num(l.price_per_night), cleaning_fee: num(l.cleaning_fee),
        active: l.active, instant_book: l.instant_book, photo: (l.photos || [])[0] || null,
        host_id: l.host_id, host_name: l.host_name,
        booking_count: mine.length, pending_count: mine.filter((b) => b.status === 'pending').length,
        revenue: sum(conf), nights: conf.reduce((s, b) => s + b.nights, 0),
        rating: l.rating == null ? null : Number(l.rating), review_count: l.review_count,
      };
    }).sort((a, b) => b.revenue - a.revenue);
    const users = profiles.map((p) => {
      const trips = bookings.filter((b) => b.guest_id === p.id);
      const hosted = bookings.filter((b) => b.host_id === p.id && b.status === 'confirmed');
      return {
        ...p, email: emails[p.id] || '',
        listing_count: listingRows.filter((l) => l.host_id === p.id).length,
        trip_count: trips.length,
        spent: sum(trips.filter((b) => b.status === 'confirmed')),
        earned: sum(hosted),
      };
    }).sort((a, b) => (b.is_admin - a.is_admin) || a.name.localeCompare(b.name));
    return { stats, bookings, listings, users };
  }

  /* ---------------------------------------------------------- roteador */
  const ROUTES = [
    ['GET', /^\/meta$/, () => ({ property_types: PROPERTY_TYPES, amenities: AMENITIES })],
    ['GET', /^\/auth\/me$/, async () => ({ user: await me() })],
    ['POST', /^\/auth\/login$/, (_, b) => login(b)],
    ['POST', /^\/auth\/register$/, (_, b) => register(b)],
    ['POST', /^\/auth\/logout$/, () => logout()],
    ['PUT', /^\/me$/, (_, b) => updateMe(b)],
    ['GET', /^\/users\/([\w-]+)$/, (m) => getUser(m[1])],
    ['POST', /^\/uploads$/, (_, b) => upload(b)],
    ['GET', /^\/listings$/, (_, __, q) => searchListings(q)],
    ['POST', /^\/listings$/, (_, b) => createListing(b)],
    ['GET', /^\/listings\/(\d+)$/, (m) => getListing(Number(m[1]))],
    ['PUT', /^\/listings\/(\d+)$/, (m, b) => updateListing(Number(m[1]), b)],
    ['DELETE', /^\/listings\/(\d+)$/, (m) => deleteListing(Number(m[1]))],
    ['POST', /^\/listings\/(\d+)\/toggle$/, (m) => toggleListing(Number(m[1]))],
    ['GET', /^\/host\/listings$/, () => hostListings()],
    ['GET', /^\/host\/bookings$/, () => hostBookings()],
    ['GET', /^\/favorites$/, () => listFavorites()],
    ['POST', /^\/favorites\/(\d+)$/, (m) => addFavorite(Number(m[1]))],
    ['DELETE', /^\/favorites\/(\d+)$/, (m) => removeFavorite(Number(m[1]))],
    ['GET', /^\/bookings$/, () => myBookings()],
    ['POST', /^\/bookings$/, (_, b) => createBooking(b)],
    ['GET', /^\/bookings\/(\d+)$/, (m) => getBooking(Number(m[1]))],
    ['POST', /^\/bookings\/(\d+)\/(confirm|decline|cancel)$/, (m) => bookingAction(Number(m[1]), m[2])],
    ['POST', /^\/bookings\/(\d+)\/messages$/, (m, b) => postMessage(Number(m[1]), b)],
    ['POST', /^\/bookings\/(\d+)\/review$/, (m, b) => postReview(Number(m[1]), b)],
    ['GET', /^\/inbox$/, () => inbox()],
    ['GET', /^\/admin\/overview$/, () => adminOverview()],
  ];

  async function request(method, fullPath, body) {
    if (!sb) fail(503, 'O Supabase ainda não foi configurado (veja docs/config.js).');
    const [path, qs] = fullPath.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    for (const [m, re, fn] of ROUTES) {
      const match = m === method && path.match(re);
      if (match) return fn(match, body || {}, query);
    }
    fail(404, 'Rota não encontrada.');
  }

  // Outra aba entrou/saiu: recarrega o usuário atual.
  if (sb) sb.auth.onAuthStateChange((evt) => { if (evt !== 'INITIAL_SESSION') meCache = undefined; });

  return { request, configured: !!sb };
})();
