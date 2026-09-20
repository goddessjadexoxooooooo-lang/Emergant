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
    total = sum(t["amount"] for t in items if t.get("status") in ("completed", "active"))
    active = next((t for t in items if t["type"] == "recurring" and t["status"] == "active"), None)
    return {"tributes": items, "total_contributed": round(total, 2), "active_membership": active}


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
        if t.get("status") in ("completed", "active"):
            agg["total"] += t["amount"]
        if t["type"] == "recurring" and t["status"] == "active":
            agg["active"] = True
    for u in users:
        agg = by_user.get(u["id"], {"total": 0.0, "count": 0, "active": False})
        u["total_contributed"] = round(agg["total"], 2)
        u["tribute_count"] = agg["count"]
        u["is_active_member"] = agg["active"]
    return {"members": users}


@api_router.get("/admin/tributes")
async def admin_tributes(admin: dict = Depends(require_admin)):
    items = await db.tributes.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)
    return {"tributes": items}


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    tributes = await db.tributes.find({}, {"_id": 0}).to_list(5000)
    total_members = await db.users.count_documents({"role": "member"})
    total_revenue = sum(t["amount"] for t in tributes if t.get("status") in ("completed", "active"))
    active_subs = sum(1 for t in tributes if t["type"] == "recurring" and t["status"] == "active")
    one_time = sum(1 for t in tributes if t["type"] == "one-time")
    return {
        "total_members": total_members,
        "total_revenue": round(total_revenue, 2),
        "active_subscriptions": active_subs,
        "one_time_tributes": one_time,
        "total_tributes": len(tributes),
    }


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


@app.on_event("shutdown")
async def shutdown():
    client.close()
