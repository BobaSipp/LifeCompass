import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, TrendingUp, TrendingDown, Activity, Search } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import StatCard from "@/components/StatCard";
import useLiveQuotes from "@/lib/useLiveQuotes";

const fmtPrice = (p, type) =>
  type === "forex" ? p.toFixed(4) : p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 2 }) : p.toFixed(2);

const typeBadge = {
  crypto: "bg-amber-50 text-amber-700",
  stock: "bg-blue-50 text-blue-700",
  forex: "bg-purple-50 text-purple-700",
  index: "bg-emerald-50 text-emerald-700",
  custom: "bg-gray-100 text-gray-600",
};

export default function Trading() {
  const { isOwner } = useAuth();
  const quotes = useLiveQuotes();
  const [summary, setSummary] = useState(null);
  const [trades, setTrades] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showTrade, setShowTrade] = useState(false);

  const load = useCallback(() => {
    api.get("/trades/summary").then((r) => setSummary(r.data));
    api.get("/trades").then((r) => setTrades(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const delWatch = async (id) => { await api.delete(`/watchlist/${id}`); toast.success("Removed"); };
  const delTrade = async (id) => { await api.delete(`/trades/${id}`); load(); };
  const closeTrade = async (t) => {
    const q = quotes.find((x) => x.symbol === t.symbol);
    const exit = q ? Number(q.live.toFixed(4)) : t.entry_price;
    await api.put(`/trades/${t.id}`, { ...t, status: "closed", exit_price: exit });
    toast.success("Trade closed");
    load();
  };

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Markets"
        title="Trading Desk"
        subtitle="Live crypto (real CoinGecko prices) plus simulated stocks, forex & indices — with a full trade journal."
        action={
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <Activity className="h-3.5 w-3.5 animate-pulse" /> LIVE
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <StatCard testid="trade-pnl" label="Realized P&L" value={summary ? `$${summary.total_pnl}` : "—"} accent={summary && summary.total_pnl < 0 ? "text-red-600" : "text-emerald-600"} />
        <StatCard testid="trade-winrate" label="Win rate" value={summary ? `${summary.win_rate}%` : "—"} sub={summary ? `${summary.closed_trades} closed` : ""} />
        <StatCard testid="trade-open" label="Open positions" value={summary ? summary.open_trades : "—"} />
        <StatCard testid="trade-best" label="Best / Worst" value={summary ? `$${summary.best}` : "—"} sub={summary ? `$${summary.worst} worst` : ""} accent="text-gray-900" />
      </div>

      {/* Watchlist */}
      <div className="mt-8 rounded-md border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Watchlist</h3>
          <button data-testid="add-symbol" onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Add symbol
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quotes.map((q) => (
            <div key={q.id} data-testid={`quote-${q.symbol}`} className="group relative rounded-md border border-gray-200 p-4 transition-colors hover:border-gray-300">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-gray-900">{q.symbol}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${typeBadge[q.type]}`}>{q.type}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-400">{q.name}</p>
                </div>
                <button data-testid={`del-symbol-${q.symbol}`} onClick={() => delWatch(q.id)} className="text-gray-200 opacity-0 transition group-hover:opacity-100 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <span className={`font-mono text-lg font-semibold tabular-nums transition-colors ${q.dir > 0 ? "text-emerald-600" : q.dir < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {q.type === "forex" ? "" : "$"}{fmtPrice(q.live, q.type)}
                </span>
                <span className={`flex items-center gap-0.5 text-xs font-semibold ${q.change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {q.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {q.change >= 0 ? "+" : ""}{q.change.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trade journal */}
      <div className="mt-6 rounded-md border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Trade Journal</h3>
          <button data-testid="add-trade" onClick={() => setShowTrade(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Log trade
          </button>
        </div>
        {trades.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No trades logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                  <th className="pb-3">Symbol</th><th className="pb-3">Side</th>
                  <th className="pb-3 text-right">Lev</th>
                  <th className="pb-3 text-right">Entry</th><th className="pb-3 text-right">Exit</th>
                  <th className="pb-3 text-right">Size</th><th className="pb-3 text-right">P&L</th>
                  <th className="pb-3">Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} data-testid={`trade-${t.id}`} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 font-mono font-semibold text-gray-900">{t.symbol}</td>
                    <td className="py-3"><span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${t.side === "long" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{t.side}</span></td>
                    <td className="py-3 text-right font-mono text-gray-500">{t.leverage || 1}x</td>
                    <td className="py-3 text-right font-mono">{t.entry_price}</td>
                    <td className="py-3 text-right font-mono">{t.exit_price ?? "—"}</td>
                    <td className="py-3 text-right font-mono">{t.size}</td>
                    <td className={`py-3 text-right font-mono font-semibold ${t.pnl > 0 ? "text-emerald-600" : t.pnl < 0 ? "text-red-600" : "text-gray-400"}`}>{t.status === "closed" ? `$${t.pnl}` : "—"}</td>
                    <td className="py-3"><span className={`rounded px-2 py-0.5 text-xs font-medium ${t.status === "open" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>{t.status}</span></td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {t.status === "open" && <button data-testid={`close-trade-${t.id}`} onClick={() => closeTrade(t)} className="text-xs font-semibold text-blue-600 hover:underline">Close</button>}
                        <button data-testid={`del-trade-${t.id}`} onClick={() => delTrade(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && <AddSymbolModal onClose={() => setShowAdd(false)} />}
      {showTrade && <TradeModal quotes={quotes} onClose={() => setShowTrade(false)} onSaved={() => { setShowTrade(false); load(); }} />}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500";

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddSymbolModal({ onClose }) {
  const [catalog, setCatalog] = useState([]);
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState({ symbol: "", name: "", type: "custom", base_price: "" });
  useEffect(() => { api.get("/market/catalog").then((r) => setCatalog(r.data)); }, []);
  const add = async (item) => {
    try { await api.post("/watchlist", item); toast.success(`${item.symbol} added`); onClose(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const filtered = catalog.filter((c) => `${c.symbol} ${c.name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <ModalShell title="Add symbol" onClose={onClose}>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input data-testid="symbol-search" className={`${inputCls} pl-9`} placeholder="Search BTC, AAPL, EUR/USD…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="max-h-52 space-y-1 overflow-y-auto">
        {filtered.map((c) => (
          <button key={c.symbol} data-testid={`catalog-${c.symbol}`} onClick={() => add({ symbol: c.symbol, name: c.name, type: c.type, coingecko_id: c.coingecko_id || "", base_price: c.base_price || 0 })}
            className="flex w-full items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50">
            <span><span className="font-mono font-semibold">{c.symbol}</span> <span className="text-gray-400">{c.name}</span></span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${typeBadge[c.type]}`}>{c.type}</span>
          </button>
        ))}
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Custom symbol</p>
        <div className="grid grid-cols-2 gap-2">
          <input data-testid="custom-symbol" className={inputCls} placeholder="Ticker" value={custom.symbol} onChange={(e) => setCustom({ ...custom, symbol: e.target.value })} />
          <input data-testid="custom-price" type="number" className={inputCls} placeholder="Base price" value={custom.base_price} onChange={(e) => setCustom({ ...custom, base_price: e.target.value })} />
        </div>
        <input data-testid="custom-name" className={`${inputCls} mt-2`} placeholder="Name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
        <button data-testid="add-custom-symbol" onClick={() => custom.symbol && add({ symbol: custom.symbol.toUpperCase(), name: custom.name, type: "custom", base_price: Number(custom.base_price) || 100 })}
          className="mt-2 w-full rounded-md bg-gray-900 py-2 text-sm font-semibold text-white hover:bg-gray-800">Add custom</button>
      </div>
    </ModalShell>
  );
}

function TradeModal({ quotes, onClose, onSaved }) {
  const [f, setF] = useState({ symbol: "", asset_type: "crypto", side: "long", entry_price: "", margin: "", leverage: 1, status: "open", exit_price: "", notes: "" });
  const entry = Number(f.entry_price) || 0;
  const margin = Number(f.margin) || 0;
  const lev = Number(f.leverage) || 1;
  const notional = margin * lev;
  const size = entry > 0 ? notional / entry : 0;
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/trades", {
        symbol: f.symbol.toUpperCase(), asset_type: f.asset_type, side: f.side,
        entry_price: entry, margin, leverage: lev, size, status: f.status,
        exit_price: f.status === "closed" && f.exit_price ? Number(f.exit_price) : null, notes: f.notes,
      });
      toast.success("Trade logged");
      onSaved();
    } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  const pick = (sym) => {
    const q = quotes.find((x) => x.symbol === sym);
    setF((p) => ({ ...p, symbol: sym, asset_type: q?.type || "crypto", entry_price: q ? q.live.toFixed(q.type === "forex" ? 4 : 2) : "" }));
  };
  return (
    <ModalShell title="Log trade" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>Symbol</label>
          <input data-testid="trade-symbol" list="sym-list" className={inputCls} value={f.symbol} onChange={(e) => pick(e.target.value.toUpperCase())} required placeholder="BTC" />
          <datalist id="sym-list">{quotes.map((q) => <option key={q.id} value={q.symbol} />)}</datalist>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {["long", "short"].map((s) => (
            <button key={s} type="button" data-testid={`trade-side-${s}`} onClick={() => setF({ ...f, side: s })}
              className={`rounded-md border py-2 text-sm font-medium capitalize ${f.side === s ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{s}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Entry price</label><input data-testid="trade-entry" type="number" step="any" className={inputCls} value={f.entry_price} onChange={(e) => setF({ ...f, entry_price: e.target.value })} required /></div>
          <div><label className={labelCls}>Amount ($)</label><input data-testid="trade-margin" type="number" step="any" className={inputCls} value={f.margin} onChange={(e) => setF({ ...f, margin: e.target.value })} placeholder="e.g. 500" required /></div>
        </div>
        <div>
          <label className={labelCls}>Leverage: {lev}x</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 5, 10, 20, 50, 100].map((x) => (
              <button key={x} type="button" data-testid={`trade-lev-${x}`} onClick={() => setF({ ...f, leverage: x })}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${lev === x ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{x}x</button>
            ))}
            <input data-testid="trade-lev-custom" type="number" step="any" min="1" value={f.leverage} onChange={(e) => setF({ ...f, leverage: e.target.value })}
              className="w-20 rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-gray-900" />
          </div>
        </div>

        <div data-testid="trade-calc" className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-500">Position size (lots/units)</span>
            <span data-testid="trade-size-calc" className="font-mono font-semibold text-gray-900">{size ? size.toFixed(size < 1 ? 6 : 4) : "—"}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-gray-500">Notional exposure</span>
            <span className="font-mono font-semibold text-gray-900">${notional ? notional.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0"}</span>
          </div>
          <p className="mt-2 text-[10px] text-gray-400">Size = amount × leverage ÷ entry price. Auto-calculated for you.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {["open", "closed"].map((s) => (
            <button key={s} type="button" data-testid={`trade-status-${s}`} onClick={() => setF({ ...f, status: s })}
              className={`rounded-md border py-2 text-sm font-medium capitalize ${f.status === s ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{s}</button>
          ))}
        </div>
        {f.status === "closed" && (
          <div><label className={labelCls}>Exit price</label><input data-testid="trade-exit" type="number" step="any" className={inputCls} value={f.exit_price} onChange={(e) => setF({ ...f, exit_price: e.target.value })} /></div>
        )}
        <div><label className={labelCls}>Notes</label><input data-testid="trade-notes" className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Setup / reason" /></div>
        <button data-testid="trade-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Save trade</button>
      </form>
    </ModalShell>
  );
}
