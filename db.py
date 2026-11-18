"""Banco de dados SQLite do Estadia: conexão, esquema e utilitários de senha."""
import hashlib
import hmac
import os
import secrets
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("ESTADIA_DB", os.path.join(BASE_DIR, "data", "estadia.db"))

PROPERTY_TYPES = ["Casa", "Apartamento", "Chalé", "Pousada", "Quarto", "Cabana", "Sítio", "Loft"]

AMENITIES = [
    "Wi-Fi", "Cozinha", "Ar-condicionado", "Estacionamento gratuito", "Piscina", "TV",
    "Máquina de lavar", "Espaço de trabalho", "Aceita animais", "Café da manhã",
    "Churrasqueira", "Vista para o mar", "Academia", "Hidromassagem", "Lareira",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt          TEXT NOT NULL,
    avatar        TEXT,
    bio           TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS listings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    host_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    property_type   TEXT NOT NULL DEFAULT 'Apartamento',
    city            TEXT NOT NULL,
    state           TEXT NOT NULL DEFAULT '',
    country         TEXT NOT NULL DEFAULT 'Brasil',
    address         TEXT NOT NULL DEFAULT '',
    lat             REAL,
    lng             REAL,
    price_per_night REAL NOT NULL,
    cleaning_fee    REAL NOT NULL DEFAULT 0,
    max_guests      INTEGER NOT NULL DEFAULT 1,
    bedrooms        INTEGER NOT NULL DEFAULT 1,
    beds            INTEGER NOT NULL DEFAULT 1,
    bathrooms       REAL NOT NULL DEFAULT 1,
    amenities       TEXT NOT NULL DEFAULT '[]',
    photos          TEXT NOT NULL DEFAULT '[]',
    instant_book    INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id      INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    guest_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in        TEXT NOT NULL,
    check_out       TEXT NOT NULL,
    guests          INTEGER NOT NULL,
    nights          INTEGER NOT NULL,
    price_per_night REAL NOT NULL,
    cleaning_fee    REAL NOT NULL,
    total_price     REAL NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | declined | cancelled
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    sender_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    author_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_city   ON listings(city);
CREATE INDEX IF NOT EXISTS idx_bookings_list   ON bookings(listing_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_guest  ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_messages_book   ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
"""


def connect():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_schema():
    conn = connect()
    conn.executescript(SCHEMA)
    # Migrações: colunas adicionadas depois da primeira versão.
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)")}
    if "username" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN username TEXT")
    if "is_admin" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)")
    conn.commit()
    conn.close()


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 200_000)
    return salt, digest.hex()


def verify_password(password, salt, expected_hash):
    _, digest = hash_password(password, salt)
    return hmac.compare_digest(digest, expected_hash)
