#!/usr/bin/env python3
"""Estadia — plataforma de aluguel de temporada (sem pagamentos).

Servidor HTTP com API JSON + arquivos estáticos, usando apenas a biblioteca padrão.
Execute:  python3 server.py   e abra http://localhost:8000
"""
import base64
import datetime
import json
import mimetypes
import os
import re
import secrets
import sys
import traceback
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

import db

PUBLIC_DIR = os.path.join(db.BASE_DIR, "public")
UPLOAD_DIR = os.path.join(db.BASE_DIR, "uploads")
PORT = int(os.environ.get("PORT", "8000"))
# Endereço de escuta: 127.0.0.1 (só este computador) ou 0.0.0.0 (servidor/contêiner).
HOST = os.environ.get("HOST", "127.0.0.1")
# Prefixo quando o site roda num subcaminho, ex.: BASE_PATH=/estadia  ->  dominio.com/estadia/
BASE_PATH = "/" + os.environ.get("BASE_PATH", "").strip("/") if os.environ.get("BASE_PATH", "").strip("/") else ""
# Defina COOKIE_SECURE=1 quando o site estiver em HTTPS.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE") == "1"
MAX_BODY = 8 * 1024 * 1024
MAX_UPLOAD = 5 * 1024 * 1024
SESSION_DAYS = 30
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
ACTIVE_STATUSES = ("pending", "confirmed")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


# ---------------------------------------------------------------- helpers

def today():
    return datetime.date.today()


def parse_date(value, label):
    try:
        return datetime.date.fromisoformat(str(value))
    except (TypeError, ValueError):
        raise ApiError(400, "Data inválida: %s." % label)


def text(body, key, label, required=False, max_len=200, default=""):
    value = body.get(key, default)
    value = "" if value is None else str(value).strip()
    if required and not value:
        raise ApiError(400, "Preencha o campo %s." % label)
    if len(value) > max_len:
        raise ApiError(400, "%s pode ter no máximo %d caracteres." % (label, max_len))
    return value


def number(body, key, label, lo, hi, cast=float, default=None):
    value = body.get(key, default)
    try:
        value = cast(value)
    except (TypeError, ValueError):
        raise ApiError(400, "Valor inválido para %s." % label)
    if value < lo or value > hi:
        raise ApiError(400, "%s deve estar entre %s e %s." % (label, lo, hi))
    return value


def valid_url(u):
    return isinstance(u, str) and len(u) < 1000 and (
        u.startswith("uploads/") or u.startswith("/uploads/") or u.startswith("https://") or u.startswith("http://"))


def public_user(row, prefix=""):
    if row is None:
        return None
    return {
        "id": row[prefix + "id"],
        "name": row[prefix + "name"],
        "avatar": row[prefix + "avatar"],
    }


def listing_dict(row):
    d = dict(row)
    d["amenities"] = json.loads(d["amenities"] or "[]")
    d["photos"] = json.loads(d["photos"] or "[]")
    d["instant_book"] = bool(d["instant_book"])
    d["active"] = bool(d["active"])
    if d.get("rating") is not None:
        d["rating"] = round(d["rating"], 2)
    return d


LISTING_SELECT = """
SELECT l.*, u.name AS host_name, u.avatar AS host_avatar,
       (SELECT AVG(r.rating) FROM reviews r WHERE r.listing_id = l.id) AS rating,
       (SELECT COUNT(*)      FROM reviews r WHERE r.listing_id = l.id) AS review_count
FROM listings l JOIN users u ON u.id = l.host_id
"""


def favorite_ids(req):
    if not req.user:
        return set()
    rows = req.db.execute("SELECT listing_id FROM favorites WHERE user_id = ?", (req.user["id"],))
    return {r[0] for r in rows}


def get_listing_or_404(req, listing_id):
    row = req.db.execute(LISTING_SELECT + " WHERE l.id = ?", (listing_id,)).fetchone()
    if not row:
        raise ApiError(404, "Anúncio não encontrado.")
    return row


def has_overlap(conn, listing_id, check_in, check_out, exclude_id=None):
    sql = ("SELECT 1 FROM bookings WHERE listing_id = ? AND status IN ('pending','confirmed') "
           "AND check_in < ? AND check_out > ?")
    args = [listing_id, check_out.isoformat(), check_in.isoformat()]
    if exclude_id:
        sql += " AND id != ?"
        args.append(exclude_id)
    return conn.execute(sql, args).fetchone() is not None


# ---------------------------------------------------------------- request

class Request:
    def __init__(self, handler, conn, url, params):
        self.db = conn
        self.params = params
        self.query = {k: v[0] for k, v in parse_qs(url.query).items()}
        self.cookies_out = []
        length = int(handler.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ApiError(413, "Requisição grande demais.")
        raw = handler.rfile.read(length) if length else b""
        try:
            self.body = json.loads(raw.decode("utf-8")) if raw else {}
        except (ValueError, UnicodeDecodeError):
            raise ApiError(400, "JSON inválido.")
        if not isinstance(self.body, dict):
            raise ApiError(400, "JSON inválido.")
        cookie = SimpleCookie()
        try:
            cookie.load(handler.headers.get("Cookie", ""))
        except Exception:
            pass
        self.token = cookie["sid"].value if "sid" in cookie else None
        self.user = None
        if self.token:
            row = conn.execute(
                "SELECT u.id, u.name, u.email, u.username, u.is_admin, u.avatar, u.bio, u.created_at "
                "FROM sessions s "
                "JOIN users u ON u.id = s.user_id WHERE s.token = ? "
                "AND s.created_at > datetime('now', ?)",
                (self.token, "-%d days" % SESSION_DAYS)).fetchone()
            self.user = dict(row) if row else None
            if self.user:
                self.user["is_admin"] = bool(self.user["is_admin"])

    def set_session(self, token):
        if token:
            self.cookies_out.append(
                "sid=%s; HttpOnly; Path=%s; SameSite=Lax; Max-Age=%d%s"
                % (token, BASE_PATH or "/", SESSION_DAYS * 86400, "; Secure" if COOKIE_SECURE else ""))
        else:
            self.cookies_out.append("sid=; HttpOnly; Path=%s; SameSite=Lax; Max-Age=0" % (BASE_PATH or "/"))


# ---------------------------------------------------------------- auth

def start_session(req, user_id):
    token = secrets.token_urlsafe(32)
    req.db.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    req.set_session(token)


def me_payload(conn, user_id):
    row = conn.execute("SELECT id, name, email, username, is_admin, avatar, bio, created_at "
                       "FROM users WHERE id = ?", (user_id,)).fetchone()
    d = dict(row)
    d["is_admin"] = bool(d["is_admin"])
    return d


def register(req):
    b = req.body
    name = text(b, "name", "nome", required=True, max_len=80)
    email = text(b, "email", "e-mail", required=True, max_len=120).lower()
    password = str(b.get("password") or "")
    if not EMAIL_RE.match(email):
        raise ApiError(400, "E-mail inválido.")
    if len(password) < 6:
        raise ApiError(400, "A senha deve ter pelo menos 6 caracteres.")
    if req.db.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone():
        raise ApiError(409, "Já existe uma conta com esse e-mail.")
    salt, pw_hash = db.hash_password(password)
    cur = req.db.execute("INSERT INTO users (name, email, password_hash, salt) VALUES (?, ?, ?, ?)",
                         (name, email, pw_hash, salt))
    start_session(req, cur.lastrowid)
    return {"user": me_payload(req.db, cur.lastrowid)}


def login(req):
    # Aceita e-mail ou nome de usuário.
    key = "login" if req.body.get("login") else "email"
    ident = text(req.body, key, "e-mail ou usuário", required=True, max_len=120).lower()
    password = str(req.body.get("password") or "")
    row = req.db.execute("SELECT * FROM users WHERE email = ? OR username = ? COLLATE NOCASE",
                         (ident, ident)).fetchone()
    if not row or not db.verify_password(password, row["salt"], row["password_hash"]):
        raise ApiError(401, "Usuário ou senha incorretos.")
    start_session(req, row["id"])
    return {"user": me_payload(req.db, row["id"])}


def logout(req):
    if req.token:
        req.db.execute("DELETE FROM sessions WHERE token = ?", (req.token,))
    req.set_session(None)
    return {"ok": True}


def get_me(req):
    return {"user": req.user}


def update_me(req):
    b = req.body
    name = text(b, "name", "nome", required=True, max_len=80)
    bio = text(b, "bio", "bio", max_len=1000)
    avatar = b.get("avatar") or None
    if avatar is not None and not valid_url(avatar):
        raise ApiError(400, "Foto de perfil inválida.")
    req.db.execute("UPDATE users SET name = ?, bio = ?, avatar = ? WHERE id = ?",
                   (name, bio, avatar, req.user["id"]))
    return {"user": me_payload(req.db, req.user["id"])}


def get_user(req):
    uid = int(req.params[0])
    row = req.db.execute("SELECT id, name, avatar, bio, created_at FROM users WHERE id = ?",
                         (uid,)).fetchone()
    if not row:
        raise ApiError(404, "Usuário não encontrado.")
    listings = req.db.execute(LISTING_SELECT + " WHERE l.host_id = ? AND l.active = 1 "
                              "ORDER BY l.created_at DESC", (uid,)).fetchall()
    favs = favorite_ids(req)
    out = []
    for r in listings:
        d = listing_dict(r)
        d["is_favorite"] = d["id"] in favs
        out.append(d)
    return {"user": dict(row), "listings": out}


# ---------------------------------------------------------------- meta / uploads

def get_meta(req):
    return {"property_types": db.PROPERTY_TYPES, "amenities": db.AMENITIES}


UPLOAD_RE = re.compile(r"^data:image/(png|jpeg|webp|gif);base64,(.+)$", re.S)
MAGIC = {"png": b"\x89PNG", "jpeg": b"\xff\xd8", "gif": b"GIF8", "webp": b"RIFF"}


def upload(req):
    m = UPLOAD_RE.match(str(req.body.get("data") or ""))
    if not m:
        raise ApiError(400, "Envie uma imagem PNG, JPEG, WEBP ou GIF.")
    kind, payload = m.groups()
    try:
        data = base64.b64decode(payload, validate=False)
    except Exception:
        raise ApiError(400, "Imagem corrompida.")
    if len(data) > MAX_UPLOAD:
        raise ApiError(413, "A imagem deve ter no máximo 5 MB.")
    if not data.startswith(MAGIC[kind]):
        raise ApiError(400, "O arquivo não parece ser uma imagem válida.")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = "jpg" if kind == "jpeg" else kind
    name = "%s.%s" % (secrets.token_hex(12), ext)
    with open(os.path.join(UPLOAD_DIR, name), "wb") as f:
        f.write(data)
    return {"url": "uploads/" + name}  # relativo: funciona com ou sem BASE_PATH


# ---------------------------------------------------------------- listings

SORTS = {
    "price_asc": "l.price_per_night ASC",
    "price_desc": "l.price_per_night DESC",
    "rating": "(SELECT COALESCE(AVG(r.rating), 0) FROM reviews r WHERE r.listing_id = l.id) DESC",
    "newest": "l.created_at DESC, l.id DESC",
}


def search_listings(req):
    q = req.query
    sql = LISTING_SELECT + " WHERE l.active = 1"
    args = []
    term = (q.get("q") or "").strip()
    if term:
        like = "%" + term + "%"
        sql += " AND (l.city LIKE ? OR l.state LIKE ? OR l.title LIKE ? OR l.country LIKE ?)"
        args += [like] * 4
    if q.get("guests"):
        sql += " AND l.max_guests >= ?"
        args.append(number(q, "guests", "hóspedes", 1, 50, int))
    if q.get("type"):
        sql += " AND l.property_type = ?"
        args.append(q["type"])
    if q.get("min_price"):
        sql += " AND l.price_per_night >= ?"
        args.append(number(q, "min_price", "preço mínimo", 0, 1e7))
    if q.get("max_price"):
        sql += " AND l.price_per_night <= ?"
        args.append(number(q, "max_price", "preço máximo", 0, 1e7))
    if q.get("check_in") and q.get("check_out"):
        ci = parse_date(q["check_in"], "check-in")
        co = parse_date(q["check_out"], "check-out")
        if co <= ci:
            raise ApiError(400, "O check-out deve ser depois do check-in.")
        sql += (" AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.listing_id = l.id "
                "AND b.status IN ('pending','confirmed') AND b.check_in < ? AND b.check_out > ?)")
        args += [co.isoformat(), ci.isoformat()]
    sql += " ORDER BY " + SORTS.get(q.get("sort"), SORTS["newest"])
    rows = req.db.execute(sql, args).fetchall()
    wanted = [a for a in (q.get("amenities") or "").split(",") if a]
    favs = favorite_ids(req)
    results = []
    for r in rows:
        d = listing_dict(r)
        if wanted and not all(a in d["amenities"] for a in wanted):
            continue
        d["is_favorite"] = d["id"] in favs
        d.pop("address", None)
        results.append(d)
    return {"listings": results}


def get_listing(req):
    row = get_listing_or_404(req, int(req.params[0]))
    is_owner = req.user and req.user["id"] == row["host_id"]
    if not row["active"] and not is_owner:
        raise ApiError(404, "Este anúncio não está disponível.")
    d = listing_dict(row)
    d["is_favorite"] = d["id"] in favorite_ids(req)
    d["is_owner"] = bool(is_owner)
    host = req.db.execute("SELECT id, name, avatar, bio, created_at FROM users WHERE id = ?",
                          (row["host_id"],)).fetchone()
    d["host"] = dict(host)
    d["host"]["listing_count"] = req.db.execute(
        "SELECT COUNT(*) FROM listings WHERE host_id = ? AND active = 1", (row["host_id"],)).fetchone()[0]
    d["reviews"] = [dict(r) for r in req.db.execute(
        "SELECT r.id, r.rating, r.comment, r.created_at, u.id AS author_id, u.name AS author_name, "
        "u.avatar AS author_avatar FROM reviews r JOIN users u ON u.id = r.author_id "
        "WHERE r.listing_id = ? ORDER BY r.created_at DESC", (d["id"],))]
    d["unavailable"] = [dict(r) for r in req.db.execute(
        "SELECT check_in, check_out FROM bookings WHERE listing_id = ? "
        "AND status IN ('pending','confirmed') AND check_out >= ? ORDER BY check_in",
        (d["id"], today().isoformat()))]
    return {"listing": d}


def clean_listing(body):
    ptype = body.get("property_type") or "Apartamento"
    if ptype not in db.PROPERTY_TYPES:
        raise ApiError(400, "Tipo de imóvel inválido.")
    lat, lng = body.get("lat"), body.get("lng")
    if lat in ("", None) or lng in ("", None):
        lat = lng = None
    else:
        lat = number(body, "lat", "latitude", -90, 90)
        lng = number(body, "lng", "longitude", -180, 180)
    amenities = body.get("amenities") or []
    if not isinstance(amenities, list):
        raise ApiError(400, "Comodidades inválidas.")
    photos = body.get("photos") or []
    if not isinstance(photos, list) or len(photos) > 20 or not all(valid_url(p) for p in photos):
        raise ApiError(400, "Fotos inválidas (máximo de 20).")
    if not photos:
        raise ApiError(400, "Adicione pelo menos uma foto.")
    return {
        "title": text(body, "title", "título", required=True, max_len=100),
        "description": text(body, "description", "descrição", max_len=5000),
        "property_type": ptype,
        "city": text(body, "city", "cidade", required=True, max_len=80),
        "state": text(body, "state", "estado", max_len=80),
        "country": text(body, "country", "país", max_len=80, default="Brasil") or "Brasil",
        "address": text(body, "address", "endereço", max_len=200),
        "lat": lat,
        "lng": lng,
        "price_per_night": number(body, "price_per_night", "preço por noite", 1, 100000),
        "cleaning_fee": number(body, "cleaning_fee", "taxa de limpeza", 0, 100000, default=0),
        "max_guests": number(body, "max_guests", "hóspedes", 1, 50, int),
        "bedrooms": number(body, "bedrooms", "quartos", 0, 50, int, default=1),
        "beds": number(body, "beds", "camas", 1, 100, int, default=1),
        "bathrooms": number(body, "bathrooms", "banheiros", 0, 50, default=1),
        "amenities": json.dumps([a for a in amenities if a in db.AMENITIES], ensure_ascii=False),
        "photos": json.dumps(photos),
        "instant_book": 1 if body.get("instant_book") else 0,
    }


def create_listing(req):
    data = clean_listing(req.body)
    data["host_id"] = req.user["id"]
    cols = ", ".join(data)
    marks = ", ".join("?" for _ in data)
    cur = req.db.execute("INSERT INTO listings (%s) VALUES (%s)" % (cols, marks), list(data.values()))
    return {"id": cur.lastrowid}


def own_listing(req):
    row = req.db.execute("SELECT * FROM listings WHERE id = ?", (int(req.params[0]),)).fetchone()
    if not row:
        raise ApiError(404, "Anúncio não encontrado.")
    if row["host_id"] != req.user["id"]:
        raise ApiError(403, "Você não é o anfitrião deste anúncio.")
    return row


def update_listing(req):
    row = own_listing(req)
    data = clean_listing(req.body)
    sets = ", ".join("%s = ?" % k for k in data)
    req.db.execute("UPDATE listings SET %s WHERE id = ?" % sets, list(data.values()) + [row["id"]])
    return {"id": row["id"]}


def toggle_listing(req):
    row = own_listing(req)
    req.db.execute("UPDATE listings SET active = ? WHERE id = ?", (0 if row["active"] else 1, row["id"]))
    return {"active": not row["active"]}


def delete_listing(req):
    row = own_listing(req)
    if req.db.execute("SELECT 1 FROM bookings WHERE listing_id = ? LIMIT 1", (row["id"],)).fetchone():
        raise ApiError(409, "Este anúncio já tem reservas. Pause-o em vez de excluir.")
    req.db.execute("DELETE FROM listings WHERE id = ?", (row["id"],))
    return {"ok": True}


def host_listings(req):
    rows = req.db.execute(LISTING_SELECT + " WHERE l.host_id = ? ORDER BY l.created_at DESC",
                          (req.user["id"],)).fetchall()
    return {"listings": [listing_dict(r) for r in rows]}


# ---------------------------------------------------------------- favorites

def list_favorites(req):
    rows = req.db.execute(
        LISTING_SELECT + " JOIN favorites f ON f.listing_id = l.id WHERE f.user_id = ? "
        "ORDER BY f.created_at DESC", (req.user["id"],)).fetchall()
    out = []
    for r in rows:
        d = listing_dict(r)
        d["is_favorite"] = True
        out.append(d)
    return {"listings": out}


def add_favorite(req):
    get_listing_or_404(req, int(req.params[0]))
    req.db.execute("INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)",
                   (req.user["id"], int(req.params[0])))
    return {"is_favorite": True}


def remove_favorite(req):
    req.db.execute("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?",
                   (req.user["id"], int(req.params[0])))
    return {"is_favorite": False}


# ---------------------------------------------------------------- bookings

BOOKING_SELECT = """
SELECT b.*, l.title AS listing_title, l.city AS listing_city, l.state AS listing_state,
       l.photos AS listing_photos, l.host_id, l.address AS listing_address,
       g.name AS guest_name, g.avatar AS guest_avatar,
       h.name AS host_name, h.avatar AS host_avatar,
       (SELECT COUNT(*) FROM reviews r WHERE r.booking_id = b.id) AS has_review,
       (SELECT COUNT(*) FROM messages m WHERE m.booking_id = b.id) AS message_count
FROM bookings b
JOIN listings l ON l.id = b.listing_id
JOIN users g ON g.id = b.guest_id
JOIN users h ON h.id = l.host_id
"""


def booking_dict(row, user):
    d = dict(row)
    photos = json.loads(d.pop("listing_photos") or "[]")
    d["listing_photo"] = photos[0] if photos else None
    d["has_review"] = bool(d["has_review"])
    if user["id"] == d["host_id"]:
        d["role"] = "host"
    elif user["id"] == d["guest_id"]:
        d["role"] = "guest"
    else:
        d["role"] = "admin"  # só administradores chegam aqui (ver load_booking)
    # Endereço completo só é revelado ao hóspede após confirmação.
    if d["status"] != "confirmed" and d["role"] == "guest":
        d["listing_address"] = None
    t = today().isoformat()
    d["is_past"] = d["check_out"] <= t
    d["can_confirm"] = d["role"] in ("host", "admin") and d["status"] == "pending" and d["check_in"] >= t
    d["can_decline"] = d["can_confirm"]
    d["can_cancel"] = d["status"] in ACTIVE_STATUSES and d["check_in"] > t
    d["can_review"] = (d["role"] == "guest" and d["status"] == "confirmed"
                       and d["is_past"] and not d["has_review"])
    return d


def create_booking(req):
    b = req.body
    listing_id = number(b, "listing_id", "anúncio", 1, 10 ** 12, int)
    row = req.db.execute("SELECT * FROM listings WHERE id = ?", (listing_id,)).fetchone()
    if not row or not row["active"]:
        raise ApiError(404, "Anúncio não disponível.")
    if row["host_id"] == req.user["id"]:
        raise ApiError(400, "Você não pode reservar o seu próprio anúncio.")
    ci = parse_date(b.get("check_in"), "check-in")
    co = parse_date(b.get("check_out"), "check-out")
    if ci < today():
        raise ApiError(400, "O check-in não pode ser no passado.")
    nights = (co - ci).days
    if nights < 1:
        raise ApiError(400, "A estadia deve ter pelo menos 1 noite.")
    if nights > 90:
        raise ApiError(400, "A estadia pode ter no máximo 90 noites.")
    guests = number(b, "guests", "hóspedes", 1, 50, int, default=1)
    if guests > row["max_guests"]:
        raise ApiError(400, "Este lugar aceita no máximo %d hóspedes." % row["max_guests"])
    if has_overlap(req.db, listing_id, ci, co):
        raise ApiError(409, "Essas datas não estão mais disponíveis.")
    total = nights * row["price_per_night"] + row["cleaning_fee"]
    status = "confirmed" if row["instant_book"] else "pending"
    cur = req.db.execute(
        "INSERT INTO bookings (listing_id, guest_id, check_in, check_out, guests, nights, "
        "price_per_night, cleaning_fee, total_price, status) VALUES (?,?,?,?,?,?,?,?,?,?)",
        (listing_id, req.user["id"], ci.isoformat(), co.isoformat(), guests, nights,
         row["price_per_night"], row["cleaning_fee"], total, status))
    msg = text(b, "message", "mensagem", max_len=2000)
    if msg:
        req.db.execute("INSERT INTO messages (booking_id, sender_id, body) VALUES (?, ?, ?)",
                       (cur.lastrowid, req.user["id"], msg))
    return {"id": cur.lastrowid, "status": status}


def my_bookings(req):
    rows = req.db.execute(BOOKING_SELECT + " WHERE b.guest_id = ? ORDER BY b.check_in DESC",
                          (req.user["id"],)).fetchall()
    return {"bookings": [booking_dict(r, req.user) for r in rows]}


def host_bookings(req):
    rows = req.db.execute(BOOKING_SELECT + " WHERE l.host_id = ? ORDER BY b.check_in DESC",
                          (req.user["id"],)).fetchall()
    return {"bookings": [booking_dict(r, req.user) for r in rows]}


def load_booking(req):
    row = req.db.execute(BOOKING_SELECT + " WHERE b.id = ?", (int(req.params[0]),)).fetchone()
    if not row or (req.user["id"] not in (row["guest_id"], row["host_id"]) and not req.user["is_admin"]):
        raise ApiError(404, "Reserva não encontrada.")
    return booking_dict(row, req.user)


def get_booking(req):
    d = load_booking(req)
    d["messages"] = [dict(m) for m in req.db.execute(
        "SELECT m.id, m.body, m.created_at, m.sender_id, u.name AS sender_name, u.avatar AS sender_avatar "
        "FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.booking_id = ? ORDER BY m.id",
        (d["id"],))]
    review = req.db.execute("SELECT rating, comment, created_at FROM reviews WHERE booking_id = ?",
                            (d["id"],)).fetchone()
    d["review"] = dict(review) if review else None
    return {"booking": d}


def set_status(req, status):
    req.db.execute("UPDATE bookings SET status = ?, updated_at = datetime('now') WHERE id = ?",
                   (status, int(req.params[0])))
    return get_booking(req)


def confirm_booking(req):
    d = load_booking(req)
    if not d["can_confirm"]:
        raise ApiError(400, "Esta reserva não pode ser confirmada.")
    ci, co = parse_date(d["check_in"], "check-in"), parse_date(d["check_out"], "check-out")
    if has_overlap(req.db, d["listing_id"], ci, co, exclude_id=d["id"]):
        raise ApiError(409, "Já existe outra reserva nessas datas.")
    return set_status(req, "confirmed")


def decline_booking(req):
    if not load_booking(req)["can_decline"]:
        raise ApiError(400, "Esta reserva não pode ser recusada.")
    return set_status(req, "declined")


def cancel_booking(req):
    if not load_booking(req)["can_cancel"]:
        raise ApiError(400, "Esta reserva não pode mais ser cancelada.")
    return set_status(req, "cancelled")


def post_message(req):
    d = load_booking(req)
    body = text(req.body, "body", "mensagem", required=True, max_len=2000)
    req.db.execute("INSERT INTO messages (booking_id, sender_id, body) VALUES (?, ?, ?)",
                   (d["id"], req.user["id"], body))
    return get_booking(req)


def post_review(req):
    d = load_booking(req)
    if not d["can_review"]:
        raise ApiError(400, "Você só pode avaliar estadias concluídas, uma vez.")
    rating = number(req.body, "rating", "nota", 1, 5, int)
    comment = text(req.body, "comment", "comentário", max_len=2000)
    req.db.execute("INSERT INTO reviews (booking_id, listing_id, author_id, rating, comment) "
                   "VALUES (?, ?, ?, ?, ?)", (d["id"], d["listing_id"], req.user["id"], rating, comment))
    return get_booking(req)


def inbox(req):
    uid = req.user["id"]
    rows = req.db.execute(
        BOOKING_SELECT + " WHERE (b.guest_id = ? OR l.host_id = ?) "
        "AND EXISTS (SELECT 1 FROM messages m WHERE m.booking_id = b.id)", (uid, uid)).fetchall()
    out = []
    for r in rows:
        d = booking_dict(r, req.user)
        last = req.db.execute("SELECT body, created_at, sender_id FROM messages WHERE booking_id = ? "
                              "ORDER BY id DESC LIMIT 1", (d["id"],)).fetchone()
        d["last_message"] = dict(last)
        out.append(d)
    out.sort(key=lambda x: x["last_message"]["created_at"], reverse=True)
    return {"conversations": out}


# ---------------------------------------------------------------- admin

def require_admin(req):
    if not req.user.get("is_admin"):
        raise ApiError(403, "Acesso restrito ao administrador.")


def admin_overview(req):
    require_admin(req)
    c = req.db
    t = today().isoformat()

    def scalar(sql, args=()):
        return c.execute(sql, args).fetchone()[0] or 0

    stats = {
        "users": scalar("SELECT COUNT(*) FROM users"),
        "hosts": scalar("SELECT COUNT(DISTINCT host_id) FROM listings"),
        "listings": scalar("SELECT COUNT(*) FROM listings"),
        "active_listings": scalar("SELECT COUNT(*) FROM listings WHERE active = 1"),
        "bookings": scalar("SELECT COUNT(*) FROM bookings"),
        "pending": scalar("SELECT COUNT(*) FROM bookings WHERE status = 'pending'"),
        "pending_value": scalar("SELECT SUM(total_price) FROM bookings WHERE status = 'pending'"),
        "upcoming": scalar("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND check_out > ?", (t,)),
        "upcoming_value": scalar("SELECT SUM(total_price) FROM bookings WHERE status = 'confirmed' "
                                 "AND check_out > ?", (t,)),
        "completed": scalar("SELECT COUNT(*) FROM bookings WHERE status = 'confirmed' AND check_out <= ?", (t,)),
        "completed_value": scalar("SELECT SUM(total_price) FROM bookings WHERE status = 'confirmed' "
                                  "AND check_out <= ?", (t,)),
        "cancelled": scalar("SELECT COUNT(*) FROM bookings WHERE status IN ('cancelled','declined')"),
        "nights": scalar("SELECT SUM(nights) FROM bookings WHERE status = 'confirmed'"),
    }
    bookings = [booking_dict(r, req.user) for r in c.execute(
        BOOKING_SELECT + " ORDER BY b.created_at DESC, b.id DESC")]
    listings = []
    for r in c.execute(
            "SELECT l.id, l.title, l.city, l.state, l.property_type, l.price_per_night, l.cleaning_fee, "
            "l.active, l.instant_book, l.photos, u.id AS host_id, u.name AS host_name, "
            "(SELECT COUNT(*) FROM bookings b WHERE b.listing_id = l.id) AS booking_count, "
            "(SELECT COUNT(*) FROM bookings b WHERE b.listing_id = l.id AND b.status = 'pending') AS pending_count, "
            "(SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b WHERE b.listing_id = l.id "
            " AND b.status = 'confirmed') AS revenue, "
            "(SELECT COALESCE(SUM(b.nights), 0) FROM bookings b WHERE b.listing_id = l.id "
            " AND b.status = 'confirmed') AS nights, "
            "(SELECT AVG(r.rating) FROM reviews r WHERE r.listing_id = l.id) AS rating, "
            "(SELECT COUNT(*) FROM reviews r WHERE r.listing_id = l.id) AS review_count "
            "FROM listings l JOIN users u ON u.id = l.host_id ORDER BY revenue DESC"):
        d = dict(r)
        photos = json.loads(d.pop("photos") or "[]")
        d["photo"] = photos[0] if photos else None
        d["active"], d["instant_book"] = bool(d["active"]), bool(d["instant_book"])
        listings.append(d)
    users = []
    for r in c.execute(
            "SELECT u.id, u.name, u.email, u.username, u.is_admin, u.avatar, u.created_at, "
            "(SELECT COUNT(*) FROM listings l WHERE l.host_id = u.id) AS listing_count, "
            "(SELECT COUNT(*) FROM bookings b WHERE b.guest_id = u.id) AS trip_count, "
            "(SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b WHERE b.guest_id = u.id "
            " AND b.status = 'confirmed') AS spent, "
            "(SELECT COALESCE(SUM(b.total_price), 0) FROM bookings b JOIN listings l ON l.id = b.listing_id "
            " WHERE l.host_id = u.id AND b.status = 'confirmed') AS earned "
            "FROM users u ORDER BY u.is_admin DESC, u.name"):
        d = dict(r)
        d["is_admin"] = bool(d["is_admin"])
        users.append(d)
    return {"stats": stats, "bookings": bookings, "listings": listings, "users": users}


# ---------------------------------------------------------------- routing

def route(method, pattern, fn, auth=False):
    return (method, re.compile("^" + pattern + "$"), fn, auth)


ROUTES = [
    route("GET", r"/api/meta", get_meta),
    route("POST", r"/api/auth/register", register),
    route("POST", r"/api/auth/login", login),
    route("POST", r"/api/auth/logout", logout),
    route("GET", r"/api/auth/me", get_me),
    route("PUT", r"/api/me", update_me, auth=True),
    route("GET", r"/api/users/(\d+)", get_user),
    route("POST", r"/api/uploads", upload, auth=True),
    route("GET", r"/api/listings", search_listings),
    route("POST", r"/api/listings", create_listing, auth=True),
    route("GET", r"/api/listings/(\d+)", get_listing),
    route("PUT", r"/api/listings/(\d+)", update_listing, auth=True),
    route("DELETE", r"/api/listings/(\d+)", delete_listing, auth=True),
    route("POST", r"/api/listings/(\d+)/toggle", toggle_listing, auth=True),
    route("GET", r"/api/host/listings", host_listings, auth=True),
    route("GET", r"/api/host/bookings", host_bookings, auth=True),
    route("GET", r"/api/favorites", list_favorites, auth=True),
    route("POST", r"/api/favorites/(\d+)", add_favorite, auth=True),
    route("DELETE", r"/api/favorites/(\d+)", remove_favorite, auth=True),
    route("GET", r"/api/bookings", my_bookings, auth=True),
    route("POST", r"/api/bookings", create_booking, auth=True),
    route("GET", r"/api/bookings/(\d+)", get_booking, auth=True),
    route("POST", r"/api/bookings/(\d+)/confirm", confirm_booking, auth=True),
    route("POST", r"/api/bookings/(\d+)/decline", decline_booking, auth=True),
    route("POST", r"/api/bookings/(\d+)/cancel", cancel_booking, auth=True),
    route("POST", r"/api/bookings/(\d+)/messages", post_message, auth=True),
    route("POST", r"/api/bookings/(\d+)/review", post_review, auth=True),
    route("GET", r"/api/inbox", inbox, auth=True),
    route("GET", r"/api/admin/overview", admin_overview, auth=True),
]


class Handler(BaseHTTPRequestHandler):
    server_version = "Estadia/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def dispatch(self, method):
        url = urlparse(self.path)
        if BASE_PATH:
            if url.path in ("", "/", BASE_PATH):
                # As URLs do frontend são relativas: a página precisa terminar em "/".
                return self.redirect(BASE_PATH + "/")
            if not url.path.startswith(BASE_PATH + "/"):
                return self.send_json(404, {"error": "Não encontrado."})
            url = url._replace(path=url.path[len(BASE_PATH):])
        if url.path.startswith("/api/"):
            self.handle_api(method, url)
        elif method == "GET":
            self.serve_static(unquote(url.path))
        else:
            self.send_json(405, {"error": "Método não permitido."})

    def handle_api(self, method, url):
        conn = db.connect()
        req = None
        try:
            for m, pattern, fn, auth in ROUTES:
                match = pattern.match(url.path)
                if m != method or not match:
                    continue
                req = Request(self, conn, url, match.groups())
                if auth and not req.user:
                    raise ApiError(401, "Faça login para continuar.")
                result = fn(req)
                conn.commit()
                return self.send_json(200, result, req.cookies_out)
            raise ApiError(404, "Rota não encontrada.")
        except ApiError as e:
            conn.rollback()
            self.send_json(e.status, {"error": e.message}, req.cookies_out if req else [])
        except Exception:
            conn.rollback()
            traceback.print_exc()
            self.send_json(500, {"error": "Erro interno do servidor."})
        finally:
            conn.close()

    def redirect(self, location):
        self.send_response(301)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def send_json(self, status, data, cookies=()):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        for c in cookies:
            self.send_header("Set-Cookie", c)
        self.end_headers()
        self.wfile.write(payload)

    def serve_static(self, path):
        if path == "/":
            path = "/index.html"
        root = UPLOAD_DIR if path.startswith("/uploads/") else PUBLIC_DIR
        rel = path[len("/uploads/"):] if root == UPLOAD_DIR else path.lstrip("/")
        full = os.path.realpath(os.path.join(root, rel))
        if not full.startswith(os.path.realpath(root) + os.sep) or not os.path.isfile(full):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write("Não encontrado".encode("utf-8"))
            return
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript",):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)


def main():
    mimetypes.add_type("application/javascript", ".js")
    db.init_schema()
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as e:
        if e.errno in (48, 98):  # endereço em uso (macOS / Linux)
            print("A porta %d já está em uso — o Estadia (ou outro programa) já está rodando nela." % PORT)
            print("Pare o servidor antigo com Ctrl+C na aba em que ele roda, ou use outra porta:  "
                  "PORT=%d python3 server.py" % (PORT + 1))
            sys.exit(1)
        raise
    print("Estadia rodando em http://localhost:%d%s/  (Ctrl+C para parar)" % (PORT, BASE_PATH))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")


if __name__ == "__main__":
    main()
