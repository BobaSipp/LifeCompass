import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";

// Fetches real quotes periodically and animates micro-ticks in between for a live feel.
export default function useLiveQuotes(intervalMs = 15000) {
  const [quotes, setQuotes] = useState([]);
  const base = useRef({}); // id -> server price
  const flash = useRef({});

  useEffect(() => {
    let mounted = true;
    const fetchQuotes = async () => {
      try {
        const { data } = await api.get("/market/quotes");
        if (!mounted) return;
        data.forEach((q) => (base.current[q.id] = q.price));
        setQuotes((prev) => {
          const prevMap = {};
          prev.forEach((p) => (prevMap[p.id] = p.price));
          return data.map((q) => ({ ...q, live: q.price, dir: 0 }));
        });
      } catch (e) { /* keep last */ }
    };
    fetchQuotes();
    const poll = setInterval(fetchQuotes, intervalMs);

    // micro-tick animation ~120ms
    const tick = setInterval(() => {
      setQuotes((prev) =>
        prev.map((q) => {
          const anchor = base.current[q.id] || q.price;
          const vol = q.type === "crypto" ? 0.0006 : q.type === "forex" ? 0.00012 : 0.0004;
          const drift = (anchor - q.live) * 0.05; // pull toward server price
          const noise = anchor * vol * (Math.random() - 0.5) * 2;
          const next = q.live + drift + noise;
          const dir = next > q.live ? 1 : next < q.live ? -1 : 0;
          return { ...q, live: next, dir };
        })
      );
    }, 120);

    return () => { mounted = false; clearInterval(poll); clearInterval(tick); };
  }, [intervalMs]);

  return quotes;
}
