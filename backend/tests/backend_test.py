"""Backend tests for Jade & Co. app."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://flex-connect-9.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@jadeandco.com"
ADMIN_PASSWORD = "JadeAdmin123!"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def member_creds():
    return {
        "name": "TEST Member",
        "email": f"test_member_{uuid.uuid4().hex[:8]}@example.com",
        "password": "Password123!",
    }


@pytest.fixture(scope="session")
def member_session(member_creds):
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json=member_creds, timeout=30)
    assert r.status_code == 200, f"register failed {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed {r.status_code} {r.text}"
    return s


# ---------- Auth ----------
class TestAuth:
    def test_register_and_me(self, member_session, member_creds):
        r = member_session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == member_creds["email"].lower()
        assert data["role"] == "member"

    def test_register_duplicate(self, member_creds):
        r = requests.post(f"{API}/auth/register", json=member_creds, timeout=30)
        assert r.status_code == 400

    def test_login_wrong_password(self, member_creds):
        r = requests.post(f"{API}/auth/login",
                          json={"email": member_creds["email"], "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_login_success(self, member_creds):
        r = requests.post(f"{API}/auth/login", json={
            "email": member_creds["email"], "password": member_creds["password"]}, timeout=30)
        assert r.status_code == 200
        assert "token" in r.json()

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_admin_login(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_logout(self, member_creds):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={
            "email": member_creds["email"], "password": member_creds["password"]}, timeout=30)
        r = s.post(f"{API}/auth/logout", timeout=30)
        assert r.status_code == 200


# ---------- PayPal ----------
class TestPayPal:
    def test_create_order_public(self):
        r = requests.post(f"{API}/paypal/create-order", json={"amount": 25.0}, timeout=60)
        assert r.status_code == 200, r.text
        assert "id" in r.json()

    def test_create_plan_requires_auth(self):
        r = requests.post(f"{API}/paypal/create-plan",
                          json={"amount": 25.0, "frequency": "monthly"}, timeout=60)
        assert r.status_code == 401

    def test_create_plan_authenticated(self, member_session):
        r = member_session.post(f"{API}/paypal/create-plan",
                                json={"amount": 25.0, "frequency": "monthly"}, timeout=60)
        assert r.status_code == 200, r.text
        assert "plan_id" in r.json()

    def test_create_plan_invalid_frequency(self, member_session):
        r = member_session.post(f"{API}/paypal/create-plan",
                                json={"amount": 25.0, "frequency": "bogus"}, timeout=60)
        assert r.status_code == 400

    def test_record_subscription_and_dashboard(self, member_session):
        sub_id = f"I-TEST{uuid.uuid4().hex[:10].upper()}"
        r = member_session.post(f"{API}/paypal/record-subscription", json={
            "subscription_id": sub_id, "amount": 50.0, "frequency": "monthly"
        }, timeout=30)
        assert r.status_code == 200, r.text
        tribute = r.json()["tribute"]
        assert tribute["type"] == "recurring"
        assert tribute["status"] == "active"

        r2 = member_session.get(f"{API}/tributes/me", timeout=30)
        assert r2.status_code == 200
        data = r2.json()
        assert data["active_membership"] is not None
        assert data["active_membership"]["paypal_subscription_id"] == sub_id
        assert data["total_contributed"] >= 50.0
        assert any(t.get("paypal_subscription_id") == sub_id for t in data["tributes"])

    def test_record_subscription_replaces_previous(self, member_session):
        sub2 = f"I-TEST{uuid.uuid4().hex[:10].upper()}"
        r = member_session.post(f"{API}/paypal/record-subscription", json={
            "subscription_id": sub2, "amount": 75.0, "frequency": "yearly"
        }, timeout=30)
        assert r.status_code == 200
        r2 = member_session.get(f"{API}/tributes/me", timeout=30)
        data = r2.json()
        # Only one active recurring
        actives = [t for t in data["tributes"] if t["type"] == "recurring" and t["status"] == "active"]
        assert len(actives) == 1
        assert actives[0]["paypal_subscription_id"] == sub2


# ---------- Admin ----------
class TestAdmin:
    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{API}/admin/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_members", "total_revenue", "active_subscriptions", "one_time_tributes", "total_tributes"):
            assert k in d

    def test_admin_members(self, admin_session):
        r = admin_session.get(f"{API}/admin/members", timeout=30)
        assert r.status_code == 200
        assert "members" in r.json()
        assert isinstance(r.json()["members"], list)

    def test_admin_tributes(self, admin_session):
        r = admin_session.get(f"{API}/admin/tributes", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json().get("tributes"), list)

    def test_admin_endpoints_reject_member(self, member_session):
        for path in ("/admin/stats", "/admin/members", "/admin/tributes"):
            r = member_session.get(f"{API}{path}", timeout=30)
            assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_admin_endpoints_reject_anonymous(self):
        for path in ("/admin/stats", "/admin/members", "/admin/tributes"):
            r = requests.get(f"{API}{path}", timeout=30)
            assert r.status_code == 401
