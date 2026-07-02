import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Grid3x3,
  Wallet,
  Briefcase,
  CandlestickChart,
  LineChart,
  Brain,
  Users,
  BookOpen,
  LogIn,
  LogOut,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, testid: "nav-dashboard" },
  { to: "/daily", label: "Daily Log", icon: CalendarDays, testid: "nav-daily" },
  { to: "/life", label: "Life in Weeks", icon: Grid3x3, testid: "nav-life" },
  { to: "/finances", label: "Finances", icon: Wallet, testid: "nav-finances" },
  { to: "/trading", label: "Trading", icon: CandlestickChart, testid: "nav-trading" },
  { to: "/business", label: "Business", icon: Briefcase, testid: "nav-business" },
  { to: "/growth", label: "Growth", icon: LineChart, testid: "nav-growth" },
  { to: "/mental", label: "Mental", icon: Brain, testid: "nav-mental" },
  { to: "/relationships", label: "Relationships", icon: Users, testid: "nav-relationships" },
  { to: "/books", label: "Books", icon: BookOpen, testid: "nav-books" },
];

export default function Sidebar() {
  const { user, isOwner, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      data-testid="sidebar"
      className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-200 bg-white"
    >
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <img
            src="/avatar.jpg"
            alt="Remco"
            data-testid="profile-avatar"
            className="h-11 w-11 flex-shrink-0 rounded-full object-cover ring-2 ring-gray-200"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-none tracking-tight text-gray-900">Remco Stroop</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
              Progress to success
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={item.testid}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        {user === undefined ? null : isOwner ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                O
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-gray-900">Owner</p>
                <p className="truncate text-[11px] text-gray-400">{user.email}</p>
              </div>
            </div>
            <button
              data-testid="logout-btn"
              onClick={logout}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-[11px] font-medium text-gray-500">
              <Lock className="h-3.5 w-3.5" /> Viewing in read-only mode
            </div>
            <button
              data-testid="login-btn"
              onClick={() => navigate("/login")}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              <LogIn className="h-4 w-4" /> Owner sign in
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
