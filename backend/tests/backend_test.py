"""LifeLedger backend API tests.

Covers auth, public read, protected write endpoints, savings/transactions/
business CRUD, finance summary aggregation, and the daily-log 9AM rule.
"""

import os
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
OWNER_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
NL_TZ = ZoneInfo("Europe/Amsterdam")


# --------------------------------------------------------------------------- Fixtures
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(client):
    r = client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------- Auth
class TestAuth:
    def test_login_success(self, client):
        r = client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["email"] == OWNER_EMAIL
        assert data["user"]["role"] == "admin"

    def test_login_wrong_password(self, client):
        r = client.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_with_token(self, client, auth_headers):
        r = client.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_me_without_token(self, client):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# --------------------------------------------------------------------------- Public GET
class TestPublicGets:
    def test_settings(self, client):
        r = client.get(f"{API}/settings")
        assert r.status_code == 200
        data = r.json()
        assert data["birth_date"] == "2003-08-28"
        assert isinstance(data["lifespan_years"], int)

    def test_finance_summary_shape(self, client):
        r = client.get(f"{API}/finance/summary")
        assert r.status_code == 200
        data = r.json()
        for k in ["total_savings", "projected_annual_interest", "blended_apy",
                  "monthly_income", "monthly_expense", "monthly_net",
                  "business_monthly_revenue", "business_monthly_costs",
                  "business_monthly_profit", "net_worth", "accounts_count",
                  "business_count"]:
            assert k in data

    def test_lists_are_arrays(self, client):
        for path in ["/daily", "/savings", "/transactions", "/business"]:
            r = client.get(f"{API}{path}")
            assert r.status_code == 200, path
            assert isinstance(r.json(), list), path


# --------------------------------------------------------------------------- Auth protection
class TestAuthProtection:
    def test_savings_post_requires_auth(self, client):
        r = requests.post(f"{API}/savings", json={"name": "X"})
        assert r.status_code in (401, 403)

    def test_txn_post_requires_auth(self, client):
        r = requests.post(f"{API}/transactions", json={"type": "income", "amount": 1})
        assert r.status_code in (401, 403)

    def test_business_post_requires_auth(self, client):
        r = requests.post(f"{API}/business", json={"name": "X"})
        assert r.status_code in (401, 403)

    def test_daily_put_requires_auth(self, client):
        today = datetime.now(NL_TZ).date().isoformat()
        r = requests.put(f"{API}/daily/{today}", json={"tasks": []})
        assert r.status_code in (401, 403)

    def test_settings_put_requires_auth(self, client):
        r = requests.put(f"{API}/settings", json={"birth_date": "2003-08-28", "lifespan_years": 85})
        assert r.status_code in (401, 403)


# --------------------------------------------------------------------------- Savings CRUD
class TestSavings:
    def test_savings_lifecycle_and_summary(self, client, auth_headers):
        # baseline summary
        base = client.get(f"{API}/finance/summary").json()

        payload = {"name": "TEST_Vault", "balance": 1000.0, "apy": 4.0}
        r = client.post(f"{API}/savings", json=payload, headers=auth_headers)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == "TEST_Vault"
        assert "id" in created
        sid = created["id"]

        # appears in list
        lst = client.get(f"{API}/savings").json()
        assert any(s["id"] == sid for s in lst)

        # summary recomputed
        summ = client.get(f"{API}/finance/summary").json()
        assert round(summ["total_savings"] - base["total_savings"], 2) == 1000.0
        assert round(summ["projected_annual_interest"] - base["projected_annual_interest"], 2) == 40.0
        assert summ["blended_apy"] > 0

        # cleanup
        r = client.delete(f"{API}/savings/{sid}", headers=auth_headers)
        assert r.status_code == 200
        lst = client.get(f"{API}/savings").json()
        assert not any(s["id"] == sid for s in lst)


# --------------------------------------------------------------------------- Transactions
class TestTransactions:
    def test_income_expense_and_summary(self, client, auth_headers):
        today = datetime.now(NL_TZ).date().isoformat()
        base = client.get(f"{API}/finance/summary").json()

        inc = client.post(f"{API}/transactions",
                          json={"type": "income", "amount": 500, "category": "salary",
                                "description": "TEST_income", "date": today},
                          headers=auth_headers)
        assert inc.status_code == 200
        inc_id = inc.json()["id"]

        exp = client.post(f"{API}/transactions",
                          json={"type": "expense", "amount": 150, "category": "food",
                                "description": "TEST_expense", "date": today},
                          headers=auth_headers)
        assert exp.status_code == 200
        exp_id = exp.json()["id"]

        summ = client.get(f"{API}/finance/summary").json()
        assert round(summ["monthly_income"] - base["monthly_income"], 2) == 500.0
        assert round(summ["monthly_expense"] - base["monthly_expense"], 2) == 150.0
        assert round(summ["monthly_net"] - base["monthly_net"], 2) == 350.0

        # cleanup
        assert client.delete(f"{API}/transactions/{inc_id}", headers=auth_headers).status_code == 200
        assert client.delete(f"{API}/transactions/{exp_id}", headers=auth_headers).status_code == 200


# --------------------------------------------------------------------------- Business
class TestBusiness:
    def test_business_and_summary(self, client, auth_headers):
        base = client.get(f"{API}/finance/summary").json()
        r = client.post(f"{API}/business",
                        json={"name": "TEST_Venture", "monthly_revenue": 2000, "monthly_costs": 800},
                        headers=auth_headers)
        assert r.status_code == 200
        bid = r.json()["id"]

        summ = client.get(f"{API}/finance/summary").json()
        assert round(summ["business_monthly_revenue"] - base["business_monthly_revenue"], 2) == 2000.0
        assert round(summ["business_monthly_costs"] - base["business_monthly_costs"], 2) == 800.0
        assert round(summ["business_monthly_profit"] - base["business_monthly_profit"], 2) == 1200.0

        assert client.delete(f"{API}/business/{bid}", headers=auth_headers).status_code == 200


# --------------------------------------------------------------------------- Daily log 9AM rule
@pytest.mark.xdist_group("daily")
class TestDailyLog:
    def test_9am_rule(self, client, auth_headers):
        today = datetime.now(NL_TZ).date().isoformat()
        now_nl = datetime.now(NL_TZ)
        before_9 = now_nl.hour < 9

        # Reset by first clearing (no tasks)
        client.put(f"{API}/daily/{today}",
                   json={"tasks": [], "workouts": [], "did_right": "", "did_wrong": ""},
                   headers=auth_headers)

        # Add tasks - first time this triggers 9AM evaluation
        payload = {
            "tasks": [
                {"id": "t1", "text": "TEST_task1", "done": False},
                {"id": "t2", "text": "TEST_task2", "done": False},
            ],
            "workouts": [],
            "did_right": "",
            "did_wrong": "",
        }
        r = client.put(f"{API}/daily/{today}", json=payload, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["set_before_9am"] is before_9
        assert data["tasks_total"] == 2
        assert data["tasks_done"] == 0
        # not complete since tasks not done
        assert data["status"] in ("partial", "logged")

        # Complete all tasks
        payload["tasks"] = [{"id": "t1", "text": "TEST_task1", "done": True},
                            {"id": "t2", "text": "TEST_task2", "done": True}]
        r = client.put(f"{API}/daily/{today}", json=payload, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["tasks_done"] == 2
        if before_9:
            assert data["status"] == "complete", f"Expected complete but got {data['status']}"
        else:
            assert data["status"] != "complete", f"Should not be complete after 9AM: {data['status']}"

        # Clean up: clear tasks
        client.put(f"{API}/daily/{today}",
                   json={"tasks": [], "workouts": [], "did_right": "", "did_wrong": ""},
                   headers=auth_headers)

    def test_task_category_and_comment_persist(self, client, auth_headers):
        today = datetime.now(NL_TZ).date().isoformat()
        client.put(f"{API}/daily/{today}",
                   json={"tasks": [], "workouts": [], "did_right": "", "did_wrong": ""},
                   headers=auth_headers)
        payload = {"tasks": [
            {"id": "tc1", "text": "TEST_taskA", "done": False,
             "category": "gym", "comment": "TEST_note"},
        ], "workouts": [], "did_right": "", "did_wrong": ""}
        r = client.put(f"{API}/daily/{today}", json=payload, headers=auth_headers)
        assert r.status_code == 200
        got = client.get(f"{API}/daily/{today}").json()
        assert got["tasks"][0]["category"] == "gym"
        assert got["tasks"][0]["comment"] == "TEST_note"
        client.put(f"{API}/daily/{today}",
                   json={"tasks": [], "workouts": [], "did_right": "", "did_wrong": ""},
                   headers=auth_headers)



# --------------------------------------------------------------------------- Watchlist / Market
class TestMarket:
    def test_catalog(self, client):
        r = client.get(f"{API}/market/catalog")
        assert r.status_code == 200
        data = r.json()
        syms = {c["symbol"] for c in data}
        for s in ["BTC", "ETH", "SOL", "AAPL", "TSLA", "NVDA", "EUR/USD", "SPX"]:
            assert s in syms, s

    def test_watchlist_seeds_defaults(self, client):
        r = client.get(f"{API}/watchlist")
        assert r.status_code == 200
        items = r.json()
        syms = {i["symbol"] for i in items}
        for s in ["BTC", "ETH", "SOL", "AAPL", "TSLA", "NVDA", "EUR/USD", "SPX"]:
            assert s in syms, s

    def test_quotes_returns_all_symbols(self, client):
        # ensure seeded first
        client.get(f"{API}/watchlist")
        r = client.get(f"{API}/market/quotes")
        assert r.status_code == 200
        quotes = r.json()
        assert len(quotes) > 0
        by_sym = {q["symbol"]: q for q in quotes}
        # crypto BTC price should be non-zero (real coingecko or cached)
        assert "BTC" in by_sym
        assert by_sym["BTC"]["price"] > 0
        # all quotes have price + change
        for q in quotes:
            assert "price" in q and "change" in q

    def test_watchlist_write_requires_auth(self):
        r = requests.post(f"{API}/watchlist", json={"symbol": "TEST_X", "type": "custom"})
        assert r.status_code in (401, 403)
        r = requests.delete(f"{API}/watchlist/foo")
        assert r.status_code in (401, 403)

    def test_watchlist_add_and_delete(self, client, auth_headers):
        payload = {"symbol": "TEST_ZZZ", "name": "Test coin", "type": "custom", "base_price": 42.0}
        r = client.post(f"{API}/watchlist", json=payload, headers=auth_headers)
        assert r.status_code == 200
        wid = r.json()["id"]
        items = client.get(f"{API}/watchlist").json()
        assert any(i["id"] == wid for i in items)
        r = client.delete(f"{API}/watchlist/{wid}", headers=auth_headers)
        assert r.status_code == 200
        items = client.get(f"{API}/watchlist").json()
        assert not any(i["id"] == wid for i in items)


# --------------------------------------------------------------------------- Trades
class TestTrades:
    def test_trades_write_requires_auth(self):
        r = requests.post(f"{API}/trades", json={"symbol": "BTC", "entry_price": 1})
        assert r.status_code in (401, 403)

    def test_trade_pnl_and_summary(self, client, auth_headers):
        # Closed long trade: entry 50000, exit 55000, size 0.5 => 2500
        payload = {"symbol": "TEST_BTC", "asset_type": "crypto", "side": "long",
                   "entry_price": 50000, "exit_price": 55000, "size": 0.5, "status": "closed"}
        r = client.post(f"{API}/trades", json=payload, headers=auth_headers)
        assert r.status_code == 200
        t = r.json()
        assert t["pnl"] == 2500.0
        tid_closed = t["id"]

        # Open trade
        r = client.post(f"{API}/trades", json={"symbol": "TEST_ETH", "side": "long",
                                                "entry_price": 2000, "size": 1, "status": "open"},
                        headers=auth_headers)
        assert r.status_code == 200
        tid_open = r.json()["id"]

        # Summary should include both
        s = client.get(f"{API}/trades/summary").json()
        for k in ["total_pnl", "win_rate", "open_trades", "best", "worst"]:
            assert k in s
        assert s["open_trades"] >= 1

        # PUT to close open trade
        r = client.put(f"{API}/trades/{tid_open}",
                       json={"symbol": "TEST_ETH", "side": "long", "entry_price": 2000,
                             "exit_price": 2500, "size": 1, "status": "closed"},
                       headers=auth_headers)
        assert r.status_code == 200
        upd = r.json()
        assert upd["status"] == "closed"
        assert upd["exit_price"] == 2500
        assert upd["pnl"] == 500.0

        # cleanup
        client.delete(f"{API}/trades/{tid_closed}", headers=auth_headers)
        client.delete(f"{API}/trades/{tid_open}", headers=auth_headers)


# --------------------------------------------------------------------------- Growth
class TestGrowth:
    def test_metrics_defs(self, client):
        r = client.get(f"{API}/metrics")
        assert r.status_code == 200
        data = r.json()
        keys = {m["key"] for m in data}
        for k in ["weight", "bench_press", "net_worth", "mood"]:
            assert k in keys
        cats = {m["category"] for m in data}
        for c in ["gym", "finance", "mind", "mental"]:
            assert c in cats

    def test_growth_write_requires_auth(self):
        r = requests.post(f"{API}/growth", json={"metric": "weight", "value": 80})
        assert r.status_code in (401, 403)

    def test_growth_log_and_sort(self, client, auth_headers):
        e1 = client.post(f"{API}/growth", json={"metric": "TEST_weight", "category": "gym",
                                                 "value": 80, "date": "2025-01-01"},
                         headers=auth_headers).json()
        e2 = client.post(f"{API}/growth", json={"metric": "TEST_weight", "category": "gym",
                                                 "value": 79, "date": "2025-02-01"},
                         headers=auth_headers).json()
        r = client.get(f"{API}/growth?metric=TEST_weight")
        assert r.status_code == 200
        entries = r.json()
        assert len(entries) == 2
        assert entries[0]["date"] <= entries[1]["date"]
        # cleanup
        client.delete(f"{API}/growth/{e1['id']}", headers=auth_headers)
        client.delete(f"{API}/growth/{e2['id']}", headers=auth_headers)

    def test_snapshot_networth(self, client, auth_headers):
        r = client.post(f"{API}/growth/snapshot-networth", headers=auth_headers)
        assert r.status_code == 200
        snap = r.json()
        assert snap["metric"] == "net_worth"
        assert snap["category"] == "finance"
        # cleanup
        client.delete(f"{API}/growth/{snap['id']}", headers=auth_headers)


# --------------------------------------------------------------------------- Relationships
class TestRelationships:
    def test_write_requires_auth(self):
        r = requests.post(f"{API}/relationships", json={"name": "X"})
        assert r.status_code in (401, 403)

    def test_person_and_logs(self, client, auth_headers):
        r = client.post(f"{API}/relationships",
                        json={"name": "TEST_Alice", "relation": "friend", "closeness": 7},
                        headers=auth_headers)
        assert r.status_code == 200
        pid = r.json()["id"]

        r = client.post(f"{API}/relationships/{pid}/logs",
                        json={"quality": 8, "note": "TEST_call", "date": "2025-05-01"},
                        headers=auth_headers)
        assert r.status_code == 200
        person = r.json()
        assert person["last_contact"] == "2025-05-01"
        assert len(person["logs"]) == 1

        r = client.put(f"{API}/relationships/{pid}",
                       json={"name": "TEST_Alice2", "relation": "friend", "closeness": 9},
                       headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["closeness"] == 9

        assert client.delete(f"{API}/relationships/{pid}", headers=auth_headers).status_code == 200


# --------------------------------------------------------------------------- Books
class TestBooks:
    def test_write_requires_auth(self):
        r = requests.post(f"{API}/books", json={"title": "X"})
        assert r.status_code in (401, 403)

    def test_books_crud_and_summary(self, client, auth_headers):
        r = client.post(f"{API}/books",
                        json={"title": "TEST_Book", "author": "TEST", "status": "reading",
                              "total_pages": 200, "current_page": 50},
                        headers=auth_headers)
        assert r.status_code == 200
        bid = r.json()["id"]

        r = client.put(f"{API}/books/{bid}",
                       json={"title": "TEST_Book", "author": "TEST", "status": "finished",
                             "rating": 5, "total_pages": 200, "current_page": 200},
                       headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["status"] == "finished"

        summ = client.get(f"{API}/books/summary").json()
        for k in ["finished", "reading", "to_read", "pages_read", "avg_rating"]:
            assert k in summ
        assert summ["finished"] >= 1
        assert summ["pages_read"] >= 200

        assert client.delete(f"{API}/books/{bid}", headers=auth_headers).status_code == 200


# --------------------------------------------------------------------------- Business extended
class TestBusinessExtended:
    def test_business_social_and_failed(self, client, auth_headers):
        r = client.post(f"{API}/business",
                        json={"name": "TEST_IG", "kind": "social", "platform": "instagram",
                              "handle": "@test", "followers": 12345, "status": "active"},
                        headers=auth_headers)
        assert r.status_code == 200
        bid1 = r.json()["id"]
        got = next(b for b in client.get(f"{API}/business").json() if b["id"] == bid1)
        assert got["kind"] == "social"
        assert got["platform"] == "instagram"
        assert got["followers"] == 12345

        r = client.post(f"{API}/business",
                        json={"name": "TEST_Failed", "status": "failed", "fail_reason": "market fit"},
                        headers=auth_headers)
        assert r.status_code == 200
        bid2 = r.json()["id"]
        got = next(b for b in client.get(f"{API}/business").json() if b["id"] == bid2)
        assert got["status"] == "failed"
        assert got["fail_reason"] == "market fit"

        client.delete(f"{API}/business/{bid1}", headers=auth_headers)
        client.delete(f"{API}/business/{bid2}", headers=auth_headers)


# end of tests

