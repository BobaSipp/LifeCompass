import Sidebar from "@/components/Sidebar";

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <main className="ml-64 min-h-screen">{children}</main>
    </div>
  );
}

export function PageHeader({ label, title, subtitle, action }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
        <h1 className="mt-2 text-4xl font-black tracking-tighter text-gray-900 lg:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-base font-medium text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
