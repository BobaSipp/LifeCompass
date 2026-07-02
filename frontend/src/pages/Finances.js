import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import api, { eur, formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import StatCard from "@/components/StatCard";

export default function Finances() {
  const { isOwner } = useAuth();
  const [summary, setSummary] = useState(null);
  const [savings, setSavings] = useState([]);
  const [txns, setTxns] = useState([]);
  const [showSaving, setShowSaving] = useState(false);
  const [showTxn, setShowTxn] = useState(false);

  const load = useCallback(() => {
    api.get("/finance/summary").then((r) => setSummary(r.data));
    api.get("/savings").then((r) => setSavings(r.data));
    api.get("/transactions").then((r) => setTxns(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const delSaving = async (id) => { await api.delete(`/savings/${id}`); toast.success("Account removed"); load(); };
  const delTxn = async (id) => { await api.delete(`/transactions/${id}`); load(); };

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Wealth"
        title="Finances"
        subtitle="Savings, APY, income and expenses. Everything starts at zero — watch it compound."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard testid="fin-networth" label="Total savings" value={summary ? eur(summary.total_savings) : "—"} sub={`${summary?.accounts_count || 0} accounts`} />
        <StatCard testid="fin-interest" label="Interest / year" value={summary ? eur(summary.projected_annual_interest) : "—"} sub={`${summary?.blended_apy || 0}% blended APY`} accent="text-emerald-600" icon={TrendingUp} />
        <StatCard testid="fin-income" label="Income (mo)" value={summary ? eur(summary.monthly_income) : "—"} accent="text-emerald-600" icon={ArrowUpRight} />
        <StatCard testid="fin-expense" label="Expenses (mo)" value={summary ? eur(summary.monthly_expense) : "—"} accent="text-red-600" icon={ArrowDownRight} />
      </div>

      {/* Savings accounts */}
      <div className="mt-8 rounded-md border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Savings accounts</h3>
          <button data-testid="add-savings" onClick={() => setShowSaving(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Add account
          </button>
        </div>
        {savings.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No savings accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                  <th className="pb-3">Account</th>
                  <th className="pb-3 text-right">Balance</th>
                  <th className="pb-3 text-right">APY</th>
                  <th className="pb-3 text-right">Interest / yr</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {savings.map((s) => (
                  <tr key={s.id} data-testid={`savings-row-${s.id}`} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="py-3 text-right font-mono text-gray-900">{eur(s.balance)}</td>
                    <td className="py-3 text-right font-mono text-emerald-600">{s.apy}%</td>
                    <td className="py-3 text-right font-mono text-gray-500">{eur((s.balance * s.apy) / 100)}</td>
                    <td className="py-3 text-right">
                      <button data-testid={`del-savings-${s.id}`} onClick={() => delSaving(s.id)} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transactions */}
      <div className="mt-6 rounded-md border border-gray-200 bg-white p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-semibold tracking-tight text-gray-900">Income &amp; Expenses</h3>
          <button data-testid="add-txn" onClick={() => setShowTxn(true)} className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
            <Plus className="h-4 w-4" /> Add entry
          </button>
        </div>
        {txns.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No transactions yet.</p>
        ) : (
          <div className="space-y-1">
            {txns.map((t) => (
              <div key={t.id} data-testid={`txn-${t.id}`} className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-0">
                <div className={`flex h-8 w-8 items-center justify-center rounded-md ${t.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {t.type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">{t.description || t.category || (t.type === "income" ? "Income" : "Expense")}</p>
                  <p className="text-xs text-gray-400">{t.category} · {t.date}</p>
                </div>
                <span className={`font-mono text-sm font-semibold ${t.type === "income" ? "text-emerald-600" : "text-red-600"}`}>
                  {t.type === "income" ? "+" : "−"}{eur(t.amount)}
                </span>
                <button data-testid={`del-txn-${t.id}`} onClick={() => delTxn(t.id)} className="text-gray-300 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSaving && <SavingsModal onClose={() => setShowSaving(false)} onSaved={() => { setShowSaving(false); load(); }} />}
      {showTxn && <TxnModal onClose={() => setShowTxn(false)} onSaved={() => { setShowTxn(false); load(); }} />}
    </div>
  );
}

function Modal({ title, children, onClose }) {
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

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500";

function SavingsModal({ onClose, onSaved }) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apy, setApy] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/savings", { name, balance: Number(balance) || 0, apy: Number(apy) || 0 });
      toast.success("Account added");
      onSaved();
    } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  return (
    <Modal title="Add savings account" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div><label className={labelCls}>Account name</label><input data-testid="savings-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Trade Republic" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Balance (€)</label><input data-testid="savings-balance" type="number" step="0.01" className={inputCls} value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" /></div>
          <div><label className={labelCls}>APY (%)</label><input data-testid="savings-apy" type="number" step="0.01" className={inputCls} value={apy} onChange={(e) => setApy(e.target.value)} placeholder="0" /></div>
        </div>
        <button data-testid="savings-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Add account</button>
      </form>
    </Modal>
  );
}

function TxnModal({ onClose, onSaved }) {
  const [type, setType] = useState("income");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/transactions", { type, amount: Number(amount) || 0, category, description });
      toast.success("Entry added");
      onSaved();
    } catch (er) { toast.error(formatApiErrorDetail(er.response?.data?.detail)); }
  };
  return (
    <Modal title="Add entry" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {["income", "expense"].map((t) => (
            <button key={t} type="button" data-testid={`txn-type-${t}`} onClick={() => setType(t)}
              className={`rounded-md border py-2 text-sm font-medium capitalize ${type === t ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 text-gray-600"}`}>{t}</button>
          ))}
        </div>
        <div><label className={labelCls}>Amount (€)</label><input data-testid="txn-amount" type="number" step="0.01" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} required placeholder="0" /></div>
        <div><label className={labelCls}>Category</label><input data-testid="txn-category" className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Salary, Rent" /></div>
        <div><label className={labelCls}>Description</label><input data-testid="txn-description" className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" /></div>
        <button data-testid="txn-submit" className="w-full rounded-md bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">Add entry</button>
      </form>
    </Modal>
  );
}
