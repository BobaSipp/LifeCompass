import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Camera, Dumbbell, Wallet, Brain } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/Layout";
import MetricChart from "@/components/MetricChart";

export default function Growth() {
  const { isOwner } = useAuth();
  const [metrics, setMetrics] = useState([]);
  useEffect(() => { api.get("/metrics").then((r) => setMetrics(r.data)); }, []);

  const byCat = (cat) => metrics.filter((m) => m.category === cat);
  const snapshot = async () => {
    await api.post("/growth/snapshot-networth");
    toast.success("Net worth snapshot saved");
    window.location.reload();
  };

  const groups = [
    { key: "gym", label: "Gym Progress", icon: Dumbbell },
    { key: "finance", label: "Finance Progress", icon: Wallet },
    { key: "mind", label: "Mind & IQ", icon: Brain },
  ];

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Compounding"
        title="Growth"
        subtitle="Log it, chart it, beat it. Track lifts, net worth, IQ and focus over time."
        action={
          <button data-testid="snapshot-networth" onClick={snapshot} className="flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Camera className="h-4 w-4" /> Snapshot net worth
          </button>
        }
      />
      {groups.map((g) => {
        const Icon = g.icon;
        const items = byCat(g.key);
        if (!items.length) return null;
        return (
          <div key={g.key} className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <Icon className="h-5 w-5 text-gray-400" strokeWidth={1.75} />
              <h2 className="text-2xl font-bold tracking-tight text-gray-900">{g.label}</h2>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => <MetricChart key={m.key} metric={m} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
