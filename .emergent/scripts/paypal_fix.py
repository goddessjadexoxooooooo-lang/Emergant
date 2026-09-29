import sys, pathlib

BE = pathlib.Path("/app/backend/server.py")
FE = pathlib.Path("/app/frontend/src/pages/TributeFlow.jsx")
src = BE.read_text(encoding="utf-8")
orig = src
fails = []

# 1. drop the dead PayPal Orders v2 block
s = src.find("# ---- PayPal Orders v2 (server-verified capture) ----")
e = src.find('@api_router.get("/tributes/me")')
if s != -1 and e != -1 and e > s:
    src = src[:s] + src[e:]
    print("OK   removed dead PayPal Orders v2 block")
else:
    print("SKIP PayPal Orders block already gone")

# 2. helpers
HELP = '''def _initials(name: str) -> str:
    parts = [p for p in (name or "").split() if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[-1][0]).upper()


async def _open_payment_request(user: dict, amount: float, frequency, method: str, kind: str, tribute_id=None):
    """Create a pending payment-confirmation card on the creator Requests screen."""
    await db.creator_requests.update_many(
        {"user_id": user["id"], "kind": kind, "status": "pending"},
        {"$set": {"status": "superseded"}},
    )
    label = frequency or "one-time"
    who = user.get("name") or user.get("email") or "Member"
    await db.creator_requests.insert_one({
        "id": f"req_pay_{uuid.uuid4().hex[:10]}",
        "name": who,
        "initials": _initials(who),
        "plan_name": f"${amount:.2f} {label} via {method} - confirm payment received",
        "status": "pending",
        "sort": 100,
        "kind": kind,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "amount": amount,
        "frequency": frequency,
        "method": method,
        "tribute_id": tribute_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


'''
ANCHOR = "async def build_membership(user_id: str):"
if "_open_payment_request" not in src:
    src = src.replace(ANCHOR, HELP + ANCHOR, 1)
    print("OK   inserted helpers")

# 3. membership/setup -> pending
OLD = '''    now = datetime.now(timezone.utc)
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
    return {"membership": await build_membership(user["id"])}'''
NEW = '''    now = datetime.now(timezone.utc)
    amount = round(body.amount, 2)
    doc = {
        "user_id": user["id"],
        "amount": amount,
        "frequency": body.frequency,
        "method": body.method,
        "active": False,
        "awaiting_confirmation": True,
        "created_at": now.isoformat(),
        "next_tribute_date": next_date_from(now, body.frequency),
    }
    await db.memberships.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    await _open_payment_request(user, amount, body.frequency, body.method, "membership")
    return {"membership": await build_membership(user["id"]), "awaiting_confirmation": True}'''
if OLD in src:
    src = src.replace(OLD, NEW, 1); print("OK   membership/setup -> PENDING")
else:
    fails.append("membership/setup")

# 4. self-report -> pending
OLD = '''        "method": body.method,
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
    return {"tribute": tribute, "membership": await build_membership(user["id"])}'''
NEW = '''        "method": body.method,
        "status": "pending",
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
    })
    # The next tribute date only advances once the creator confirms the payment.
    await _open_payment_request(user, round(body.amount, 2), None, body.method, "tribute", tribute["id"])
    return {"tribute": tribute, "membership": await build_membership(user["id"]), "awaiting_confirmation": True}'''
if OLD in src:
    src = src.replace(OLD, NEW, 1); print("OK   self-report -> PENDING")
else:
    fails.append("self-report")

# 5. approve/decline settles the payment
OLD = '''    status = "approved" if action == "approve" else "declined"
    res = await db.creator_requests.update_one({"id": req_id}, {"$set": {"status": status}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")'''
NEW = '''    status = "approved" if action == "approve" else "declined"
    req = await db.creator_requests.find_one({"id": req_id})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    await db.creator_requests.update_one({"id": req_id}, {"$set": {"status": status}})

    # A payment-confirmation card settles the membership / tribute it points at.
    if req.get("user_id") and req.get("kind"):
        now = datetime.now(timezone.utc)
        if req["kind"] == "membership":
            if action == "approve":
                await db.memberships.update_one(
                    {"user_id": req["user_id"]},
                    {"$set": {"active": True, "awaiting_confirmation": False,
                              "confirmed_at": now.isoformat(),
                              "next_tribute_date": next_date_from(now, req.get("frequency") or "monthly")}},
                )
            else:
                await db.memberships.update_one(
                    {"user_id": req["user_id"]},
                    {"$set": {"active": False, "awaiting_confirmation": False}},
                )
        elif req["kind"] == "tribute" and req.get("tribute_id"):
            await db.tributes.update_one(
                {"id": req["tribute_id"]},
                {"$set": {"status": "confirmed" if action == "approve" else "declined"}},
            )
            if action == "approve":
                m = await db.memberships.find_one({"user_id": req["user_id"]})
                if m and m.get("active"):
                    await db.memberships.update_one(
                        {"user_id": req["user_id"]},
                        {"$set": {"next_tribute_date": next_date_from(now, m.get("frequency", "monthly"))}},
                    )'''
if OLD in src:
    src = src.replace(OLD, NEW, 1); print("OK   approve/decline settles payment")
else:
    fails.append("request-action")

if fails:
    print("FAILED PATTERNS:", fails); sys.exit(1)
if src != orig:
    BE.write_text(src, encoding="utf-8"); print("WROTE server.py")

# 6. frontend: stop claiming success
f = FE.read_text(encoding="utf-8"); fo = f
OLD = '''        await api.post("/membership/setup", { amount, frequency, method: methodKey });
        toast.success("Your devotion has begun. \U0001f5a4");
        navigate("/dashboard");'''
NEW = '''        await api.post("/membership/setup", { amount, frequency, method: methodKey });
        setDone({ amount, frequency });'''
if OLD in f:
    f = f.replace(OLD, NEW, 1); print("OK   membership no longer jumps to dashboard as paid")
else:
    print("WARN membership pay-branch not matched")

OLD = '''          <h1 className="mt-8 font-display text-4xl font-bold">Tribute received</h1>
          <p className="mt-3 text-lg text-muted-foreground">Thank you for your ${done.amount.toFixed(2)} tribute to your Goddess.</p>'''
NEW = '''          <h1 className="mt-8 font-display text-4xl font-bold">Almost there</h1>
          <p className="mt-3 text-lg text-muted-foreground">Please finish your ${done.amount.toFixed(2)} payment in the PayPal tab that just opened. Your Goddess will confirm it, and your membership starts the moment she does.</p>'''
if OLD in f:
    f = f.replace(OLD, NEW, 1); print("OK   success screen no longer claims money arrived")
else:
    print("WARN done-screen not matched")

if f != fo:
    FE.write_text(f, encoding="utf-8"); print("WROTE TributeFlow.jsx")
print("PATCH COMPLETE")
