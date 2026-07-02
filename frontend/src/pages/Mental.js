import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import api from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import MetricChart from "@/components/MetricChart";

export default function Mental() {
  const [metrics, setMetrics] = useState([]);
  useEffect(() => { api.get("/metrics").then((r) => setMetrics(r.data.filter((m) => m.category === "mental"))); }, []);

  return (
    <div className="p-8 lg:p-12">
      <PageHeader
        label="Headspace"
        title="Mental Health"
        subtitle="Rate your mood, energy and stress daily. Track sleep and meditation. Notice the patterns."
      />
      <div className="mb-8 flex items-center gap-3 rounded-md border border-gray-200 bg-gray-50 p-5">
        <Brain className="h-6 w-6 text-gray-400" strokeWidth={1.75} />
        <p className="text-sm font-medium text-gray-600">Consistency beats intensity — a quick daily rating is enough to reveal trends over weeks.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => <MetricChart key={m.key} metric={m} />)}
      </div>
    </div>
  );
}
