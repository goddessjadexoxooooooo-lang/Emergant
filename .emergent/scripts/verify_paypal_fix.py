import json, urllib.request, urllib.error, uuid, os

B = "http://localhost:8001/api"

def call(m, p, data=None, tok=None):
    req = urllib.request.Request(B + p, method=m)
    req.add_header("Content-Type", "application/json")
    if tok:
        req.add_header("Authorization", "Bearer " + tok)
    body = json.dumps(data).encode() if data is not None else None
    try:
        with urllib.request.urlopen(req, body, timeout=20) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as ex:
        return ex.code, ex.read()[:300].decode("utf8", "replace")

def tokenof(d):
    for k in ("token", "access_token", "session_token", "jwt"):
        if isinstance(d, dict) and d.get(k):
            return d[k]
    return None

em = "verify_%s@paypalfixcheck.com" % uuid.uuid4().hex[:8]
PW = "Passw0rd!123"

print("== FAN SIDE ==")
st, r = call("POST", "/auth/register", {"name": "Verify Tester", "email": em, "password": PW})
T = tokenof(r)
print("1 register            ", st, "token" if T else r)
if not T:
    st, r = call("POST", "/auth/login", {"email": em, "password": PW})
    T = tokenof(r)
    print("  login               ", st, "token" if T else r)

st, r = call("POST", "/membership/setup", {"amount": 49, "frequency": "monthly", "method": "paypal"}, T)
print("2 click Pay & Join    ", st, "awaiting_confirmation =", r.get("awaiting_confirmation") if isinstance(r, dict) else r)
print("  membership returned ", r.get("membership") if isinstance(r, dict) else r, " <-- must be None")

st, r = call("GET", "/membership/me", None, T)
print("3 fan dashboard shows ", st, r, " <-- must NOT be active")

print("\n== CREATOR SIDE ==")
ADMIN_EM = os.environ.get("ADMIN_EMAIL", "").strip('"')
ADMIN_PW = os.environ.get("ADMIN_PASSWORD", "").strip('"')
st, r = call("POST", "/auth/login", {"email": ADMIN_EM, "password": ADMIN_PW})
A = tokenof(r)
print("4 creator login       ", st, "token" if A else r)

st, r = call("GET", "/creator/requests", None, A)
pend = [x for x in (r.get("requests", []) if isinstance(r, dict) else []) if x.get("kind")]
print("5 payment cards wait  ", st, len(pend), "card(s)")
for x in pend:
    print("   ->", x["id"], "|", x["name"], "|", x["plan_name"])

if pend:
    rid = pend[0]["id"]
    st, r = call("POST", "/creator/requests/%s/approve" % rid, {}, A)
    print("6 creator approves    ", st, r)
    st, r = call("GET", "/membership/me", None, T)
    print("7 fan now active      ", st, r, " <-- must be active now")
else:
    print("6 NO PENDING CARD - FAIL")
print("\nDONE")
