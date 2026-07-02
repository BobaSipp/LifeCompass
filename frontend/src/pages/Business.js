import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, TrendingUp, TrendingDown, Users, Globe, Briefcase, Share2 } from "lucide-react";

const STATUS_STYLE = {
  active: "bg-emerald-50 text-emerald-700",
  paused: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  sold: "bg-blue-50 text-blue-700",
};
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import StatCard from "@/components/StatCard";

export default function Business() {
  const { isOwner } = useAuth();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [show, setShow] = useState(false);

  const load = useCallback(() => {
    api.get("/business").then((r) => setItems(r.data));
    api.get("/finance/summary").then((r) => setSummary(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => { await api.delete(`/business/${id}`); toast.success("Business removed"); load(); };

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Ventures"
        title="Business Tracker"
        subtitle="Monitor each venture's monthly revenue, costs and profit in one place."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard testid="biz-revenue" label="Monthly revenue" value={summary ? eur(summary.business_monthly_revenue) : "—"} accent="text-emerald-600" icon={TrendingUp} />
        <StatCard testid="biz-costs" label="Monthly costs" value={summary ? eur(summary.business_monthly_costs) : "—"} accent="text-red-600" icon={TrendingDown} />
        <StatCard testid="biz-profit" label="Monthly profit" value={summary ? eur(summary.business_monthly_profit) : "—"} sub={`${summary?.business_count || 0} ventures`} accent={summary && summary.business_monthly_profit < 0 ? "text-red-600" : "text-gray-900"} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-xl font-semibold tracking-tight text-gray-900">Ventures</h3>
        <button data-testid="add-business" onClick={() => setShow(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          <Plus className="h-4 w-4" /> Add venture
        </button>
      </div>

      {items.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm font-medium text-gray-400">No ventures yet. Add your first business to start tracking.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => {
            const profit = (b.monthly_revenue || 0) - (b.monthly_costs || 0);
            const isSocial = b.kind === "social";
            const failed = b.status === "failed";
            return (
              <div key={b.id} data-testid={`business-${b.id}`} className={`rounded-md border bg-white p-6 ${failed ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {isSocial ? <Share2 className="h-4 w-4 text-gray-400" /> : <Briefcase className="h-4 w-4 text-gray-400" />}
                    <div>
                      <h4 className={`text-lg font-bold tracking-tight ${failed ? "text-gray-500 line-through" : "text-gray-900"}`}>{b.name}</h4>
                      {isSocial && (b.platform || b.handle) && (
                        <p className="text-xs text-gray-400">{b.platform}{b.handle ? ` · @${b.handle}` : ""}</p>
                      )}
                    </div>
                  </div>
                  <button data-testid={`del-business-${b.id}`} onClick={() => del(b.id)} className="text-gray-300 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLE[b.status] || "bg-gray-100 text-gray-600"}`}>{b.status}</span>
                  {isSocial && (
                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600">
                      <Users className="h-3 w-3" /> {Number(b.followers || 0).toLocaleString()}
                    </span>
                  )}
                  {b.url && (
                    <a href={b.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-600 hover:text-gray-900">
                      <Globe className="h-3 w-3" /> link
                    </a>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <Row label="Revenue" value={eur(b.monthly_revenue)} cls="text-emerald-600" />
                  <Row label="Costs" value={eur(b.monthly_costs)} cls="text-red-600" />
                  <div className="border-t border-gray-100 pt-2">
                    <Row label="Profit" value={eur(profit)} cls={profit < 0 ? "text-red-600" : "text-gray-900"} bold />
                  </div>
                </div>
                {failed && b.fail_reason && (
                  <p className="mt-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Why it failed: {b.fail_reason}</p>
                )}
                {b.notes && <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">{b.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {show && <BusinessModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
    </div>
  );
}

function Row({ label, value, cls, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`${bold ? "font-semibold text-gray-900" : "text-gray-500"}`}>{label}</span>
      <span className={`font-mono ${bold ? "font-semibold" : ""} ${cls}`}>{value}</span>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500";

function BusinessModal({ onClose, onSaved }) {
  const [f, setF] = useState({ name: "", kind: "business", platform: "", handle: "", url: "", status: "active", followers: "", monthly_revenue: "", monthly_costs: "", fail_reason: "", notes: "" });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/business", {
        name: f.name, kind: f.kind, platform: f.platform, handle: f.handle, url: f.url,
        status: f.status, followers: Number(f.followers) || 0,
        monthly_revenue: Number(f.monthly_revenue) || 0, monthly_costs: Number(f.monthly_costs) || 0,
        fail_reason: f.fail_reason, notes: f.notes,
      });
      toast.success("Venture added");
      onSaved();
    } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-gray-200 bg-white p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Add venture</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[["business", "Business"], ["social", "Social account"]].map(([v, l]) => (
              <button key={v} type="button" data-testid={`biz-kind-${v}`} onClick={() => set("kind", v)}
                className={`rounded-md border py-2 text-sm font-medium ${f.kind === v ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{l}</button>
            ))}
          </div>
          <div><label className={labelCls}>{f.kind === "social" ? "Account name" : "Business name"}</label><input data-testid="business-name" className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} required placeholder={f.kind === "social" ? "e.g. My IG page" : "e.g. My Agency"} /></div>
          {f.kind === "social" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Platform</label><input data-testid="business-platform" className={inputCls} value={f.platform} onChange={(e) => set("platform", e.target.value)} placeholder="Instagram" /></div>
              <div><label className={labelCls}>Handle</label><input data-testid="business-handle" className={inputCls} value={f.handle} onChange={(e) => set("handle", e.target.value)} placeholder="username" /></div>
              <div><label className={labelCls}>Followers</label><input data-testid="business-followers" type="number" className={inputCls} value={f.followers} onChange={(e) => set("followers", e.target.value)} placeholder="0" /></div>
              <div><label className={labelCls}>URL</label><input data-testid="business-url" className={inputCls} value={f.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></div>
            </div>
          )}
          <div>
            <label className={labelCls}>Status</label>
            <div className="grid grid-cols-4 gap-2">
              {["active", "paused", "failed", "sold"].map((s) => (
                <button key={s} type="button" data-testid={`biz-status-${s}`} onClick={() => set("status", s)}
                  className={`rounded-md border py-2 text-xs font-medium capitalize ${f.status === s ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Revenue / mo (€)</label><input data-testid="business-revenue" type="number" step="0.01" className={inputCls} value={f.monthly_revenue} onChange={(e) => set("monthly_revenue", e.target.value)} placeholder="0" /></div>
            <div><label className={labelCls}>Costs / mo (€)</label><input data-testid="business-costs" type="number" step="0.01" className={inputCls} value={f.monthly_costs} onChange={(e) => set("monthly_costs", e.target.value)} placeholder="0" /></div>
          </div>
          {f.status === "failed" && (
            <div><label className={labelCls}>Why did it fail?</label><input data-testid="business-fail" className={inputCls} value={f.fail_reason} onChange={(e) => set("fail_reason", e.target.value)} placeholder="Lesson learned" /></div>
          )}
          <div><label className={labelCls}>Notes</label><textarea data-testid="business-notes" rows={2} className={`${inputCls} resize-none`} value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" /></div>
          <button data-testid="business-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Add venture</button>
        </form>
      </div>
    </div>
  );
}
