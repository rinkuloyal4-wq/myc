import os, random, hmac, hashlib, smtplib, secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from typing import Optional
from urllib.parse import urlencode

import httpx
import redis
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Response, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from db import (
    User, Topup, WalletTx, Pricing, Number,
    get_session, create_db_and_tables,
)

load_dotenv()

# ---------------- Config ----------------
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALG = "HS256"
TOKEN_DAYS = 7
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM")

TELNYX_API_KEY = os.getenv("TELNYX_API_KEY")
TELNYX_VERIFY_PROFILE_ID = os.getenv("TELNYX_VERIFY_PROFILE_ID")

PARENT_GATEWAY_URL = os.getenv("PARENT_GATEWAY_URL")
PARENT_WEBHOOK_SECRET = os.getenv("PARENT_WEBHOOK_SECRET")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
OTP_TTL = 300
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:8000")

redis_client = redis.from_url(REDIS_URL, decode_responses=True)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="3T Dial API", lifespan=lifespan)

if FRONTEND_ORIGIN and FRONTEND_ORIGIN != "http://localhost:8000":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_ORIGIN],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ---------------- Schemas ----------------
class SignupIn(BaseModel):
    name: str
    email: EmailStr
    phone: str
    password: str
    confirm_password: str


class VerifyEmailIn(BaseModel):
    email: EmailStr
    otp: str


class VerifyPhoneIn(BaseModel):
    phone: str
    otp: str


class LoginIn(BaseModel):
    identifier: str
    password: str


class ResendIn(BaseModel):
    identifier: str


class TopupCreateIn(BaseModel):
    amount_usd: float


class TopupWebhookIn(BaseModel):
    reference_id: str
    amount_usd: float
    parent_txn_id: str
    status: str


class PricingIn(BaseModel):
    country_code: str
    number_type: str
    enabled: bool = True
    rental_usd: float = 0.0
    inbound_call_per_min: float = 0.0
    outbound_call_per_min: float = 0.0
    inbound_sms: float = 0.0
    outbound_sms: float = 0.0
    voicemail_per_min: float = 0.0


# ---------------- Helpers ----------------
def gen_otp() -> str:
    return f"{random.randint(100000, 999999)}"


def send_email_otp(to_email: str, otp: str):
    msg = MIMEText(f"Your 3T Dial verification code is {otp}. It expires in 5 minutes.")
    msg["Subject"] = "3T Dial — Verify your email"
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
        s.starttls()
        s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)


async def telnyx_send_sms_otp(phone: str):
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            "https://api.telnyx.com/v2/verifications",
            headers={"Authorization": f"Bearer {TELNYX_API_KEY}"},
            json={"phone_number": phone, "verify_profile_id": TELNYX_VERIFY_PROFILE_ID},
        )
    if r.status_code >= 400:
        raise HTTPException(500, f"Telnyx SMS error: {r.text}")


async def telnyx_check_sms_otp(phone: str, code: str) -> bool:
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"https://api.telnyx.com/v2/verifications/by_phone_number/{phone}/actions/verify",
            headers={"Authorization": f"Bearer {TELNYX_API_KEY}"},
            json={"code": code, "verify_profile_id": TELNYX_VERIFY_PROFILE_ID},
        )
    return r.status_code < 400


def make_token(user_id: int) -> str:
    exp = datetime.utcnow() + timedelta(days=TOKEN_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)


def current_user(
    session: Session = Depends(get_session),
    access_token: Optional[str] = Cookie(default=None),
) -> User:
    if not access_token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(access_token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(401, "Invalid token")
    user = session.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(401, "User not found")
    return user


def admin_only(user: User = Depends(current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin only")
    return user


def user_dict(user: User, session: Session) -> dict:
    count = len(
        session.exec(
            select(Number).where(Number.user_id == user.id, Number.status == "active")
        ).all()
    )
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone,
        "is_admin": user.is_admin,
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "balance_usd": round(user.balance_usd, 2),
        "number_count": count,
    }


def credit_wallet(session: Session, user: User, amount: float,
                  tx_type: str, desc: str, ref: Optional[str] = None):
    user.balance_usd = round(user.balance_usd + amount, 4)
    session.add(user)
    session.add(WalletTx(
        user_id=user.id, type=tx_type, amount_usd=amount,
        description=desc, reference=ref,
    ))


# ---------------- Auth routes ----------------
@app.post("/api/signup")
async def signup(data: SignupIn, session: Session = Depends(get_session)):
    if data.password != data.confirm_password:
        raise HTTPException(400, "Passwords do not match")
    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if session.exec(
        select(User).where((User.email == data.email) | (User.phone == data.phone))
    ).first():
        raise HTTPException(400, "Email or phone already registered")

    user = User(
        name=data.name, email=data.email, phone=data.phone,
        password_hash=pwd_ctx.hash(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    otp = gen_otp()
    redis_client.setex(f"email_otp:{data.email}", OTP_TTL, otp)
    try:
        send_email_otp(data.email, otp)
    except Exception as e:
        raise HTTPException(500, f"Email OTP failed: {e}")

    try:
        await telnyx_send_sms_otp(data.phone)
    except Exception as e:
        raise HTTPException(500, f"SMS OTP failed: {e}")

    return {"message": "Verify email and phone", "user_id": user.id}


@app.post("/api/verify/email")
def verify_email(data: VerifyEmailIn, session: Session = Depends(get_session)):
    stored = redis_client.get(f"email_otp:{data.email}")
    if not stored or stored != data.otp:
        raise HTTPException(400, "Invalid or expired OTP")
    user = session.exec(select(User).where(User.email == data.email)).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.email_verified = True
    session.add(user)
    session.commit()
    redis_client.delete(f"email_otp:{data.email}")
    return {"message": "Email verified"}


@app.post("/api/verify/phone")
async def verify_phone(data: VerifyPhoneIn, session: Session = Depends(get_session)):
    if not await telnyx_check_sms_otp(data.phone, data.otp):
        raise HTTPException(400, "Invalid or expired OTP")
    user = session.exec(select(User).where(User.phone == data.phone)).first()
    if not user:
        raise HTTPException(404, "User not found")
    user.phone_verified = True
    session.add(user)
    session.commit()
    return {"message": "Phone verified"}


@app.post("/api/login")
def login(data: LoginIn, response: Response, session: Session = Depends(get_session)):
    user = session.exec(
        select(User).where((User.email == data.identifier) | (User.phone == data.identifier))
    ).first()
    if not user or not pwd_ctx.verify(data.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not (user.email_verified and user.phone_verified):
        raise HTTPException(403, "Verify email and phone first")

    token = make_token(user.id)
    response.set_cookie(
        "access_token", token,
        httponly=True, samesite="lax",
        secure=COOKIE_SECURE,
        max_age=TOKEN_DAYS * 86400, path="/",
    )
    return {"user": user_dict(user, session)}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@app.get("/api/me")
def me(user: User = Depends(current_user), session: Session = Depends(get_session)):
    return user_dict(user, session)


@app.post("/api/resend/email-otp")
def resend_email(data: ResendIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == data.identifier)).first()
    if not user:
        raise HTTPException(404, "User not found")
    otp = gen_otp()
    redis_client.setex(f"email_otp:{user.email}", OTP_TTL, otp)
    send_email_otp(user.email, otp)
    return {"message": "Email OTP sent"}


@app.post("/api/resend/phone-otp")
async def resend_phone(data: ResendIn, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.phone == data.identifier)).first()
    if not user:
        raise HTTPException(404, "User not found")
    await telnyx_send_sms_otp(user.phone)
    return {"message": "SMS OTP sent"}


# ---------------- Wallet / Topup ----------------
@app.get("/api/wallet")
def get_wallet(user: User = Depends(current_user), session: Session = Depends(get_session)):
    txs = session.exec(
        select(WalletTx).where(WalletTx.user_id == user.id)
        .order_by(WalletTx.created_at.desc()).limit(100)
    ).all()
    return {
        "balance_usd": round(user.balance_usd, 2),
        "transactions": [
            {
                "id": t.id,
                "type": t.type,
                "amount_usd": round(t.amount_usd, 4),
                "description": t.description,
                "created_at": t.created_at.isoformat(),
            } for t in txs
        ],
    }


@app.post("/api/topup/create")
def topup_create(data: TopupCreateIn, user: User = Depends(current_user),
                 session: Session = Depends(get_session)):
    if data.amount_usd < 1 or data.amount_usd > 1000:
        raise HTTPException(400, "Amount must be between $1 and $1000")

    ref = secrets.token_urlsafe(24)
    topup = Topup(user_id=user.id, reference_id=ref, amount_usd=data.amount_usd)
    session.add(topup)
    session.commit()

    qs = urlencode({
        "ref": ref,
        "amount": f"{data.amount_usd:.2f}",
        "currency": "USD",
        "return": f"{FRONTEND_ORIGIN}/#/wallet?topup={ref}",
    })
    return {"redirect_url": f"{PARENT_GATEWAY_URL}?{qs}", "reference_id": ref}


@app.post("/api/topup/webhook")
async def topup_webhook(
    data: TopupWebhookIn,
    x_signature: Optional[str] = Header(default=None),
    session: Session = Depends(get_session),
):
    if PARENT_WEBHOOK_SECRET:
        expected = hmac.new(
            PARENT_WEBHOOK_SECRET.encode(),
            f"{data.reference_id}:{data.amount_usd}:{data.status}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not x_signature or not hmac.compare_digest(expected, x_signature):
            raise HTTPException(401, "Invalid signature")

    topup = session.exec(
        select(Topup).where(Topup.reference_id == data.reference_id)
    ).first()
    if not topup:
        raise HTTPException(404, "Topup not found")
    if topup.status == "paid":
        return {"message": "Already processed"}

    topup.parent_txn_id = data.parent_txn_id
    if data.status == "paid":
        topup.status = "paid"
        topup.paid_at = datetime.utcnow()
        user = session.get(User, topup.user_id)
        credit_wallet(
            session, user, topup.amount_usd, "topup",
            f"Top-up ${topup.amount_usd:.2f}", topup.reference_id,
        )
    else:
        topup.status = "failed"

    session.add(topup)
    session.commit()
    return {"message": "OK"}


@app.get("/api/topup/status/{reference_id}")
def topup_status(reference_id: str, user: User = Depends(current_user),
                 session: Session = Depends(get_session)):
    t = session.exec(
        select(Topup).where(
            Topup.reference_id == reference_id, Topup.user_id == user.id
        )
    ).first()
    if not t:
        raise HTTPException(404, "Not found")
    return {"status": t.status, "amount_usd": t.amount_usd}


# ---------------- Pricing (public read) ----------------
@app.get("/api/pricing")
def list_pricing(session: Session = Depends(get_session)):
    rows = session.exec(select(Pricing).where(Pricing.enabled == True)).all()
    return [
        {
            "country_code": p.country_code,
            "number_type": p.number_type,
            "rental_usd": p.rental_usd,
            "inbound_call_per_min": p.inbound_call_per_min,
            "outbound_call_per_min": p.outbound_call_per_min,
            "inbound_sms": p.inbound_sms,
            "outbound_sms": p.outbound_sms,
            "voicemail_per_min": p.voicemail_per_min,
        } for p in rows
    ]


# ---------------- Admin pricing CRUD ----------------
@app.get("/api/admin/pricing")
def admin_list_pricing(_: User = Depends(admin_only),
                       session: Session = Depends(get_session)):
    return session.exec(
        select(Pricing).order_by(Pricing.country_code, Pricing.number_type)
    ).all()


@app.post("/api/admin/pricing")
def admin_upsert_pricing(data: PricingIn, _: User = Depends(admin_only),
                         session: Session = Depends(get_session)):
    row = session.exec(
        select(Pricing).where(
            Pricing.country_code == data.country_code,
            Pricing.number_type == data.number_type,
        )
    ).first()
    if not row:
        row = Pricing(country_code=data.country_code, number_type=data.number_type)
    for k, v in data.dict().items():
        setattr(row, k, v)
    row.updated_at = datetime.utcnow()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


@app.delete("/api/admin/pricing/{pricing_id}")
def admin_delete_pricing(pricing_id: int, _: User = Depends(admin_only),
                         session: Session = Depends(get_session)):
    row = session.get(Pricing, pricing_id)
    if not row:
        raise HTTPException(404, "Not found")
    session.delete(row)
    session.commit()
    return {"message": "Deleted"}


# ---------------- Static frontend ----------------
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")
