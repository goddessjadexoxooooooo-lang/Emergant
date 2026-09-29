import json, urllib.request, urllib.error, os

B = "http://localhost:8001/api"

def login(email, pw):
    req = urllib.request.Request(B + "/auth/login", method="POST")
    req.add_header("Content-Type", "application/json")
    body = json.dumps({"email": email, "password": pw}).encode()
    try:
        with urllib.request.urlopen(req, body, timeout=15) as r:
            d = json.loads(r.read() or b"{}")
            return r.status, bool(d.get("token") or d.get("access_token"))
    except urllib.error.HTTPError as ex:
        return ex.code, False

# the generated demo admin published in commit 2a22932
print("admin@jadeandco.com / JadeAdmin123!  ->", login("admin@jadeandco.com", "JadeAdmin123!"))

# whatever is in .env (her own account) - report only whether it works, never the value
env_em = os.environ.get("ADMIN_EMAIL", "").strip('"')
env_pw = os.environ.get("ADMIN_PASSWORD", "").strip('"')
st, ok = login(env_em, env_pw)
print(".env ADMIN_EMAIL =", env_em, " -> ", st, ok)
