import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { eur } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import StatCard from "@/components/StatCard";
import {
  Wallet,
  TrendingUp,
  CalendarCheck,
  Flame,
  PiggyBank,
  Briefcase,
  ArrowRight,
} from "lucide-react";

const NL_TODAY = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());

function computeStreak(logs) {
  const map = {};
  logs.forEach((l) => (map[l.date] = l.status));
  let streak = 0;
  let d = new Date(NL_TODAY());
  // include today only if complete, else start from yesterday
  for (let i = 0; i < 400; i++) {
    const key = new Intl.DateTimeFormat("en-CA").format(d);
    if (map[key] === "complete") {
      streak++;
    } else if (i === 0) {
      // today not complete yet -> keep counting from yesterday
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api.get("/finance/summary").then((r) => setSummary(r.data));
    api.get("/daily").then((r) => setLogs(r.data));
    api.get("/settings").then((r) => setSettings(r.data));
  }, []);

  const today = NL_TODAY();
  const todayLog = logs.find((l) => l.date === today);
  const streak = computeStreak(logs);

  let weeksLived = 0,
    totalWeeks = 0,
    pctLived = 0;
  if (settings) {
    const birth = new Date(settings.birth_date);
    const now = new Date();
    weeksLived = Math.floor((now - birth) / (7 * 24 * 3600 * 1000));
    totalWeeks = settings.lifespan_years * 52;
    pctLived = ((weeksLived / totalWeeks) * 100).toFixed(1);
  }

  const completeDays = logs.filter((l) => l.status === "complete").length;

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Overview"
        title="Command Center"
        subtitle="Your life and money at a glance. Track the days you win, and the compounding behind them."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          testid="stat-networth"
          label="Net worth"
          value={summary ? eur(summary.net_worth) : "—"}
          sub={summary ? `${summary.accounts_count} savings accounts` : ""}
          icon={Wallet}
        />
        <StatCard
          testid="stat-interest"
          label="Projected interest / yr"
          value={summary ? eur(summary.projected_annual_interest) : "—"}
          sub={summary ? `${summary.blended_apy}% blended APY` : ""}
          accent="text-emerald-600"
          icon={TrendingUp}
        />
        <StatCard
          testid="stat-monthnet"
          label="This month net"
          value={summary ? eur(summary.monthly_net) : "—"}
          sub={summary ? `${eur(summary.monthly_income)} in · ${eur(summary.monthly_expense)} out` : ""}
          accent={summary && summary.monthly_net < 0 ? "text-red-600" : "text-gray-900"}
          icon={PiggyBank}
        />
        <StatCard
          testid="stat-streak"
          label="Green streak"
          value={`${streak}d`}
          sub={`${completeDays} perfect days logged`}
          accent="text-emerald-600"
          icon={Flame}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today */}
        <div className="rounded-md border border-gray-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-gray-400" strokeWidth={1.75} />
              <h3 className="text-xl font-semibold tracking-tight text-gray-900">Today</h3>
            </div>
            <Link
              to="/daily"
              data-testid="dashboard-open-daily"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
            >
              Open daily log <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {todayLog && todayLog.tasks_total > 0 ? (
            <div className="mt-6">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-500">Tasks completed</span>
                <span className="font-mono font-semibold text-gray-900">
                  {todayLog.tasks_done}/{todayLog.tasks_total}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    todayLog.status === "complete" ? "bg-emerald-600" : "bg-gray-900"
                  }`}
                  style={{ width: `${todayLog.completion_ratio * 100}%` }}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge ok={todayLog.set_before_9am} label={todayLog.set_before_9am ? "Set before 9AM" : "Set after 9AM"} />
                <Badge
                  ok={todayLog.tasks_done === todayLog.tasks_total}
                  label={todayLog.tasks_done === todayLog.tasks_total ? "All tasks done" : "Tasks pending"}
                />
                {todayLog.status === "complete" && (
                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Fully green
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-md border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
              <p className="text-sm font-medium text-gray-500">
                No tasks set for today yet. Set them before 9AM to earn a fully green day.
              </p>
            </div>
          )}
        </div>

        {/* Life progress */}
        <div className="rounded-md border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-gray-400" strokeWidth={1.75} />
            <h3 className="text-xl font-semibold tracking-tight text-gray-900">Life spent</h3>
          </div>
          <p className="mt-6 font-mono text-4xl font-semibold tracking-tight text-gray-900">{pctLived}%</p>
          <p className="mt-1 text-sm font-medium text-gray-400">
            {weeksLived.toLocaleString()} of {totalWeeks.toLocaleString()} weeks
          </p>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gray-900" style={{ width: `${pctLived}%` }} />
          </div>
          <Link
            to="/life"
            data-testid="dashboard-open-life"
            className="mt-4 flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            View life in weeks <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function Badge({ ok, label }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        ok ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {label}
    </span>
  );
}
