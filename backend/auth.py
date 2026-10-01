"""Single-owner, offline authenticator login for the local medical vault."""
import hashlib
import hmac
import io
import re
import secrets
import time
from datetime import date

import pyotp
import qrcode
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from config import DATA_DIR
from db import get_connection

router = APIRouter(prefix="/api/auth")
COOKIE = "medatlas_session"
ENROLL_COOKIE = "medatlas_enrollment"
KEY_FILE = DATA_DIR / "totp.key"


class Profile(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    dateOfBirth: str
    mobile: str


class Code(BaseModel):
    code: str


class Login(Profile, Code):
    pass


def _cipher():
    try:
        key = KEY_FILE.read_bytes()
    except FileNotFoundError:
        key = Fernet.generate_key()
        try:
            with KEY_FILE.open("xb") as file:
                file.write(key)
        except FileExistsError:
            key = KEY_FILE.read_bytes()
    return Fernet(key)


def _validate(profile):
    name = " ".join(profile.name.split())
    mobile = re.sub(r"[\s()-]", "", profile.mobile)
    try:
        birthday = date.fromisoformat(profile.dateOfBirth)
    except ValueError:
        raise HTTPException(400, "Enter a valid date of birth.")
    if not name or not date(1900, 1, 1) <= birthday <= date.today() or not re.fullmatch(r"\+?[0-9]{7,15}", mobile):
        raise HTTPException(400, "Enter a name, valid date of birth, and mobile number.")
    return name, birthday.isoformat(), mobile


def _code_counter(secret, code, last=-1):
    if not re.fullmatch(r"[0-9]{6}", code):
        return None
    current = int(time.time() // 30)
    totp = pyotp.TOTP(secret)
    for counter in (current - 1, current, current + 1):
        if counter > last and hmac.compare_digest(totp.at(counter * 30), code):
            return counter
    return None


def _session(response, db, now):
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO auth_sessions(token_hash, expires_at) VALUES (?, ?)", (hashlib.sha256(token.encode()).hexdigest(), now + 12 * 3600))
    response.delete_cookie(COOKIE, path="/api")
    response.set_cookie(COOKIE, token, httponly=True, samesite="strict", max_age=12 * 3600, path="/")


def init_auth():
    with get_connection() as db:
        db.execute("CREATE TABLE IF NOT EXISTS auth_owner (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, birthday TEXT NOT NULL, mobile TEXT NOT NULL, secret TEXT NOT NULL, last_counter INTEGER NOT NULL DEFAULT -1, failures INTEGER NOT NULL DEFAULT 0, lock_until INTEGER NOT NULL DEFAULT 0)")
        db.execute("CREATE TABLE IF NOT EXISTS auth_pending (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, birthday TEXT NOT NULL, mobile TEXT NOT NULL, secret TEXT NOT NULL, nonce_hash TEXT NOT NULL, expires_at INTEGER NOT NULL)")
        db.execute("CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)")


def current_profile(request):
    token = request.cookies.get(COOKIE, "")
    if not token:
        return None
    with get_connection() as db:
        row = db.execute("SELECT o.name, o.birthday, o.mobile FROM auth_sessions s JOIN auth_owner o ON o.id=1 WHERE s.token_hash=? AND s.expires_at>?", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()
    return {"name": row["name"], "dateOfBirth": row["birthday"], "mobile": row["mobile"]} if row else None


@router.get("/status")
def status(request: Request, response: Response):
    with get_connection() as db:
        enrolled = bool(db.execute("SELECT 1 FROM auth_owner WHERE id=1").fetchone())
    profile = current_profile(request)
    # Migrate sessions created by older builds from /api to the app-wide path.
    token = request.cookies.get(COOKIE, "")
    if profile and token:
        response.delete_cookie(COOKIE, path="/api")
        response.set_cookie(COOKIE, token, httponly=True, samesite="strict", max_age=12 * 3600, path="/")
    return {"enrolled": enrolled, "profile": profile}


@router.post("/enroll")
def enroll(profile: Profile, response: Response):
    name, birthday, mobile = _validate(profile)
    secret = pyotp.random_base32()
    nonce = secrets.token_urlsafe(32)
    with get_connection() as db:
        db.execute("BEGIN IMMEDIATE")
        if db.execute("SELECT 1 FROM auth_owner WHERE id=1").fetchone():
            raise HTTPException(409, "This vault is already enrolled.")
        db.execute("INSERT OR REPLACE INTO auth_pending VALUES (1,?,?,?,?,?,?)", (name, birthday, mobile, _cipher().encrypt(secret.encode()).decode(), hashlib.sha256(nonce.encode()).hexdigest(), int(time.time()) + 600))
    uri = pyotp.TOTP(secret).provisioning_uri(name=name, issuer_name="MedAtlas local")
    image = qrcode.make(uri)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    import base64
    response.set_cookie(ENROLL_COOKIE, nonce, httponly=True, samesite="strict", max_age=600, path="/api/auth")
    return {"qr": "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode(), "manualKey": secret}


@router.post("/activate")
def activate(body: Code, request: Request, response: Response):
    nonce = request.cookies.get(ENROLL_COOKIE, "")
    now = int(time.time())
    with get_connection() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM auth_pending WHERE id=1 AND expires_at>?", (now,)).fetchone()
        if not row or not nonce or not hmac.compare_digest(hashlib.sha256(nonce.encode()).hexdigest(), row["nonce_hash"]):
            raise HTTPException(401, "Enrollment expired. Start again.")
        counter = _code_counter(_cipher().decrypt(row["secret"].encode()).decode(), body.code)
        if counter is None:
            raise HTTPException(401, "Invalid authenticator code.")
        db.execute("INSERT INTO auth_owner(id,name,birthday,mobile,secret,last_counter) VALUES (1,?,?,?,?,?)", (row["name"], row["birthday"], row["mobile"], row["secret"], counter))
        db.execute("DELETE FROM auth_pending")
        _session(response, db, now)
    response.delete_cookie(ENROLL_COOKIE, path="/api/auth")
    return {"profile": {"name": row["name"], "dateOfBirth": row["birthday"], "mobile": row["mobile"]}}


@router.post("/login")
def login(body: Login, response: Response):
    name, birthday, mobile = _validate(body)
    now = int(time.time())
    with get_connection() as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT * FROM auth_owner WHERE id=1").fetchone()
        if not row:
            raise HTTPException(409, "Set up your authenticator first.")
        if row["lock_until"] > now:
            raise HTTPException(429, "Too many attempts. Try again in five minutes.")
        profile_ok = hmac.compare_digest(name.encode(), row["name"].encode()) and hmac.compare_digest(birthday, row["birthday"]) and hmac.compare_digest(mobile, row["mobile"])
        counter = _code_counter(_cipher().decrypt(row["secret"].encode()).decode(), body.code, row["last_counter"]) if profile_ok else None
        if counter is None:
            failures = row["failures"] + 1
            db.execute("UPDATE auth_owner SET failures=?, lock_until=? WHERE id=1", (failures, now + 300 if failures >= 5 else 0))
            return Response(content='{"detail":"Incorrect details or authenticator code."}', status_code=401, media_type="application/json")
        db.execute("UPDATE auth_owner SET failures=0, lock_until=0, last_counter=? WHERE id=1", (counter,))
        _session(response, db, now)
    return {"profile": {"name": name, "dateOfBirth": birthday, "mobile": mobile}}


@router.post("/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(COOKIE, "")
    if token:
        with get_connection() as db:
            db.execute("DELETE FROM auth_sessions WHERE token_hash=?", (hashlib.sha256(token.encode()).hexdigest(),))
    response.delete_cookie(COOKIE, path="/")
    response.delete_cookie(COOKIE, path="/api")
    return {"ok": True}
