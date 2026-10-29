import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { getHostBookings } from "../services/api";
import EarningsTrendChart from "../components/EarningsTrendChart";
import {
  PageHeader, Section, Card, EmptyState, ErrorState, SegmentedControl, SkeletonCard, fmtMoney,
} from "../components/dashboard/ui";

// Period presets for the earnings scope selector. `null` start = all time.
const PERIODS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "year", label: "This year" },
];
const periodStart = (p) => {
  if (p === "all") return null;
  const d = new Date();
  if (p === "30d") d.setDate(d.getDate() - 30);
  else if (p === "90d") d.setDate(d.getDate() - 90);
  else if (p === "year") { d.setMonth(0, 1); d.setHours(0, 0, 0, 0); }
  return d;
};

const Earnings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [period, setPeriod] = useState("all");

  const load = async () => {
    setErr(false);
    setLoading(true);
    try {
      const { data } = await getHostBookings();
      setBookings(data || []);
    } catch {
      setErr(true); // P2-9: surface load failure instead of showing empty
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (err) {
    return (
      <div>
        <PageHeader title="Earnings" subtitle="Track your revenue and per-service performance." />
        <ErrorState message="Couldn’t load your earnings." onRetry={load} />
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Earnings" subtitle="Track your revenue and per-service performance." />
        <SkeletonCard className="mb-6 h-72" />
        <SkeletonCard />
      </div>
    );
  }

  const start = periodStart(period);
  const paid = bookings.filter(
    (b) => b.payment_status === "paid" &&
      (!start || new Date(b.scheduled_at || b.created_at) >= start),
  );

  // Per-service breakdown (net vs gross)
  const serviceMap = {};
  paid.forEach((b) => {
    const title = b.services?.title || "Unknown";
    if (!serviceMap[title]) serviceMap[title] = { count: 0, gross: 0, net: 0 };
    serviceMap[title].count++;
    serviceMap[title].gross += b.services?.price || 0;
    serviceMap[title].net += b.vendor_amount != null ? b.vendor_amount : b.services?.price || 0;
  });
  const serviceBreakdown = Object.entries(serviceMap).sort((a, b) => b[1].net - a[1].net);

  return (
    <div>
      <PageHeader title="Earnings" subtitle="Track your revenue and per-service performance." />

      {/* Period scope — filters both the trend chart and the per-service breakdown */}
      <SegmentedControl
        className="mb-5"
        value={period}
        onChange={setPeriod}
        options={PERIODS}
      />

      {/* Interactive trend chart — metric cards double as the KPI row */}
      <div className="mb-6">
        <EarningsTrendChart paid={paid} />
      </div>

      <Section title="Revenue by Service">
        <Card>
          {serviceBreakdown.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No paid bookings yet" description="Revenue by service appears here once you have paid bookings." />
          ) : (
            <div className="space-y-3">
              {serviceBreakdown.map(([title, data]) => (
                <div key={title} className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{title}</p>
                    <p className="text-xs text-gray-400">{data.count} booking{data.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-semibold text-gray-900">{fmtMoney(data.net)}</p>
                    {data.gross !== data.net && <p className="text-xs text-gray-400">{fmtMoney(data.gross)} gross</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Section>
    </div>
  );
};

export default Earnings;
