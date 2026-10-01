"""Local multi-user password authentication."""
import base64
import hashlib
import hmac
import secrets
import time
import uuid
from datetime import date

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from db import get_connection

router = APIRouter(prefix="/api/auth")
COOKIE = "medatlas_session"


class Credentials(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dateOfBirth: str
    password: str = Field(min_length=8, max_length=128)


def _validate_name_date(body):
    name = " ".join(body.name.split())
    try:
        birthday = date.fromisoformat(body.dateOfBirth)
    except ValueError:
        raise HTTPException(400, "Enter a valid date of birth.")
    if not name or not date(1900, 1, 1) <= birthday <= date.today():
        raise HTTPException(400, "Enter a name and valid date of birth.")
    return name, birthday.isoformat()


def _hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$16384$8$1$" + base64.urlsafe_b64encode(salt).decode() + "$" + base64.urlsafe_b64encode(digest).decode()


def _check_password(password, stored):
    try:
        algorithm, n, r, p, salt, expected = stored.split("$")
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(
            password.encode(),
            salt=base64.urlsafe_b64decode(salt.encode()),
            n=int(n),
            r=int(r),
            p=int(p),
        )
        return hmac.compare_digest(base64.urlsafe_b64encode(digest).decode(), expected)
    except (ValueError, TypeError):
        return False


def _profile(row):
    return {"userId": row["id"], "name": row["name"], "dateOfBirth": row["birthday"]}


def _session(response, db, user_id):
    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO auth_sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)",
        (hashlib.sha256(token.encode()).hexdigest(), user_id, int(time.time()) + 12 * 3600),
    )
    response.set_cookie(COOKIE, token, httponly=True, samesite="strict", max_age=12 * 3600, path="/")


def _current_user(request):
    token = request.cookies.get(COOKIE, "")
    if not token:
        return None
    with get_connection() as db:
        return db.execute(
            "SELECT u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id "
            "WHERE s.token_hash=? AND s.expires_at>?",
            (hashlib.sha256(token.encode()).hexdigest(), int(time.time())),
        ).fetchone()


def current_profile(request):
    row = _current_user(request)
    return _profile(row) if row else None


def init_auth():
    with get_connection() as db:
        columns = {row[1] for row in db.execute("PRAGMA table_info(users)")}
        if not columns:
            db.execute("""
                CREATE TABLE users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    birthday TEXT NOT NULL,
                    mobile TEXT NOT NULL,
                    password_hash TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
        elif "password_hash" not in columns:
            db.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

        session_columns = {row[1] for row in db.execute("PRAGMA table_info(auth_sessions)")}
        if session_columns and "user_id" not in session_columns:
            db.execute("ALTER TABLE auth_sessions RENAME TO auth_sessions_legacy_v1")
            db.execute("CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)")
        elif not session_columns:
            db.execute("CREATE TABLE auth_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)")

        legacy = None
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='auth_owner'").fetchone():
            legacy = db.execute("SELECT * FROM auth_owner WHERE id=1").fetchone()
        if legacy and not db.execute("SELECT 1 FROM users WHERE password_hash IS NULL LIMIT 1").fetchone():
            user_id = f"usr_{uuid.uuid4().hex}"
            db.execute(
                "INSERT INTO users(id,name,birthday,mobile,password_hash) VALUES (?,?,?,?,NULL)",
                (user_id, legacy["name"], legacy["birthday"], legacy["mobile"]),
            )
            db.execute("UPDATE documents SET user_id=? WHERE user_id IS NULL", (user_id,))
            db.execute("UPDATE audit_logs SET user_id=? WHERE user_id IS NULL", (user_id,))
        db.commit()


@router.get("/status")
def status(request: Request):
    with get_connection() as db:
        accounts = db.execute("SELECT COUNT(*) FROM users WHERE password_hash IS NOT NULL").fetchone()[0]
    return {"accounts": accounts, "profile": current_profile(request)}


@router.post("/create")
def create_account(body: Credentials, response: Response):
    name, birthday = _validate_name_date(body)
    password_hash = _hash_password(body.password)
    with get_connection() as db:
        legacy = db.execute(
            "SELECT * FROM users WHERE name=? AND birthday=? AND password_hash IS NULL ORDER BY created_at LIMIT 1",
            (name, birthday),
        ).fetchone()
        if legacy:
            user_id = legacy["id"]
            db.execute("UPDATE users SET password_hash=? WHERE id=?", (password_hash, user_id))
            row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        else:
            user_id = f"usr_{uuid.uuid4().hex}"
            db.execute(
                "INSERT INTO users(id,name,birthday,mobile,password_hash) VALUES (?,?,?,?,?)",
                (user_id, name, birthday, f"local_{user_id}", password_hash),
            )
            row = db.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
        _session(response, db, user_id)
        db.commit()
    return {"profile": _profile(row)}


@router.post("/login")
def login(body: Credentials, response: Response):
    name, birthday = _validate_name_date(body)
    with get_connection() as db:
        rows = db.execute(
            "SELECT * FROM users WHERE name=? AND birthday=? AND password_hash IS NOT NULL",
            (name, birthday),
        ).fetchall()
        row = next((candidate for candidate in rows if _check_password(body.password, candidate["password_hash"])), None)
        if not row:
            raise HTTPException(401, "Incorrect name, date of birth, or password.")
        _session(response, db, row["id"])
        db.commit()
    return {"profile": _profile(row)}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE, "")
    if token:
        with get_connection() as db:
            db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
            db.commit()
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}
