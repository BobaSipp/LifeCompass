import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";

export default function LifeInWeeks() {
  const { isOwner } = useAuth();
  const [settings, setSettings] = useState(null);
  const [edit, setEdit] = useState(false);
  const [birth, setBirth] = useState("");
  const [span, setSpan] = useState(85);

  useEffect(() => {
    api.get("/settings").then((r) => {
      setSettings(r.data);
      setBirth(r.data.birth_date);
      setSpan(r.data.lifespan_years);
    });
  }, []);

  if (!settings) return <div className="p-12 text-gray-400">Loading…</div>;

  const birthDate = new Date(settings.birth_date);
  const now = new Date();
  const weeksLived = Math.floor((now - birthDate) / (7 * 24 * 3600 * 1000));
  const totalWeeks = settings.lifespan_years * 52;
  const weeksLeft = Math.max(0, totalWeeks - weeksLived);
  const pct = ((weeksLived / totalWeeks) * 100).toFixed(1);
  const currentAge = Math.floor((now - birthDate) / (365.25 * 24 * 3600 * 1000));

  const save = async () => {
    try {
      const r = await api.put("/settings", { birth_date: birth, lifespan_years: Number(span) });
      setSettings(r.data);
      setEdit(false);
      toast.success("Life settings updated");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Mortality"
        title="Life in Weeks"
        subtitle="Each square is one week of your life. The dark ones are gone. Make the rest count."
        action={
          <button
            data-testid="edit-life-settings"
            onClick={() => setEdit((v) => !v)}
            className="flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="h-4 w-4" /> {edit ? "Close" : "Settings"}
          </button>
        }
      />

      {edit && (
        <div className="mb-8 flex flex-wrap items-end gap-4 rounded-md border border-gray-200 bg-gray-50 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Birth date</label>
            <input data-testid="birth-input" type="date" value={birth} onChange={(e) => setBirth(e.target.value)}
              className="rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500">Lifespan (years)</label>
            <input data-testid="span-input" type="number" value={span} onChange={(e) => setSpan(e.target.value)}
              className="w-28 rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900" />
          </div>
          <button data-testid="save-life-settings" onClick={save} className="rounded-md bg-gray-900 px-5 py-2 text-sm font-semibold text-white hover:bg-gray-800">Save</button>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <Metric label="Current age" value={`${currentAge}`} sub="years" />
        <Metric label="Weeks lived" value={weeksLived.toLocaleString()} sub={`${pct}% of life`} accent="text-gray-900" />
        <Metric label="Weeks left" value={weeksLeft.toLocaleString()} sub={`until ${settings.lifespan_years}`} accent="text-emerald-600" />
        <Metric label="Lifespan" value={`${settings.lifespan_years}`} sub="year plan" />
      </div>

      <div data-testid="life-in-weeks-grid" className="rounded-md border border-gray-200 bg-white p-6 overflow-x-auto">
        <div className="flex flex-col gap-[3px]" style={{ minWidth: "680px" }}>
          {Array.from({ length: settings.lifespan_years }).map((_, y) => (
            <div key={y} className="flex items-center gap-[3px]">
              <span className="mr-1 w-6 text-right font-mono text-[9px] text-gray-300">{y % 5 === 0 ? y : ""}</span>
              {Array.from({ length: 52 }).map((_, w) => {
                const idx = y * 52 + w;
                const lived = idx < weeksLived;
                const current = idx === weeksLived;
                return (
                  <div
                    key={w}
                    title={`Age ${y}, week ${w + 1}`}
                    className={`h-2.5 w-2.5 rounded-[2px] ${
                      current ? "animate-pulse bg-emerald-500" : lived ? "bg-gray-800" : "bg-gray-100"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-4 border-t border-gray-100 pt-4 text-xs font-medium text-gray-500">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-gray-800" /> Lived</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-500" /> This week</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-gray-100" /> Ahead</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, sub, accent }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className={`mt-2 font-mono text-3xl font-semibold ${accent || "text-gray-900"}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-400">{sub}</p>
    </div>
  );
}
