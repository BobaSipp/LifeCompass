export default function StatCard({ label, value, sub, accent, testid, icon: Icon }) {
  return (
    <div
      data-testid={testid}
      className="rounded-md border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-gray-300" strokeWidth={1.75} />}
      </div>
      <p className={`mt-3 font-mono text-3xl font-semibold tracking-tight ${accent || "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-sm font-medium text-gray-400">{sub}</p>}
    </div>
  );
}
