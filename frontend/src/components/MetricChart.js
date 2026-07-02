import { useEffect, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function MetricChart({ metric }) {
  const { isOwner } = useAuth();
  const [entries, setEntries] = useState([]);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    api.get(`/growth?metric=${metric.key}`).then((r) => setEntries(r.data));
  }, [metric.key]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (value === "") return;
    try {
      await api.post("/growth", { metric: metric.key, category: metric.category, value: Number(value), note });
      setValue(""); setNote("");
      toast.success(`${metric.label} logged`);
      load();
    } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/growth/${id}`); load(); };

  const chartData = entries.map((e) => ({ date: e.date?.slice(5), value: e.value, id: e.id }));
  const latest = entries.length ? entries[entries.length - 1].value : null;
  const first = entries.length ? entries[0].value : null;
  const delta = latest != null && first != null ? latest - first : null;

  return (
    <div data-testid={`metric-${metric.key}`} className="rounded-md border border-gray-200 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{metric.label}</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-gray-900">
            {latest != null ? latest : "—"} <span className="text-sm font-medium text-gray-400">{metric.unit}</span>
          </p>
        </div>
        {delta != null && delta !== 0 && (
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {delta > 0 ? "+" : ""}{delta.toFixed(1)}
          </span>
        )}
      </div>

      <div className="mt-4 h-36">
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} width={40} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
              <Line type="monotone" dataKey="value" stroke="#111827" strokeWidth={2} dot={{ r: 2, fill: "#111827" }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed border-gray-200 text-xs text-gray-400">
            Log at least 2 entries to see the trend
          </div>
        )}
      </div>

      <form onSubmit={add} className="mt-3 flex items-center gap-2">
        <input data-testid={`metric-value-${metric.key}`} type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={`New ${metric.unit || "value"}`} className="w-28 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" />
        <input data-testid={`metric-note-${metric.key}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
          className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" />
        <button data-testid={`metric-add-${metric.key}`} type="submit" className="rounded-md bg-gray-900 p-1.5 text-white hover:bg-gray-800"><Plus className="h-4 w-4" /></button>
      </form>

      {entries.length > 0 && (
        <div className="mt-3 max-h-24 space-y-1 overflow-y-auto border-t border-gray-100 pt-2">
          {[...entries].reverse().slice(0, 6).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs text-gray-500">
              <span><span className="font-mono text-gray-700">{e.value}</span> · {e.date} {e.note && <span className="text-gray-400">· {e.note}</span>}</span>
              {isOwner && <button data-testid={`metric-del-${e.id}`} onClick={() => del(e.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
