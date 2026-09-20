from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# ---------------------------------------------------------------------------
# Config & DB
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

PAYPAL_BASE_URL = os.environ['PAYPAL_BASE_URL']
PAYPAL_CLIENT_ID = os.environ['PAYPAL_CLIENT_ID']
PAYPAL_SECRET = os.environ['PAYPAL_SECRET']

EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("jade")

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=True,
        samesite="none", max_age=604800, path="/",
    )


def public_user(doc: dict) -> dict:
    return {
        "id": doc["id"], "email": doc["email"], "name": doc.get("name", ""),
        "role": doc.get("role", "member"), "picture": doc.get("picture"),
        "provider": doc.get("provider", "password"),
    }


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------------------------------------------------------------------
# PayPal helpers
# ---------------------------------------------------------------------------
FREQUENCY_MAP = {
    "weekly": ("WEEK", 1),
    "monthly": ("MONTH", 1),
    "yearly": ("YEAR", 1),
}


async def paypal_token() -> str:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{PAYPAL_BASE_URL}/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
            data={"grant_type": "client_credentials"},
            headers={"Accept": "application/json"},
        )
    if r.status_code != 200:
        logger.error("PayPal token error: %s", r.text)
        raise HTTPException(status_code=502, detail="PayPal auth failed")
    return r.json()["access_token"]


async def paypal_request(method: str, path: str, token: str, json_body=None):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.request(
            method, f"{PAYPAL_BASE_URL}{path}", json=json_body,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if r.status_code >= 400:
        logger.error("PayPal %s %s -> %s %s", method, path, r.status_code, r.text)
        raise HTTPException(status_code=502, detail="PayPal request failed")
    return r.json() if r.text else {}


async def get_or_create_product(token: str) -> str:
    existing = await db.paypal_config.find_one({"key": "product_id"})
    if existing:
        return existing["value"]
    data = await paypal_request("POST", "/v1/catalogs/products", token, {
        "name": "Jade Dynasty Tribute",
        "description": "Recurring tribute to the Jade Dynasty",
        "type": "SERVICE",
        "category": "MEMBERSHIP_CLUBS_AND_ORGANIZATIONS",
    })
    pid = data["id"]
    await db.paypal_config.insert_one({"key": "product_id", "value": pid})
    return pid


async def get_or_create_plan(amount: float, frequency: str) -> str:
    if frequency not in FREQUENCY_MAP:
        raise HTTPException(status_code=400, detail="Invalid frequency")
    amount_str = f"{amount:.2f}"
    cache = await db.paypal_plans.find_one({"amount": amount_str, "frequency": frequency})
    if cache:
        return cache["plan_id"]
    token = await paypal_token()
    product_id = await get_or_create_product(token)
    unit, count = FREQUENCY_MAP[frequency]
    data = await paypal_request("POST", "/v1/billing/plans", token, {
        "product_id": product_id,
        "name": f"Jade Tribute {amount_str} {frequency}",
        "billing_cycles": [{
            "frequency": {"interval_unit": unit, "interval_count": count},
            "tenure_type": "REGULAR", "sequence": 1, "total_cycles": 0,
            "pricing_scheme": {"fixed_price": {"value": amount_str, "currency_code": "USD"}},
        }],
        "payment_preferences": {
            "auto_bill_outstanding": True,
            "setup_fee": {"value": "0", "currency_code": "USD"},
            "setup_fee_failure_action": "CONTINUE",
            "payment_failure_threshold": 3,
        },
    })
    plan_id = data["id"]
    await db.paypal_plans.insert_one({"amount": amount_str, "frequency": frequency, "plan_id": plan_id})
    return plan_id


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SessionBody(BaseModel):
    session_id: str


class CreateOrderBody(BaseModel):
    amount: float


class CaptureOrderBody(BaseModel):
    order_id: str
    amount: float
    guest_name: str | None = None
    guest_email: str | None = None


class CreatePlanBody(BaseModel):
    amount: float
    frequency: str


class RecordSubBody(BaseModel):
    subscription_id: str
    amount: float
    frequency: str


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(body: RegisterBody, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user = {
        "id": f"user_{uuid.uuid4().hex[:12]}",
        "name": body.name, "email": email,
        "password_hash": hash_password(body.password),
        "role": "member", "provider": "password",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], email, "member")
    set_auth_cookie(response, token)
    return {"user": public_user(user), "token": token}


@api_router.post("/auth/login")
async def login(body: LoginBody, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email, user.get("role", "member"))
    set_auth_cookie(response, token)
    return {"user": public_user(user), "token": token}


@api_router.post("/auth/session")
async def google_session(body: SessionBody, response: Response):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "id": f"user_{uuid.uuid4().hex[:12]}",
            "name": data.get("name", email), "email": email,
            "role": "member", "provider": "google",
            "picture": data.get("picture"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({"id": user["id"]}, {"$set": {"picture": data.get("picture")}})
        user["picture"] = data.get("picture")
    token = create_access_token(user["id"], email, user.get("role", "member"))
    set_auth_cookie(response, token)
    return {"user": public_user(user), "token": token}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


# ---------------------------------------------------------------------------
# PayPal / Tribute routes
# ---------------------------------------------------------------------------
async def optional_user(request: Request):
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


async def record_tribute(doc: dict):
    doc.setdefault("id", f"trib_{uuid.uuid4().hex[:12]}")
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.tributes.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.post("/paypal/create-order")
async def create_order(body: CreateOrderBody):
    token = await paypal_token()
    data = await paypal_request("POST", "/v2/checkout/orders", token, {
        "intent": "CAPTURE",
        "purchase_units": [{
            "amount": {"currency_code": "USD", "value": f"{body.amount:.2f}"},
            "description": "One-time tribute to Jade & Co.",
        }],
    })
    return {"id": data["id"]}


@api_router.post("/paypal/capture-order")
async def capture_order(body: CaptureOrderBody, request: Request):
    token = await paypal_token()
    data = await paypal_request("POST", f"/v2/checkout/orders/{body.order_id}/capture", token)
    status = data.get("status", "UNKNOWN")
    user = await optional_user(request)
    tribute = await record_tribute({
        "type": "one-time",
        "amount": round(body.amount, 2),
        "currency": "USD",
        "frequency": None,
        "status": "completed" if status == "COMPLETED" else status.lower(),
        "paypal_order_id": body.order_id,
        "user_id": user["id"] if user else None,
        "user_email": user["email"] if user else (body.guest_email or "guest"),
        "user_name": user["name"] if user else (body.guest_name or "Guest Tribute"),
    })
    return {"status": status, "tribute": tribute}


@api_router.post("/paypal/create-plan")
async def create_plan(body: CreatePlanBody, user: dict = Depends(get_current_user)):
    plan_id = await get_or_create_plan(body.amount, body.frequency)
    return {"plan_id": plan_id}


@api_router.post("/paypal/record-subscription")
async def record_subscription(body: RecordSubBody, user: dict = Depends(get_current_user)):
    # deactivate previous active subscriptions for this user
    await db.tributes.update_many(
        {"user_id": user["id"], "type": "recurring", "status": "active"},
        {"$set": {"status": "replaced"}},
    )
    tribute = await record_tribute({
        "type": "recurring",
        "amount": round(body.amount, 2),
        "currency": "USD",
        "frequency": body.frequency,
        "status": "active",
        "paypal_subscription_id": body.subscription_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
    })
    return {"tribute": tribute}


@api_router.get("/tributes/me")
async def my_tributes(user: dict = Depends(get_current_user)):
    items = await db.tributes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total = sum(t["amount"] for t in items if t.get("status") in ("completed", "active", "confirmed"))
    active = next((t for t in items if t["type"] == "recurring" and t["status"] == "active"), None)
    return {"tributes": items, "total_contributed": round(total, 2), "active_membership": active}


# ---------------------------------------------------------------------------
# Membership (self-reported tribute model)
# ---------------------------------------------------------------------------
FREQ_DAYS = {"weekly": 7, "bi-weekly": 14, "biweekly": 14, "monthly": 30, "yearly": 365}


def compute_tier(amount: float) -> str:
    if amount >= 250:
        return "Diamond"
    if amount >= 100:
        return "Gold"
    if amount >= 50:
        return "Silver"
    if amount >= 25:
        return "Bronze"
    return "Initiate"


def next_date_from(start: datetime, frequency: str) -> str:
    return (start + timedelta(days=FREQ_DAYS.get(frequency, 30))).isoformat()


class MembershipSetupBody(BaseModel):
    amount: float
    frequency: str
    method: str


class SelfReportBody(BaseModel):
    amount: float
    method: str


async def build_membership(user_id: str):
    m = await db.memberships.find_one({"user_id": user_id}, {"_id": 0})
    if not m or not m.get("active"):
        return None
    now = datetime.now(timezone.utc)
    nxt = m.get("next_tribute_date")
    try:
        nxt_dt = datetime.fromisoformat(nxt) if nxt else now
        if nxt_dt.tzinfo is None:
            nxt_dt = nxt_dt.replace(tzinfo=timezone.utc)
    except Exception:
        nxt_dt = now
    days_until = (nxt_dt - now).days
    return {
        "amount": m["amount"],
        "frequency": m["frequency"],
        "method": m["method"],
        "tier": compute_tier(m["amount"]),
        "active": True,
        "next_tribute_date": m.get("next_tribute_date"),
        "days_until": days_until,
        "is_due": days_until <= 0,
        "created_at": m.get("created_at"),
    }


@api_router.get("/membership/me")
async def membership_me(user: dict = Depends(get_current_user)):
    membership = await build_membership(user["id"])
    items = await db.tributes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    total = sum(t["amount"] for t in items if t.get("status") in ("completed", "active", "confirmed"))
    return {"membership": membership, "history": items, "total_contributed": round(total, 2)}


@api_router.post("/membership/setup")
async def membership_setup(body: MembershipSetupBody, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user["id"],
        "amount": round(body.amount, 2),
        "frequency": body.frequency,
        "method": body.method,
        "active": True,
        "created_at": now.isoformat(),
        "next_tribute_date": next_date_from(now, body.frequency),
    }
    await db.memberships.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"membership": await build_membership(user["id"])}


@api_router.post("/membership/cancel")
async def membership_cancel(user: dict = Depends(get_current_user)):
    await db.memberships.update_one({"user_id": user["id"]}, {"$set": {"active": False}})
    return {"ok": True}


@api_router.post("/tributes/self-report")
async def self_report(body: SelfReportBody, user: dict = Depends(get_current_user)):
    tribute = await record_tribute({
        "type": "self-report",
        "amount": round(body.amount, 2),
        "currency": "USD",
        "frequency": None,
        "method": body.method,
        "status": "confirmed",
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
    })
    # advance next tribute date on the membership
    m = await db.memberships.find_one({"user_id": user["id"]})
    if m and m.get("active"):
        now = datetime.now(timezone.utc)
        await db.memberships.update_one(
            {"user_id": user["id"]},
            {"$set": {"next_tribute_date": next_date_from(now, m.get("frequency", "monthly"))}},
        )
    return {"tribute": tribute, "membership": await build_membership(user["id"])}


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------
@api_router.get("/admin/members")
async def admin_members(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    tributes = await db.tributes.find({}, {"_id": 0}).to_list(5000)
    by_user = {}
    for t in tributes:
        uid = t.get("user_id")
        if not uid:
            continue
        agg = by_user.setdefault(uid, {"total": 0.0, "count": 0, "active": False})
        agg["count"] += 1
        if t.get("status") in ("completed", "active", "confirmed"):
            agg["total"] += t["amount"]
        if t["type"] == "recurring" and t["status"] == "active":
            agg["active"] = True
    active_ids = {m["user_id"] async for m in db.memberships.find({"active": True}, {"user_id": 1})}
    for u in users:
        agg = by_user.get(u["id"], {"total": 0.0, "count": 0, "active": False})
        u["total_contributed"] = round(agg["total"], 2)
        u["tribute_count"] = agg["count"]
        u["is_active_member"] = agg["active"] or (u["id"] in active_ids)
    return {"members": users}


@api_router.get("/admin/tributes")
async def admin_tributes(admin: dict = Depends(require_admin)):
    items = await db.tributes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"tributes": items}


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    tributes = await db.tributes.find({}, {"_id": 0}).to_list(5000)
    total_members = await db.users.count_documents({"role": "member"})
    total_revenue = sum(t["amount"] for t in tributes if t.get("status") in ("completed", "active", "confirmed"))
    active_subs = await db.memberships.count_documents({"active": True})
    one_time = sum(1 for t in tributes if t["type"] in ("one-time", "self-report"))
    return {
        "total_members": total_members,
        "total_revenue": round(total_revenue, 2),
        "active_subscriptions": active_subs,
        "one_time_tributes": one_time,
        "total_tributes": len(tributes),
    }


# ---------------------------------------------------------------------------
# Creator (DOM / Goddess) side
# ---------------------------------------------------------------------------
SEED_PLANS = [
    {"id": "plan_cycle", "name": "The Jade Cycle", "price": 50, "subscribers": 28, "cadence": "Every 2 weeks", "icon": "leaf"},
    {"id": "plan_plan", "name": "The Jade Plan", "price": 150, "subscribers": 41, "cadence": "Monthly", "icon": "crown"},
    {"id": "plan_edition", "name": "The Edition", "price": 200, "subscribers": 12, "cadence": "Special tribute", "icon": "diamond"},
]

SEED_SUBSCRIBERS = [
    {"id": "sub_mr", "name": "Marcus R.", "initials": "MR", "handle": "@devoted_m", "plan_name": "The Jade Plan", "amount": 150, "status": "paid", "reminder_group": "due_4_7", "due_text": "due in 26d", "sort": 0},
    {"id": "sub_et", "name": "Ellis T.", "initials": "ET", "handle": "@ellis.t", "plan_name": "The Jade Cycle", "amount": 50, "status": "due", "reminder_group": "due_1_3", "due_text": "due in 2d", "sort": 1},
    {"id": "sub_kn", "name": "Kai N.", "initials": "KN", "handle": "@kaisubmits", "plan_name": "The Edition", "amount": 200, "status": "overdue", "reminder_group": "overdue", "due_text": "4d overdue", "sort": 2},
    {"id": "sub_dw", "name": "Dominic W.", "initials": "DW", "handle": "@dominic.w", "plan_name": "The Jade Plan", "amount": 150, "status": "paid", "reminder_group": "due_4_7", "due_text": "due in 18d", "sort": 3},
    {"id": "sub_tb", "name": "Theo B.", "initials": "TB", "handle": "@theo_serves", "plan_name": "The Jade Cycle", "amount": 50, "status": "due", "reminder_group": "due_1_3", "due_text": "due in 5d", "sort": 4},
    {"id": "sub_rp", "name": "Rowan P.", "initials": "RP", "handle": "@rowan.p", "plan_name": "The Jade Cycle", "amount": 50, "status": "overdue", "reminder_group": "overdue", "due_text": "11d overdue", "sort": 5},
    {"id": "sub_sh", "name": "Silas H.", "initials": "SH", "handle": "@silas.h", "plan_name": "The Edition", "amount": 200, "status": "paid", "reminder_group": "due_4_7", "due_text": "due in 30d", "sort": 6},
]

SEED_PAYMENTS = [
    {"id": "pay_1", "name": "Marcus R.", "method": "PayPal", "when": "2h ago", "amount": 150, "sort": 0},
    {"id": "pay_2", "name": "Silas H.", "method": "Cash App", "when": "9h ago", "amount": 200, "sort": 1},
    {"id": "pay_3", "name": "Dominic W.", "method": "Venmo", "when": "Yesterday", "amount": 150, "sort": 2},
    {"id": "pay_4", "name": "Ava L.", "method": "YouPay", "when": "Yesterday", "amount": 25, "sort": 3},
    {"id": "pay_5", "name": "Theo B.", "method": "Throne", "when": "2d ago", "amount": 50, "sort": 4},
]

SEED_INBOX = [
    {"id": "msg_1", "name": "Marcus R.", "initials": "MR", "text": "Thank you Goddess, tribute sent 🙏", "when": "2h ago"},
    {"id": "msg_2", "name": "Theo B.", "initials": "TB", "text": "May I have permission to serve more?", "when": "5h ago"},
    {"id": "msg_3", "name": "Kai N.", "initials": "KN", "text": "I'm sorry for being late, Goddess. It won't happen again.", "when": "1d ago"},
]

SEED_REQUESTS = [
    {"id": "req_mr", "name": "Marcus R.", "initials": "MR", "plan_name": "The Jade Plan", "status": "pending", "sort": 0},
    {"id": "req_et", "name": "Ellis T.", "initials": "ET", "plan_name": "The Jade Cycle", "status": "pending", "sort": 1},
    {"id": "req_kn", "name": "Kai N.", "initials": "KN", "plan_name": "The Edition", "status": "pending", "sort": 2},
]


async def seed_creator():
    if await db.creator_plans.count_documents({}) == 0:
        await db.creator_plans.insert_many([dict(p) for p in SEED_PLANS])
    if await db.creator_subscribers.count_documents({}) == 0:
        await db.creator_subscribers.insert_many([dict(s) for s in SEED_SUBSCRIBERS])
    if await db.creator_payments.count_documents({}) == 0:
        await db.creator_payments.insert_many([dict(p) for p in SEED_PAYMENTS])
    if await db.creator_inbox.count_documents({}) == 0:
        await db.creator_inbox.insert_many([dict(m) for m in SEED_INBOX])
    if await db.creator_requests.count_documents({}) == 0:
        await db.creator_requests.insert_many([dict(r) for r in SEED_REQUESTS])
    # backfill handles for existing subscriber docs
    for s in SEED_SUBSCRIBERS:
        await db.creator_subscribers.update_one(
            {"id": s["id"], "handle": {"$exists": False}}, {"$set": {"handle": s["handle"]}}
        )


class StatusBody(BaseModel):
    status: str


class OverrideBody(BaseModel):
    action: str
    reason: str


class PlanPriceBody(BaseModel):
    price: float


@api_router.get("/creator/home")
async def creator_home(admin: dict = Depends(require_admin)):
    plans = await db.creator_plans.find({}, {"_id": 0}).to_list(50)
    payments = await db.creator_payments.find({}, {"_id": 0}).sort("sort", 1).to_list(50)
    active = await db.creator_subscribers.count_documents({})
    pending = await db.creator_requests.count_documents({"status": "pending"})
    revenue = sum(p["amount"] for p in payments)
    return {
        "stats": {"active_subscribers": active, "payments_this_week": len(payments)},
        "revenue_total": revenue,
        "pending_requests": pending,
        "recent_payments": payments,
        "plans": plans,
        "plans_active": len(plans),
    }


@api_router.get("/creator/requests")
async def creator_requests(admin: dict = Depends(require_admin)):
    reqs = await db.creator_requests.find({"status": "pending"}, {"_id": 0}).sort("sort", 1).to_list(100)
    return {"requests": reqs}


@api_router.post("/creator/requests/{req_id}/{action}")
async def creator_request_action(req_id: str, action: str, admin: dict = Depends(require_admin)):
    if action not in ("approve", "decline"):
        raise HTTPException(status_code=400, detail="Invalid action")
    status = "approved" if action == "approve" else "declined"
    res = await db.creator_requests.update_one({"id": req_id}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    remaining = await db.creator_requests.count_documents({"status": "pending"})
    return {"ok": True, "status": status, "pending": remaining}


@api_router.get("/creator/subscribers")
async def creator_subscribers(admin: dict = Depends(require_admin)):
    subs = await db.creator_subscribers.find({}, {"_id": 0}).sort("sort", 1).to_list(200)
    missed = await db.creator_subscribers.count_documents({"status": "overdue"})
    return {"subscribers": subs, "missed_count": missed}


@api_router.get("/creator/reminders")
async def creator_reminders(admin: dict = Depends(require_admin)):
    subs = await db.creator_subscribers.find({}, {"_id": 0}).sort("sort", 1).to_list(200)
    groups = {"due_1_3": [], "due_4_7": [], "overdue": []}
    for s in subs:
        g = s.get("reminder_group")
        if g in groups:
            groups[g].append(s)
    due_this_week = sum(s["amount"] for s in groups["due_1_3"]) + sum(s["amount"] for s in groups["overdue"])
    return {"due_this_week_total": due_this_week, **groups}


@api_router.get("/creator/inbox")
async def creator_inbox(admin: dict = Depends(require_admin)):
    msgs = await db.creator_inbox.find({}, {"_id": 0}).to_list(100)
    return {"messages": msgs}


@api_router.post("/creator/subscribers/{sub_id}/remind")
async def creator_remind_one(sub_id: str, admin: dict = Depends(require_admin)):
    sub = await db.creator_subscribers.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    await db.creator_subscribers.update_one({"id": sub_id}, {"$set": {"last_reminded": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "message": f"Reminder sent to {sub['name']}"}


@api_router.post("/creator/subscribers/{sub_id}/status")
async def creator_set_status(sub_id: str, body: StatusBody, admin: dict = Depends(require_admin)):
    if body.status not in ("paid", "due", "overdue"):
        raise HTTPException(status_code=400, detail="Invalid status")
    res = await db.creator_subscribers.update_one({"id": sub_id}, {"$set": {"status": body.status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    sub = await db.creator_subscribers.find_one({"id": sub_id}, {"_id": 0})
    return {"subscriber": sub}


@api_router.post("/creator/subscribers/{sub_id}/override")
async def creator_override(sub_id: str, body: OverrideBody, admin: dict = Depends(require_admin)):
    ACTIONS = {
        "restore_access": ("paid", "Access restored"),
        "approve_payment_plan": ("paid", "Payment plan approved"),
        "suspend_account": ("overdue", "Account suspended"),
        "terminate_account": (None, "Account terminated"),
    }
    if body.action not in ACTIONS:
        raise HTTPException(status_code=400, detail="Invalid action")
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="A reason is required")
    sub = await db.creator_subscribers.find_one({"id": sub_id}, {"_id": 0})
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    new_status, verb = ACTIONS[body.action]
    await db.creator_overrides.insert_one({
        "sub_id": sub_id, "action": body.action, "reason": body.reason.strip(),
        "at": datetime.now(timezone.utc).isoformat(),
    })
    if body.action == "terminate_account":
        await db.creator_subscribers.delete_one({"id": sub_id})
    else:
        await db.creator_subscribers.update_one({"id": sub_id}, {"$set": {"status": new_status}})
    return {"ok": True, "message": f"{verb} for {sub['name']}"}


@api_router.post("/creator/remind-group/{group}")
async def creator_remind_group(group: str, admin: dict = Depends(require_admin)):
    if group == "week":
        q = {"reminder_group": {"$in": ["due_1_3", "overdue"]}}
    elif group == "overdue":
        q = {"reminder_group": "overdue"}
    else:
        q = {"reminder_group": group}
    n = await db.creator_subscribers.count_documents(q)
    await db.creator_subscribers.update_many(q, {"$set": {"last_reminded": datetime.now(timezone.utc).isoformat()}})
    return {"reminded": n}


@api_router.post("/creator/mark-all-unpaid")
async def creator_mark_all_unpaid(admin: dict = Depends(require_admin)):
    res = await db.creator_subscribers.update_many({}, {"$set": {"status": "due"}})
    return {"updated": res.modified_count}


@api_router.post("/creator/message-all")
async def creator_message_all(admin: dict = Depends(require_admin)):
    n = await db.creator_subscribers.count_documents({})
    return {"ok": True, "sent": n}


@api_router.patch("/creator/plans/{plan_id}")
async def creator_update_plan(plan_id: str, body: PlanPriceBody, admin: dict = Depends(require_admin)):
    res = await db.creator_plans.update_one({"id": plan_id}, {"$set": {"price": round(body.price, 2)}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan = await db.creator_plans.find_one({"id": plan_id}, {"_id": 0})
    return {"plan": plan}


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api_router)

allowed_origins = list({FRONTEND_URL, "http://localhost:3000"})
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id")
    await db.tributes.create_index("user_id")
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": f"user_{uuid.uuid4().hex[:12]}",
            "name": "Jade Admin", "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin", "provider": "password",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded admin user %s", admin_email)
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
    await seed_creator()


@app.on_event("shutdown")
async def shutdown():
    client.close()
