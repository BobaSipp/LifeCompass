import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Heart, MessageCircle } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500";

export default function Relationships() {
  const { isOwner } = useAuth();
  const [people, setPeople] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [logFor, setLogFor] = useState(null);

  const load = useCallback(() => api.get("/relationships").then((r) => setPeople(r.data)), []);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => { await api.delete(`/relationships/${id}`); toast.success("Removed"); load(); };

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Connection"
        title="Relationships"
        subtitle="The people who matter. Track closeness, last contact, and log meaningful interactions."
        action={
          <button data-testid="add-person" onClick={() => setShowAdd(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Add person
          </button>
        }
      />

      {people.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 p-10 text-center text-sm font-medium text-gray-400">No people added yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {people.map((p) => {
            const avgQ = p.logs?.length ? (p.logs.reduce((a, l) => a + l.quality, 0) / p.logs.length).toFixed(1) : null;
            return (
              <div key={p.id} data-testid={`person-${p.id}`} className="rounded-md border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-lg font-bold tracking-tight text-gray-900">{p.name}</h4>
                    <p className="text-xs uppercase tracking-wider text-gray-400">{p.relation || "—"}</p>
                  </div>
                  <button data-testid={`del-person-${p.id}`} onClick={() => del(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 flex items-center gap-1">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Heart key={i} className={`h-3.5 w-3.5 ${i < p.closeness ? "fill-rose-500 text-rose-500" : "text-gray-200"}`} />
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span>Last contact: <span className="font-medium text-gray-700">{p.last_contact || "never"}</span></span>
                  {avgQ && <span>Avg vibe: <span className="font-mono font-semibold text-gray-900">{avgQ}</span></span>}
                </div>
                {p.notes && <p className="mt-2 text-xs text-gray-400">{p.notes}</p>}
                <button data-testid={`log-interaction-${p.id}`} onClick={() => setLogFor(p)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <MessageCircle className="h-4 w-4" /> Log interaction
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && <PersonModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {logFor && <InteractionModal person={logFor} onClose={() => setLogFor(null)} onSaved={() => { setLogFor(null); load(); }} />}
    </div>
  );
}

function Shell({ title, onClose, children }) {
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

function PersonModal({ onClose, onSaved }) {
  const [f, setF] = useState({ name: "", relation: "", closeness: 5, notes: "" });
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post("/relationships", f); toast.success("Person added"); onSaved(); }
    catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  return (
    <Shell title="Add person" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={labelCls}>Name</label><input data-testid="person-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><label className={labelCls}>Relation</label><input data-testid="person-relation" className={inputCls} value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} placeholder="friend / family / partner" /></div>
        <div>
          <label className={labelCls}>Closeness: {f.closeness}/10</label>
          <input data-testid="person-closeness" type="range" min="1" max="10" value={f.closeness} onChange={(e) => setF({ ...f, closeness: Number(e.target.value) })} className="w-full accent-gray-900" />
        </div>
        <div><label className={labelCls}>Notes</label><input data-testid="person-notes" className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
        <button data-testid="person-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Add</button>
      </form>
    </Shell>
  );
}

function InteractionModal({ person, onClose, onSaved }) {
  const [quality, setQuality] = useState(7);
  const [note, setNote] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try { await api.post(`/relationships/${person.id}/logs`, { quality, note }); toast.success("Logged"); onSaved(); }
    catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  return (
    <Shell title={`Log with ${person.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={labelCls}>How was it? {quality}/10</label>
          <input data-testid="interaction-quality" type="range" min="1" max="10" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full accent-gray-900" />
        </div>
        <div><label className={labelCls}>Note</label><input data-testid="interaction-note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened" /></div>
        <button data-testid="interaction-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Save</button>
      </form>
    </Shell>
  );
}
