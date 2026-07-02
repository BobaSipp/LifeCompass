import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check, ChevronLeft, ChevronRight, Dumbbell, Clock } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";

const NL_TODAY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
const fmt = (d) => new Intl.DateTimeFormat("en-CA").format(d);
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const statusColor = {
  complete: "bg-emerald-600 text-white border-emerald-600",
  partial: "bg-emerald-100 text-emerald-800 border-emerald-200",
  logged: "bg-amber-100 text-amber-800 border-amber-200",
  none: "bg-white text-gray-400 border-gray-200",
};

export default function DailyLog() {
  const { isOwner } = useAuth();
  const [logs, setLogs] = useState([]);
  const [cursor, setCursor] = useState(() => new Date(NL_TODAY()));
  const [selected, setSelected] = useState(NL_TODAY());
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(() => api.get("/daily").then((r) => setLogs(r.data)), []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const [businesses, setBusinesses] = useState([]);
  useEffect(() => { api.get("/business").then((r) => setBusinesses(r.data)); }, []);

  const loadDay = useCallback((date) => {
    api.get(`/daily/${date}`).then((r) =>
      setEditing({
        tasks: r.data.tasks || [],
        workouts: r.data.workouts || [],
        did_right: r.data.did_right || "",
        did_wrong: r.data.did_wrong || "",
        set_before_9am: r.data.set_before_9am,
        status: r.data.status,
      })
    );
  }, []);
  useEffect(() => { loadDay(selected); }, [selected, loadDay]);

  const logMap = {};
  logs.forEach((l) => (logMap[l.date] = l));

  // Build calendar grid (Mon-first)
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const save = async () => {
    if (!isOwner) return;
    setSaving(true);
    try {
      await api.put(`/daily/${selected}`, {
        tasks: editing.tasks,
        workouts: editing.workouts,
        did_right: editing.did_right,
        did_wrong: editing.did_wrong,
      });
      toast.success("Day saved");
      await loadAll();
      await loadDay(selected);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  const upd = (fn) => setEditing((prev) => { const n = structuredClone(prev); fn(n); return n; });

  const nowNL = () => new Date(new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Amsterdam", hour: "numeric", hour12: false }).format(new Date()));

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Discipline"
        title="Daily Log"
        subtitle="Set your tasks before 9AM (Dutch time). A day only turns fully green when tasks were set before 9AM and all are completed."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        {/* Calendar */}
        <div className="rounded-md border border-gray-200 bg-white p-6 xl:col-span-3">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">
              {MONTHS[month]} {year}
            </h3>
            <div className="flex gap-1">
              <button data-testid="cal-prev" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-md border border-gray-200 p-1.5 hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button data-testid="cal-next" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-md border border-gray-200 p-1.5 hover:bg-gray-50">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {DOW.map((d) => (
              <div key={d} className="pb-2 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{d}</div>
            ))}
            {cells.map((date, i) => {
              if (!date) return <div key={i} />;
              const key = fmt(date);
              const log = logMap[key];
              const status = log ? log.status : "none";
              const isToday = key === NL_TODAY();
              const isSel = key === selected;
              return (
                <button
                  key={key}
                  data-testid={`day-${key}`}
                  onClick={() => setSelected(key)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-md border text-sm font-medium transition-all hover:scale-[1.04] ${statusColor[status]} ${isSel ? "ring-2 ring-gray-900 ring-offset-1" : ""}`}
                >
                  <span className="font-mono">{date.getDate()}</span>
                  {log && log.tasks_total > 0 && (
                    <span className="mt-0.5 text-[9px] font-semibold opacity-80">
                      {log.tasks_done}/{log.tasks_total}
                    </span>
                  )}
                  {isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-4 text-xs font-medium text-gray-500">
            <Legend cls="bg-emerald-600" label="Fully green" />
            <Legend cls="bg-emerald-100 border border-emerald-200" label="Partial" />
            <Legend cls="bg-amber-100 border border-amber-200" label="Logged late" />
            <Legend cls="bg-white border border-gray-200" label="Empty" />
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-md border border-gray-200 bg-white p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">Editing</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">
                {new Date(selected).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}
              </h3>
            </div>
            {editing?.status === "complete" && (
              <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Green</span>
            )}
          </div>

          {editing && (
            <div className="mt-5 space-y-6">
              {selected === NL_TODAY() && editing.tasks.length === 0 && (
                <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
                  <Clock className="h-3.5 w-3.5" />
                  {nowNL().getHours() < 9 ? "Before 9AM — set tasks now to stay green." : "It's past 9AM — tasks set now won't count as on-time."}
                </div>
              )}

              <Section title="Daily Tasks">
                <ItemList items={editing.tasks} isOwner={isOwner} withCategory categories={businesses.map((b) => b.name)}
                  onToggle={(idx) => upd((n) => (n.tasks[idx].done = !n.tasks[idx].done))}
                  onRemove={(idx) => upd((n) => n.tasks.splice(idx, 1))}
                  onEdit={(idx, patch) => upd((n) => Object.assign(n.tasks[idx], patch))}
                  onAdd={(text, category) => upd((n) => n.tasks.push({ id: crypto.randomUUID(), text, done: false, comment: "", category: category || "" }))}
                  testid="task"
                />
              </Section>

              <Section title="Workout" icon={Dumbbell}>
                <ItemList items={editing.workouts} isOwner={isOwner}
                  onToggle={(idx) => upd((n) => (n.workouts[idx].done = !n.workouts[idx].done))}
                  onRemove={(idx) => upd((n) => n.workouts.splice(idx, 1))}
                  onEdit={(idx, patch) => upd((n) => Object.assign(n.workouts[idx], patch))}
                  onAdd={(text) => upd((n) => n.workouts.push({ id: crypto.randomUUID(), text, done: false, comment: "", category: "" }))}
                  testid="workout"
                />
              </Section>

              <Reflection label="What I did right" value={editing.did_right} isOwner={isOwner} testid="did-right"
                onChange={(v) => upd((n) => (n.did_right = v))} />
              <Reflection label="What I did wrong" value={editing.did_wrong} isOwner={isOwner} testid="did-wrong"
                onChange={(v) => upd((n) => (n.did_wrong = v))} />

              {isOwner ? (
                <button data-testid="save-day" onClick={save} disabled={saving}
                  className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-60">
                  {saving ? "Saving…" : "Save day"}
                </button>
              ) : (
                <p className="rounded-md bg-gray-50 px-3 py-2 text-center text-xs font-medium text-gray-400">Read-only — sign in as owner to edit.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Legend({ cls, label }) {
  return <div className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${cls}`} />{label}</div>;
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-gray-500">
        {Icon && <Icon className="h-3.5 w-3.5" />} {title}
      </p>
      {children}
    </div>
  );
}

function ItemList({ items, isOwner, onToggle, onRemove, onEdit, onAdd, testid, withCategory, categories = [] }) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState("");
  return (
    <div className="space-y-1">
      {items.length === 0 && <p className="py-1 text-sm text-gray-400">Nothing yet.</p>}
      {items.map((it, idx) => (
        <div key={it.id} className="border-b border-gray-100 py-2 last:border-0">
          <div className="flex items-center gap-2">
            <button
              data-testid={`${testid}-toggle-${idx}`}
              onClick={() => isOwner && onToggle(idx)}
              disabled={!isOwner}
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                it.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white"
              } ${isOwner ? "cursor-pointer" : "cursor-default"}`}
            >
              {it.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <span className={`flex-1 text-sm ${it.done ? "text-gray-400 line-through" : "text-gray-800"}`}>{it.text}</span>
            {it.category && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">{it.category}</span>}
            <button data-testid={`${testid}-remove-${idx}`} onClick={() => onRemove(idx)} className="text-gray-300 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {it.done && (
            isOwner ? (
              <input
                data-testid={`${testid}-comment-${idx}`}
                value={it.comment || ""}
                onChange={(e) => onEdit(idx, { comment: e.target.value })}
                placeholder="Add a comment about how it went…"
                className="ml-7 mt-1 w-[calc(100%-1.75rem)] rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-xs outline-none focus:border-gray-900"
              />
            ) : it.comment ? (
              <p className="ml-7 mt-1 text-xs text-gray-500">💬 {it.comment}</p>
            ) : null
          )}
        </div>
      ))}
      <form
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim(), cat); setText(""); } }}
        className="flex items-center gap-2 pt-2"
      >
        <input
          data-testid={`${testid}-input`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add item…"
          className="flex-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        {withCategory && (
          <select data-testid={`${testid}-category`} value={cat} onChange={(e) => setCat(e.target.value)}
            className="rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-gray-900">
            <option value="">No tag</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="Personal">Personal</option>
            <option value="Health">Health</option>
          </select>
        )}
        <button data-testid={`${testid}-add`} type="submit" className="rounded-md bg-gray-900 p-1.5 text-white hover:bg-gray-800">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function Reflection({ label, value, isOwner, onChange, testid }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-gray-500">{label}</p>
      <textarea
        data-testid={testid}
        value={value}
        disabled={!isOwner}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={isOwner ? "Write here…" : "—"}
        className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  );
}
