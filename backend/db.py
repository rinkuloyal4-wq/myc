from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Session, create_engine
from dotenv import load_dotenv
import os

load_dotenv()

engine = create_engine(os.getenv("DATABASE_URL"), echo=False, pool_pre_ping=True)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    phone: str = Field(index=True, unique=True)
    password_hash: str
    email_verified: bool = False
    phone_verified: bool = False
    is_admin: bool = False
    is_active: bool = True
    balance_usd: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Topup(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")
    reference_id: str = Field(index=True, unique=True)
    amount_usd: float
    status: str = "pending"          # pending | paid | failed | expired
    parent_txn_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    paid_at: Optional[datetime] = None


class WalletTx(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")
    type: str                        # topup | number_purchase | call | sms | voicemail | renewal | refund
    amount_usd: float                # positive = credit, negative = debit
    description: str
    reference: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Pricing(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    country_code: str = Field(index=True)
    number_type: str = Field(index=True)
    enabled: bool = True
    rental_usd: float = 0.0
    inbound_call_per_min: float = 0.0
    outbound_call_per_min: float = 0.0
    inbound_sms: float = 0.0
    outbound_sms: float = 0.0
    voicemail_per_min: float = 0.0
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Number(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")
    phone_number: str = Field(index=True, unique=True)
    country_code: str
    number_type: str
    telnyx_number_id: Optional[str] = None
    status: str = "active"           # active | released
    renew_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
