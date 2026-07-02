import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, X, Star, BookOpen } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import StatCard from "@/components/StatCard";

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500";
const COLS = [
  { key: "reading", label: "Reading" },
  { key: "to_read", label: "To Read" },
  { key: "finished", label: "Finished" },
];

export default function Books() {
  const { isOwner } = useAuth();
  const [books, setBooks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [show, setShow] = useState(false);
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => {
    api.get("/books").then((r) => setBooks(r.data));
    api.get("/books/summary").then((r) => setSummary(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => { await api.delete(`/books/${id}`); toast.success("Removed"); load(); };
  const advance = async (b, status) => { await api.put(`/books/${b.id}`, { ...b, status }); load(); };

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Knowledge"
        title="Book Tracker"
        subtitle="Your reading shelf. Track progress, rate what you finish, and stack up the pages."
        action={
          <button data-testid="add-book" onClick={() => setShow(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Add book
          </button>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <StatCard testid="books-finished" label="Finished" value={summary?.finished ?? "—"} accent="text-emerald-600" icon={BookOpen} />
        <StatCard testid="books-reading" label="Reading now" value={summary?.reading ?? "—"} />
        <StatCard testid="books-pages" label="Pages read" value={summary ? summary.pages_read.toLocaleString() : "—"} />
        <StatCard testid="books-rating" label="Avg rating" value={summary ? `${summary.avg_rating}★` : "—"} accent="text-amber-500" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {COLS.map((col) => {
          const list = books.filter((b) => b.status === col.key);
          return (
            <div key={col.key} className="rounded-md border border-gray-200 bg-white p-5">
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{col.label} · {list.length}</p>
              <div className="space-y-3">
                {list.length === 0 && <p className="text-sm text-gray-400">Empty.</p>}
                {list.map((b) => {
                  const pct = b.total_pages ? Math.min(100, Math.round((b.current_page / b.total_pages) * 100)) : 0;
                  return (
                    <div key={b.id} data-testid={`book-${b.id}`} className="rounded-md border border-gray-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">{b.title}</p>
                          <p className="truncate text-xs text-gray-400">{b.author}</p>
                        </div>
                        <button data-testid={`del-book-${b.id}`} onClick={() => del(b.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      {col.key === "reading" && b.total_pages > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mt-1 font-mono text-[10px] text-gray-400">{b.current_page}/{b.total_pages} · {pct}%</p>
                        </div>
                      )}
                      {col.key === "finished" && b.rating > 0 && (
                        <div className="mt-2 flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3.5 w-3.5 ${i < b.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}
                        </div>
                      )}
                      <div className="mt-2 flex gap-2">
                        {col.key === "to_read" && <button data-testid={`start-book-${b.id}`} onClick={() => advance(b, "reading")} className="text-xs font-semibold text-blue-600 hover:underline">Start</button>}
                        {col.key === "reading" && <button data-testid={`finish-book-${b.id}`} onClick={() => setEdit(b)} className="text-xs font-semibold text-emerald-600 hover:underline">Update / Finish</button>}
                        {col.key !== "to_read" && <button data-testid={`edit-book-${b.id}`} onClick={() => setEdit(b)} className="text-xs font-semibold text-gray-500 hover:underline">Edit</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {show && <BookModal onClose={() => setShow(false)} onSaved={() => { setShow(false); load(); }} />}
      {edit && <BookModal book={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </div>
  );
}

function BookModal({ book, onClose, onSaved }) {
  const [f, setF] = useState(book || { title: "", author: "", status: "to_read", rating: 0, total_pages: 0, current_page: 0, notes: "" });
  const submit = async (e) => {
    e.preventDefault();
    const payload = { ...f, rating: Number(f.rating) || 0, total_pages: Number(f.total_pages) || 0, current_page: Number(f.current_page) || 0 };
    try {
      if (book) await api.put(`/books/${book.id}`, payload);
      else await api.post("/books", payload);
      toast.success("Saved"); onSaved();
    } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">{book ? "Edit book" : "Add book"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div><label className={labelCls}>Title</label><input data-testid="book-title" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required /></div>
          <div><label className={labelCls}>Author</label><input data-testid="book-author" className={inputCls} value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-2">
            {["to_read", "reading", "finished"].map((s) => (
              <button key={s} type="button" data-testid={`book-status-${s}`} onClick={() => setF({ ...f, status: s })}
                className={`rounded-md border py-2 text-xs font-medium capitalize ${f.status === s ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{s.replace("_", " ")}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Current page</label><input data-testid="book-current" type="number" className={inputCls} value={f.current_page} onChange={(e) => setF({ ...f, current_page: e.target.value })} /></div>
            <div><label className={labelCls}>Total pages</label><input data-testid="book-total" type="number" className={inputCls} value={f.total_pages} onChange={(e) => setF({ ...f, total_pages: e.target.value })} /></div>
          </div>
          {f.status === "finished" && (
            <div>
              <label className={labelCls}>Rating</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" data-testid={`book-rate-${n}`} onClick={() => setF({ ...f, rating: n })}>
                    <Star className={`h-6 w-6 ${n <= f.rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
                  </button>
                ))}
              </div>
            </div>
          )}
          <button data-testid="book-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Save</button>
        </form>
      </div>
    </div>
  );
}
