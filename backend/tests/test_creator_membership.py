"""Creator (DOM) + Membership (FAN self-report) backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://flex-connect-9.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@jadeandco.com"
ADMIN_PASSWORD = "JadeAdmin123!"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def member():
    s = requests.Session()
    creds = {
        "name": "TEST Fan",
        "email": f"test_fan_{uuid.uuid4().hex[:8]}@example.com",
        "password": "Password123!",
    }
    r = s.post(f"{API}/auth/register", json=creds, timeout=30)
    assert r.status_code == 200, r.text
    s.creds = creds
    return s


# ---------------- Membership (FAN) ----------------
class TestMembership:
    def test_membership_me_empty(self, member):
        r = member.get(f"{API}/membership/me", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["membership"] is None
        assert isinstance(data["history"], list)

    def test_membership_setup_recurring(self, member):
        r = member.post(f"{API}/membership/setup",
                        json={"amount": 100, "frequency": "monthly", "method": "stripe"},
                        timeout=30)
        assert r.status_code == 200, r.text
        m = r.json()["membership"]
        assert m["active"] is True
        assert m["amount"] == 100
        assert m["frequency"] == "monthly"
        assert m["tier"] == "Gold"

    def test_membership_me_after_setup(self, member):
        r = member.get(f"{API}/membership/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["membership"]["active"] is True

    def test_self_report_tribute(self, member):
        r = member.post(f"{API}/tributes/self-report",
                        json={"amount": 50, "method": "venmo"}, timeout=30)
        assert r.status_code == 200, r.text
        tribute = r.json()["tribute"]
        assert tribute["type"] == "self-report"
        assert tribute["status"] == "confirmed"
        assert tribute["amount"] == 50

        # verify persisted in history
        r2 = member.get(f"{API}/membership/me", timeout=30)
        assert r2.status_code == 200
        history = r2.json()["history"]
        assert any(t.get("amount") == 50 and t.get("type") == "self-report" for t in history)

    def test_membership_cancel(self, member):
        r = member.post(f"{API}/membership/cancel", timeout=30)
        assert r.status_code == 200
        r2 = member.get(f"{API}/membership/me", timeout=30)
        assert r2.json()["membership"] is None

    def test_membership_requires_auth(self):
        r = requests.get(f"{API}/membership/me", timeout=30)
        assert r.status_code == 401


# ---------------- Creator (DOM) ----------------
class TestCreatorHome:
    def test_home(self, admin):
        r = admin.get(f"{API}/creator/home", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "stats" in d and "revenue_total" in d and "pending_requests" in d
        assert isinstance(d["plans"], list)
        assert isinstance(d["recent_payments"], list)

    def test_home_requires_admin(self, member):
        r = member.get(f"{API}/creator/home", timeout=30)
        assert r.status_code == 403


class TestCreatorRequests:
    def test_list(self, admin):
        r = admin.get(f"{API}/creator/requests", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["requests"], list)

    def test_invalid_action(self, admin):
        r = admin.post(f"{API}/creator/requests/req_mr/bogus", timeout=30)
        assert r.status_code == 400

    def test_not_found(self, admin):
        r = admin.post(f"{API}/creator/requests/nope_id/approve", timeout=30)
        assert r.status_code == 404


class TestCreatorSubscribers:
    def test_list(self, admin):
        r = admin.get(f"{API}/creator/subscribers", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d["subscribers"], list)
        assert "missed_count" in d

    def test_status_change_and_revert(self, admin):
        r = admin.get(f"{API}/creator/subscribers", timeout=30)
        subs = r.json()["subscribers"]
        if not subs:
            pytest.skip("no subscribers seeded")
        sid = subs[0]["id"]
        original = subs[0]["status"]
        # set to due
        r2 = admin.post(f"{API}/creator/subscribers/{sid}/status", json={"status": "due"}, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["subscriber"]["status"] == "due"
        # revert
        admin.post(f"{API}/creator/subscribers/{sid}/status",
                   json={"status": original if original in ("paid", "due", "overdue") else "paid"},
                   timeout=30)

    def test_override_validation(self, admin):
        # missing reason
        r = admin.post(f"{API}/creator/subscribers/sub_mr/override",
                       json={"action": "restore_access", "reason": ""}, timeout=30)
        assert r.status_code == 400
        # bad action
        r2 = admin.post(f"{API}/creator/subscribers/sub_mr/override",
                        json={"action": "nope", "reason": "test"}, timeout=30)
        assert r2.status_code == 400

    def test_override_restore(self, admin):
        # Find any surviving subscriber
        subs = admin.get(f"{API}/creator/subscribers", timeout=30).json()["subscribers"]
        if not subs:
            pytest.skip("no subs")
        sid = subs[0]["id"]
        r = admin.post(f"{API}/creator/subscribers/{sid}/override",
                       json={"action": "restore_access", "reason": "TEST restore"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_remind_one(self, admin):
        subs = admin.get(f"{API}/creator/subscribers", timeout=30).json()["subscribers"]
        if not subs:
            pytest.skip("no subs")
        sid = subs[0]["id"]
        r = admin.post(f"{API}/creator/subscribers/{sid}/remind", timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_remind_group(self, admin):
        for g in ("week", "overdue", "due_1_3", "due_4_7"):
            r = admin.post(f"{API}/creator/remind-group/{g}", timeout=30)
            assert r.status_code == 200
            assert "reminded" in r.json()

    def test_message_all(self, admin):
        r = admin.post(f"{API}/creator/message-all", timeout=30)
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestCreatorPlans:
    def test_patch_plan_price(self, admin):
        home = admin.get(f"{API}/creator/home", timeout=30).json()
        plans = home["plans"]
        if not plans:
            pytest.skip("no plans")
        pid = plans[0]["id"]
        orig_price = plans[0]["price"]
        new_price = float(orig_price) + 5
        r = admin.patch(f"{API}/creator/plans/{pid}", json={"price": new_price}, timeout=30)
        assert r.status_code == 200
        assert r.json()["plan"]["price"] == new_price
        # revert
        admin.patch(f"{API}/creator/plans/{pid}", json={"price": orig_price}, timeout=30)

    def test_patch_plan_not_found(self, admin):
        r = admin.patch(f"{API}/creator/plans/bogus_plan", json={"price": 1.0}, timeout=30)
        assert r.status_code == 404


class TestCreatorReminders:
    def test_reminders(self, admin):
        r = admin.get(f"{API}/creator/reminders", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "due_1_3" in d and "due_4_7" in d and "overdue" in d
        assert "due_this_week_total" in d


class TestCreatorInbox:
    def test_inbox(self, admin):
        r = admin.get(f"{API}/creator/inbox", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json()["messages"], list)
