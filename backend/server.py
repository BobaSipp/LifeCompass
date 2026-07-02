from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import random
import math
import time as _time
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta, time
from zoneinfo import ZoneInfo

from fastapi import FastAPI, APIRouter, Request, HTTPException, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@example.com').lower()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
NL_TZ = ZoneInfo("Europe/Amsterdam")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


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
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Owner access required")
    return user


async def record_networth_snapshot() -> float:
    """Recompute net worth (savings + realized trade P&L) and upsert today's Growth entry.
    One entry per day so financial changes keep the Growth chart in sync automatically."""
    savings = await db.savings.find({}, {"_id": 0}).to_list(500)
    total = sum(s.get("balance", 0) for s in savings)
    closed = await db.trades.find({"status": "closed"}, {"_id": 0}).to_list(1000)
    realized = sum(_trade_pnl(t) for t in closed)
    net = round(total + realized, 2)
    today = datetime.now(NL_TZ).date().isoformat()
    await db.growth_entries.update_one(
        {"metric": "net_worth", "date": today},
        {
            "$set": {"value": net, "category": "finance", "note": "auto-synced from finances"},
            "$setOnInsert": {"id": str(uuid.uuid4()), "metric": "net_worth", "date": today},
        },
        upsert=True,
    )
    return net


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginInput(BaseModel):
    email: str
    password: str


class TaskItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str
    done: bool = False
    comment: str = ""
    category: str = ""  # optional tag / business name


class DailyLogInput(BaseModel):
    tasks: List[TaskItem] = []
    workouts: List[TaskItem] = []
    did_right: str = ""
    did_wrong: str = ""


class SettingsInput(BaseModel):
    birth_date: str
    lifespan_years: int


class SavingsInput(BaseModel):
    name: str
    balance: float = 0.0
    apy: float = 0.0


class TransactionInput(BaseModel):
    type: str  # income | expense
    amount: float
    category: str = ""
    description: str = ""
    date: Optional[str] = None


class BusinessInput(BaseModel):
    name: str
    kind: str = "business"        # business | social
    platform: str = ""           # instagram / youtube / tiktok / x ...
    handle: str = ""
    url: str = ""
    status: str = "active"       # active | paused | failed | sold
    followers: int = 0
    monthly_revenue: float = 0.0
    monthly_costs: float = 0.0
    started_at: str = ""
    fail_reason: str = ""
    notes: str = ""


class WatchlistInput(BaseModel):
    symbol: str
    name: str = ""
    type: str = "crypto"          # crypto | stock | forex | index | custom
    coingecko_id: str = ""
    base_price: float = 0.0


class TradeInput(BaseModel):
    symbol: str
    asset_type: str = "crypto"
    side: str = "long"            # long | short
    entry_price: float
    exit_price: Optional[float] = None
    size: float = 1.0
    leverage: float = 1.0
    margin: float = 0.0           # dollar amount put in; size is derived from this
    status: str = "open"          # open | closed
    opened_at: Optional[str] = None
    closed_at: Optional[str] = None
    notes: str = ""


class GrowthInput(BaseModel):
    metric: str                   # weight, bench_press, net_worth, iq, mood ...
    category: str = "custom"      # gym | finance | mind | mental | custom
    value: float
    date: Optional[str] = None
    note: str = ""


class PersonInput(BaseModel):
    name: str
    relation: str = ""            # friend | family | partner | mentor ...
    closeness: int = 5            # 1-10
    last_contact: str = ""
    notes: str = ""


class InteractionInput(BaseModel):
    date: Optional[str] = None
    quality: int = 5              # 1-10
    note: str = ""


class BookInput(BaseModel):
    title: str
    author: str = ""
    status: str = "to_read"       # to_read | reading | finished
    rating: int = 0               # 0-5
    total_pages: int = 0
    current_page: int = 0
    started_at: str = ""
    finished_at: str = ""
    notes: str = ""


# ---------------------------------------------------------------------------
# Daily status computation
# ---------------------------------------------------------------------------
def compute_status(log: dict) -> dict:
    tasks = log.get("tasks", [])
    workouts = log.get("workouts", [])
    total = len(tasks)
    done = sum(1 for t in tasks if t.get("done"))
    w_total = len(workouts)
    w_done = sum(1 for t in workouts if t.get("done"))
    set_before_9am = log.get("set_before_9am", False)

    if total == 0 and w_total == 0 and not log.get("did_right") and not log.get("did_wrong"):
        status = "none"
    elif total > 0 and done == total and set_before_9am:
        status = "complete"
    elif total > 0 and (done > 0 or set_before_9am):
        status = "partial"
    else:
        status = "logged"

    ratio = (done / total) if total else 0
    log["status"] = status
    log["tasks_done"] = done
    log["tasks_total"] = total
    log["workouts_done"] = w_done
    log["workouts_total"] = w_total
    log["completion_ratio"] = round(ratio, 2)
    return log


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    return {
        "token": token,
        "user": {"id": user["id"], "email": user["email"], "name": user.get("name"), "role": user.get("role")},
    }


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout():
    return {"ok": True}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"key": "profile"}, {"_id": 0})
    if not s:
        s = {"key": "profile", "birth_date": "2003-08-28", "lifespan_years": 85}
        await db.settings.insert_one(s)
        s.pop("_id", None)
    return {"birth_date": s["birth_date"], "lifespan_years": s["lifespan_years"]}


@api_router.put("/settings")
async def update_settings(data: SettingsInput, _: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"key": "profile"},
        {"$set": {"birth_date": data.birth_date, "lifespan_years": data.lifespan_years}},
        upsert=True,
    )
    return {"birth_date": data.birth_date, "lifespan_years": data.lifespan_years}


# ---------------------------------------------------------------------------
# Daily logs
# ---------------------------------------------------------------------------
@api_router.get("/daily")
async def get_all_daily():
    logs = await db.daily_logs.find({}, {"_id": 0}).to_list(2000)
    return [compute_status(l) for l in logs]


@api_router.get("/daily/{date}")
async def get_daily(date: str):
    log = await db.daily_logs.find_one({"date": date}, {"_id": 0})
    if not log:
        log = {"date": date, "tasks": [], "workouts": [], "did_right": "", "did_wrong": "", "set_before_9am": False}
    return compute_status(log)


@api_router.put("/daily/{date}")
async def upsert_daily(date: str, data: DailyLogInput, _: dict = Depends(require_admin)):
    existing = await db.daily_logs.find_one({"date": date})
    now_nl = datetime.now(NL_TZ)

    had_tasks = existing and len(existing.get("tasks", [])) > 0
    now_has_tasks = len(data.tasks) > 0

    set_before_9am = existing.get("set_before_9am", False) if existing else False
    tasks_set_at = existing.get("tasks_set_at") if existing else None

    # First time tasks are added for this day -> stamp the moment and evaluate the 9AM rule
    if now_has_tasks and not had_tasks:
        tasks_set_at = now_nl.isoformat()
        set_before_9am = (now_nl.date().isoformat() == date) and (now_nl.time() < time(9, 0))
    if not now_has_tasks:
        set_before_9am = False
        tasks_set_at = None

    doc = {
        "date": date,
        "tasks": [t.model_dump() for t in data.tasks],
        "workouts": [w.model_dump() for w in data.workouts],
        "did_right": data.did_right,
        "did_wrong": data.did_wrong,
        "set_before_9am": set_before_9am,
        "tasks_set_at": tasks_set_at,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.daily_logs.update_one({"date": date}, {"$set": doc}, upsert=True)
    return compute_status(doc)


# ---------------------------------------------------------------------------
# Savings accounts
# ---------------------------------------------------------------------------
@api_router.get("/savings")
async def list_savings():
    return await db.savings.find({}, {"_id": 0}).to_list(500)


@api_router.post("/savings")
async def create_savings(data: SavingsInput, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.savings.insert_one(doc)
    doc.pop("_id", None)
    await record_networth_snapshot()
    return doc


@api_router.put("/savings/{item_id}")
async def update_savings(item_id: str, data: SavingsInput, _: dict = Depends(require_admin)):
    await db.savings.update_one({"id": item_id}, {"$set": data.model_dump()})
    await record_networth_snapshot()
    return await db.savings.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/savings/{item_id}")
async def delete_savings(item_id: str, _: dict = Depends(require_admin)):
    await db.savings.delete_one({"id": item_id})
    await record_networth_snapshot()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
@api_router.get("/transactions")
async def list_transactions():
    return await db.transactions.find({}, {"_id": 0}).sort("date", -1).to_list(1000)


@api_router.post("/transactions")
async def create_transaction(data: TransactionInput, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "type": data.type,
        "amount": data.amount,
        "category": data.category,
        "description": data.description,
        "date": data.date or datetime.now(NL_TZ).date().isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(doc)
    doc.pop("_id", None)
    await record_networth_snapshot()
    return doc


@api_router.delete("/transactions/{item_id}")
async def delete_transaction(item_id: str, _: dict = Depends(require_admin)):
    await db.transactions.delete_one({"id": item_id})
    await record_networth_snapshot()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Business
# ---------------------------------------------------------------------------
@api_router.get("/business")
async def list_business():
    return await db.business.find({}, {"_id": 0}).to_list(500)


@api_router.post("/business")
async def create_business(data: BusinessInput, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.business.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/business/{item_id}")
async def update_business(item_id: str, data: BusinessInput, _: dict = Depends(require_admin)):
    await db.business.update_one({"id": item_id}, {"$set": data.model_dump()})
    return await db.business.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/business/{item_id}")
async def delete_business(item_id: str, _: dict = Depends(require_admin)):
    await db.business.delete_one({"id": item_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Finance summary
# ---------------------------------------------------------------------------
@api_router.get("/finance/summary")
async def finance_summary():
    savings = await db.savings.find({}, {"_id": 0}).to_list(500)
    txns = await db.transactions.find({}, {"_id": 0}).to_list(1000)
    businesses = await db.business.find({}, {"_id": 0}).to_list(500)

    total_savings = sum(s.get("balance", 0) for s in savings)
    projected_interest = sum(s.get("balance", 0) * s.get("apy", 0) / 100 for s in savings)
    blended_apy = (projected_interest / total_savings * 100) if total_savings else 0

    now = datetime.now(NL_TZ)
    month_prefix = now.strftime("%Y-%m")
    month_income = sum(t["amount"] for t in txns if t["type"] == "income" and str(t.get("date", "")).startswith(month_prefix))
    month_expense = sum(t["amount"] for t in txns if t["type"] == "expense" and str(t.get("date", "")).startswith(month_prefix))

    biz_revenue = sum(b.get("monthly_revenue", 0) for b in businesses)
    biz_costs = sum(b.get("monthly_costs", 0) for b in businesses)

    closed_trades = await db.trades.find({"status": "closed"}, {"_id": 0}).to_list(1000)
    realized_pnl = sum(_trade_pnl(t) for t in closed_trades)

    return {
        "total_savings": round(total_savings, 2),
        "projected_annual_interest": round(projected_interest, 2),
        "blended_apy": round(blended_apy, 2),
        "monthly_income": round(month_income, 2),
        "monthly_expense": round(month_expense, 2),
        "monthly_net": round(month_income - month_expense, 2),
        "business_monthly_revenue": round(biz_revenue, 2),
        "business_monthly_costs": round(biz_costs, 2),
        "business_monthly_profit": round(biz_revenue - biz_costs, 2),
        "realized_pnl": round(realized_pnl, 2),
        "net_worth": round(total_savings + realized_pnl, 2),
        "accounts_count": len(savings),
        "business_count": len(businesses),
    }


# ---------------------------------------------------------------------------
# Market data (crypto = real CoinGecko, others = realistic simulation)
# ---------------------------------------------------------------------------
SYMBOL_CATALOG = [
    {"symbol": "BTC", "name": "Bitcoin", "type": "crypto", "coingecko_id": "bitcoin"},
    {"symbol": "ETH", "name": "Ethereum", "type": "crypto", "coingecko_id": "ethereum"},
    {"symbol": "SOL", "name": "Solana", "type": "crypto", "coingecko_id": "solana"},
    {"symbol": "XRP", "name": "XRP", "type": "crypto", "coingecko_id": "ripple"},
    {"symbol": "DOGE", "name": "Dogecoin", "type": "crypto", "coingecko_id": "dogecoin"},
    {"symbol": "ADA", "name": "Cardano", "type": "crypto", "coingecko_id": "cardano"},
    {"symbol": "AVAX", "name": "Avalanche", "type": "crypto", "coingecko_id": "avalanche-2"},
    {"symbol": "LINK", "name": "Chainlink", "type": "crypto", "coingecko_id": "chainlink"},
    {"symbol": "AAPL", "name": "Apple Inc.", "type": "stock", "base_price": 227.5},
    {"symbol": "TSLA", "name": "Tesla Inc.", "type": "stock", "base_price": 342.0},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "type": "stock", "base_price": 138.0},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "type": "stock", "base_price": 438.0},
    {"symbol": "AMZN", "name": "Amazon.com", "type": "stock", "base_price": 205.0},
    {"symbol": "META", "name": "Meta Platforms", "type": "stock", "base_price": 605.0},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "type": "stock", "base_price": 175.0},
    {"symbol": "EUR/USD", "name": "Euro / US Dollar", "type": "forex", "base_price": 1.0785},
    {"symbol": "GBP/USD", "name": "Pound / US Dollar", "type": "forex", "base_price": 1.268},
    {"symbol": "USD/JPY", "name": "US Dollar / Yen", "type": "forex", "base_price": 156.4},
    {"symbol": "SPX", "name": "S&P 500", "type": "index", "base_price": 5970.0},
    {"symbol": "NDX", "name": "Nasdaq 100", "type": "index", "base_price": 21300.0},
    {"symbol": "DJI", "name": "Dow Jones", "type": "index", "base_price": 44200.0},
    {"symbol": "DAX", "name": "DAX 40", "type": "index", "base_price": 19900.0},
]

_cg_cache = {"ts": 0, "data": {}}


async def _coingecko_prices(ids: List[str]) -> dict:
    if not ids:
        return {}
    now = _time.time()
    if now - _cg_cache["ts"] < 20 and all(i in _cg_cache["data"] for i in ids):
        return {i: _cg_cache["data"][i] for i in ids}
    try:
        async with httpx.AsyncClient(timeout=8) as cx:
            r = await cx.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": ",".join(ids), "vs_currencies": "usd", "include_24hr_change": "true"},
            )
            data = r.json()
        parsed = {k: {"price": v.get("usd", 0), "change": v.get("usd_24h_change", 0)} for k, v in data.items()}
        _cg_cache["data"].update(parsed)
        _cg_cache["ts"] = now
        return parsed
    except Exception as e:
        logger.warning(f"CoinGecko error: {e}")
        return {i: _cg_cache["data"].get(i, {"price": 0, "change": 0}) for i in ids}


def _sim_quote(symbol: str, base: float) -> dict:
    # Deterministic-ish daily drift + intraday noise so it feels alive but stable across refreshes
    day_seed = int(datetime.now(NL_TZ).strftime("%Y%m%d"))
    rnd = random.Random(hash(symbol) ^ day_seed)
    drift = rnd.uniform(-0.03, 0.03)
    minute = datetime.now(timezone.utc).timestamp() / 60
    intraday = math.sin(minute / 30 + hash(symbol) % 10) * 0.012
    price = base * (1 + drift + intraday)
    change = (drift + intraday) * 100
    return {"price": round(price, 4 if price < 10 else 2), "change": round(change, 2)}


@api_router.get("/market/catalog")
async def market_catalog():
    return SYMBOL_CATALOG


@api_router.get("/watchlist")
async def get_watchlist():
    items = await db.watchlist.find({}, {"_id": 0}).to_list(200)
    if not items:
        defaults = ["BTC", "ETH", "SOL", "AAPL", "TSLA", "NVDA", "EUR/USD", "SPX"]
        for sym in defaults:
            meta = next((c for c in SYMBOL_CATALOG if c["symbol"] == sym), None)
            if meta:
                await db.watchlist.insert_one({
                    "id": str(uuid.uuid4()), "symbol": meta["symbol"], "name": meta["name"],
                    "type": meta["type"], "coingecko_id": meta.get("coingecko_id", ""),
                    "base_price": meta.get("base_price", 0),
                })
        items = await db.watchlist.find({}, {"_id": 0}).to_list(200)
    return items


@api_router.post("/watchlist")
async def add_watchlist(data: WatchlistInput, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump()}
    await db.watchlist.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/watchlist/{item_id}")
async def del_watchlist(item_id: str, _: dict = Depends(require_admin)):
    await db.watchlist.delete_one({"id": item_id})
    return {"ok": True}


@api_router.get("/market/quotes")
async def market_quotes():
    items = await db.watchlist.find({}, {"_id": 0}).to_list(200)
    crypto = [i for i in items if i["type"] == "crypto" and i.get("coingecko_id")]
    cg = await _coingecko_prices([i["coingecko_id"] for i in crypto])
    out = []
    for i in items:
        if i["type"] == "crypto" and i.get("coingecko_id") in cg:
            q = cg[i["coingecko_id"]]
        else:
            base = i.get("base_price") or 100
            q = _sim_quote(i["symbol"], base)
        out.append({"id": i["id"], "symbol": i["symbol"], "name": i["name"], "type": i["type"],
                    "price": q["price"], "change": q["change"]})
    return out


# ---------------------------------------------------------------------------
# Trade journal
# ---------------------------------------------------------------------------
def _trade_pnl(t: dict) -> float:
    if t.get("exit_price") is None:
        return 0.0
    diff = (t["exit_price"] - t["entry_price"]) * (1 if t["side"] == "long" else -1)
    return round(diff * t.get("size", 1), 2)


def _compute_size(d: dict) -> dict:
    # If a dollar margin is given, derive the position size (lots/units) from margin * leverage / entry.
    if d.get("margin") and d.get("entry_price"):
        lev = d.get("leverage") or 1
        d["size"] = round(d["margin"] * lev / d["entry_price"], 8)
    d["notional"] = round(d.get("size", 0) * d.get("entry_price", 0), 2)
    return d


@api_router.get("/trades")
async def list_trades():
    trades = await db.trades.find({}, {"_id": 0}).sort("opened_at", -1).to_list(1000)
    for t in trades:
        t["pnl"] = _trade_pnl(t)
    return trades


@api_router.post("/trades")
async def create_trade(data: TradeInput, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump()}
    doc["opened_at"] = doc.get("opened_at") or datetime.now(NL_TZ).isoformat()
    if doc["status"] == "closed" and not doc.get("closed_at"):
        doc["closed_at"] = datetime.now(NL_TZ).isoformat()
    _compute_size(doc)
    await db.trades.insert_one(doc)
    doc.pop("_id", None)
    doc["pnl"] = _trade_pnl(doc)
    await record_networth_snapshot()
    return doc


@api_router.put("/trades/{item_id}")
async def update_trade(item_id: str, data: TradeInput, _: dict = Depends(require_admin)):
    upd = data.model_dump()
    if upd["status"] == "closed" and not upd.get("closed_at"):
        upd["closed_at"] = datetime.now(NL_TZ).isoformat()
    _compute_size(upd)
    await db.trades.update_one({"id": item_id}, {"$set": upd})
    t = await db.trades.find_one({"id": item_id}, {"_id": 0})
    t["pnl"] = _trade_pnl(t)
    await record_networth_snapshot()
    return t


@api_router.delete("/trades/{item_id}")
async def delete_trade(item_id: str, _: dict = Depends(require_admin)):
    await db.trades.delete_one({"id": item_id})
    await record_networth_snapshot()
    return {"ok": True}


@api_router.get("/trades/summary")
async def trades_summary():
    trades = await db.trades.find({}, {"_id": 0}).to_list(1000)
    closed = [t for t in trades if t.get("status") == "closed" and t.get("exit_price") is not None]
    pnls = [_trade_pnl(t) for t in closed]
    wins = [p for p in pnls if p > 0]
    total = sum(pnls)
    return {
        "total_trades": len(trades),
        "open_trades": len([t for t in trades if t.get("status") == "open"]),
        "closed_trades": len(closed),
        "total_pnl": round(total, 2),
        "win_rate": round(len(wins) / len(closed) * 100, 1) if closed else 0,
        "best": round(max(pnls), 2) if pnls else 0,
        "worst": round(min(pnls), 2) if pnls else 0,
    }


# ---------------------------------------------------------------------------
# Growth metrics (gym / finance / mind / mental / custom)
# ---------------------------------------------------------------------------
METRIC_DEFS = [
    {"key": "weight", "label": "Body weight", "category": "gym", "unit": "kg"},
    {"key": "body_fat", "label": "Body fat", "category": "gym", "unit": "%"},
    {"key": "bench_press", "label": "Bench press", "category": "gym", "unit": "kg"},
    {"key": "squat", "label": "Squat", "category": "gym", "unit": "kg"},
    {"key": "deadlift", "label": "Deadlift", "category": "gym", "unit": "kg"},
    {"key": "net_worth", "label": "Net worth", "category": "finance", "unit": "€"},
    {"key": "iq", "label": "IQ test score", "category": "mind", "unit": "pts"},
    {"key": "reading_pages", "label": "Pages read", "category": "mind", "unit": "pages"},
    {"key": "focus", "label": "Focus", "category": "mind", "unit": "/10"},
    {"key": "mood", "label": "Mood", "category": "mental", "unit": "/10"},
    {"key": "energy", "label": "Energy", "category": "mental", "unit": "/10"},
    {"key": "stress", "label": "Stress", "category": "mental", "unit": "/10"},
    {"key": "sleep", "label": "Sleep", "category": "mental", "unit": "hrs"},
    {"key": "meditation", "label": "Meditation", "category": "mental", "unit": "min"},
]


@api_router.get("/metrics")
async def get_metrics():
    custom = await db.custom_metrics.find({}, {"_id": 0}).to_list(200)
    return METRIC_DEFS + custom


@api_router.post("/metrics")
async def add_metric(payload: dict, _: dict = Depends(require_admin)):
    doc = {
        "key": payload["key"].strip().lower().replace(" ", "_"),
        "label": payload.get("label", payload["key"]),
        "category": payload.get("category", "custom"),
        "unit": payload.get("unit", ""),
    }
    await db.custom_metrics.update_one({"key": doc["key"]}, {"$set": doc}, upsert=True)
    return doc


@api_router.get("/growth")
async def list_growth(metric: Optional[str] = None, category: Optional[str] = None):
    q = {}
    if metric:
        q["metric"] = metric
    if category:
        q["category"] = category
    entries = await db.growth_entries.find(q, {"_id": 0}).sort("date", 1).to_list(5000)
    return entries


@api_router.post("/growth")
async def add_growth(data: GrowthInput, _: dict = Depends(require_admin)):
    doc = {
        "id": str(uuid.uuid4()),
        "metric": data.metric,
        "category": data.category,
        "value": data.value,
        "date": data.date or datetime.now(NL_TZ).date().isoformat(),
        "note": data.note,
    }
    await db.growth_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.delete("/growth/{item_id}")
async def delete_growth(item_id: str, _: dict = Depends(require_admin)):
    await db.growth_entries.delete_one({"id": item_id})
    return {"ok": True}


@api_router.post("/growth/snapshot-networth")
async def snapshot_networth(_: dict = Depends(require_admin)):
    savings = await db.savings.find({}, {"_id": 0}).to_list(500)
    total = sum(s.get("balance", 0) for s in savings)
    doc = {"id": str(uuid.uuid4()), "metric": "net_worth", "category": "finance",
           "value": round(total, 2), "date": datetime.now(NL_TZ).date().isoformat(), "note": "auto snapshot"}
    await db.growth_entries.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Relationships
# ---------------------------------------------------------------------------
@api_router.get("/relationships")
async def list_people():
    return await db.people.find({}, {"_id": 0}).to_list(500)


@api_router.post("/relationships")
async def add_person(data: PersonInput, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "logs": []}
    await db.people.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/relationships/{item_id}")
async def update_person(item_id: str, data: PersonInput, _: dict = Depends(require_admin)):
    await db.people.update_one({"id": item_id}, {"$set": data.model_dump()})
    return await db.people.find_one({"id": item_id}, {"_id": 0})


@api_router.post("/relationships/{item_id}/logs")
async def add_interaction(item_id: str, data: InteractionInput, _: dict = Depends(require_admin)):
    log = {"id": str(uuid.uuid4()), "date": data.date or datetime.now(NL_TZ).date().isoformat(),
           "quality": data.quality, "note": data.note}
    await db.people.update_one({"id": item_id}, {"$push": {"logs": log}, "$set": {"last_contact": log["date"]}})
    return await db.people.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/relationships/{item_id}")
async def delete_person(item_id: str, _: dict = Depends(require_admin)):
    await db.people.delete_one({"id": item_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Books
# ---------------------------------------------------------------------------
@api_router.get("/books")
async def list_books():
    return await db.books.find({}, {"_id": 0}).to_list(1000)


@api_router.post("/books")
async def add_book(data: BookInput, _: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.books.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/books/{item_id}")
async def update_book(item_id: str, data: BookInput, _: dict = Depends(require_admin)):
    await db.books.update_one({"id": item_id}, {"$set": data.model_dump()})
    return await db.books.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/books/{item_id}")
async def delete_book(item_id: str, _: dict = Depends(require_admin)):
    await db.books.delete_one({"id": item_id})
    return {"ok": True}


@api_router.get("/books/summary")
async def books_summary():
    books = await db.books.find({}, {"_id": 0}).to_list(1000)
    finished = [b for b in books if b.get("status") == "finished"]
    pages = sum(b.get("total_pages", 0) for b in finished) + sum(
        b.get("current_page", 0) for b in books if b.get("status") == "reading")
    ratings = [b.get("rating", 0) for b in finished if b.get("rating")]
    return {
        "total": len(books),
        "finished": len(finished),
        "reading": len([b for b in books if b.get("status") == "reading"]),
        "to_read": len([b for b in books if b.get("status") == "to_read"]),
        "pages_read": pages,
        "avg_rating": round(sum(ratings) / len(ratings), 1) if ratings else 0,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.daily_logs.create_index("date", unique=True)
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Owner",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin user seeded")
    elif not verify_password(ADMIN_PASSWORD, existing["password_hash"]):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})
        logger.info("Admin password updated")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
