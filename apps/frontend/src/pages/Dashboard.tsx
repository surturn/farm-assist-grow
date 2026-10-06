import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Check, ScanLine } from "lucide-react";
import { toast } from "sonner";
import type { DashboardData } from "@farmassist/shared-types";
import DashboardLayout from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/ScanStatus";
import { scanStatus } from "@/lib/scan-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFarm } from "@/contexts/FarmContext";
import { dashboardService } from "@/services/dashboard.service";
import { scansService, type ScanRow } from "@/services/scans.service";
import { getCoordinates, getWeather, getWeatherDescription } from "@/lib/weather";

type Weather = { temp: number; desc: string } | null;

export default function Dashboard() {
  const { activeFarmId, farms } = useFarm();
  const [data, setData] = useState<DashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [weather, setWeather] = useState<Weather>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const d = await dashboardService.getDashboardData(activeFarmId);
      setData(d);
      const { lat, lon } = getCoordinates(d.userRegion);
      getWeather(lat, lon)
        .then((w) => setWeather({ temp: w.current.temperature_2m, desc: getWeatherDescription(w.current.weather_code) }))
        .catch(() => setWeather(null));
    } catch {
      setFailed(true);
    }
  }, [activeFarmId]);

  useEffect(() => {
    load();
  }, [load]);

  const farmName = farms.find((f) => f.id === (activeFarmId ?? data?.activeFarmId))?.name;

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[farmName, data?.userRegion].filter(Boolean).join(" · ") || " "}
          </p>
        </div>
        <Button asChild>
          <Link to="/scan">
            <ScanLine aria-hidden />
            New scan
          </Link>
        </Button>
      </div>

      {failed ? (
        <div className="mt-8 rounded-lg border bg-card p-6 text-sm">
          <p className="font-medium">Couldn't load your farm data.</p>
          <p className="mt-1 text-muted-foreground">Check your connection and try again.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={load}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <Metrics data={data} weather={weather} />
          <RecentScans data={data} onChange={load} />
        </>
      )}
    </DashboardLayout>
  );
}

function Metrics({ data, weather }: { data: DashboardData | null; weather: Weather }) {
  const rate = data && data.totalScans > 0 ? Math.round((data.verifiedScans / data.totalScans) * 100) : null;
  const cells = [
    { label: "Scans", value: data?.totalScans, note: "on this farm" },
    { label: "Verified", value: data?.verifiedScans, note: rate === null ? "no scans yet" : `${rate}% of scans` },
    { label: "Awaiting your answer", value: data?.awaitingScans, note: data?.awaitingScans ? "confirm or correct below" : "all caught up" },
    {
      label: "Weather now",
      value: weather ? `${Math.round(weather.temp)}°C` : undefined,
      note: weather?.desc ?? (data ? "unavailable" : undefined),
    },
  ];

  return (
    <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border bg-card md:grid-cols-4">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={[
            "p-4",
            i % 2 === 1 ? "border-l" : "",
            i >= 2 ? "border-t md:border-t-0" : "",
            i === 2 ? "md:border-l" : "",
          ].join(" ")}
        >
          <dt className="text-xs text-muted-foreground">{c.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular">
            {c.value === undefined ? <Skeleton className="h-8 w-14" /> : c.value}
          </dd>
          <dd className="mt-0.5 min-h-4 text-xs text-muted-foreground">{c.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function RecentScans({ data, onChange }: { data: DashboardData | null; onChange: () => void }) {
  const scans = (data?.recentScans ?? []) as ScanRow[];

  return (
    <section aria-labelledby="recent-scans" className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 id="recent-scans" className="text-sm font-semibold">
          Recent scans
        </h2>
        {scans.length > 0 && (
          <Link to="/scan" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            All scans
          </Link>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border bg-card">
        {!data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : scans.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium">No scans on this farm yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Photograph a leaf that looks unwell and get a diagnosis in seconds.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link to="/scan">Scan a leaf</Link>
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Diagnosis</th>
                <th scope="col" className="hidden px-4 py-2 font-medium sm:table-cell">Confidence</th>
                <th scope="col" className="hidden px-4 py-2 font-medium md:table-cell">Status</th>
                <th scope="col" className="hidden px-4 py-2 font-medium md:table-cell">Date</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Your answer</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scans.map((scan) => (
                <ScanRowView key={scan.id} scan={scan} onChange={onChange} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function ScanRowView({ scan, onChange }: { scan: ScanRow; onChange: () => void }) {
  const [correcting, setCorrecting] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const kind = scanStatus(scan);
  const crop = scan.analysis?.cropType;

  const answer = async (correct: boolean) => {
    setBusy(true);
    try {
      await scansService.verify(scan.id, correct, correct ? undefined : label);
      toast.success(correct ? "Confirmed. Thank you." : "Correction saved. Thank you.");
      onChange();
    } catch {
      toast.error("Couldn't save your answer. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="align-middle">
      <td className="px-4 py-3">
        <div className="font-medium">{scan.diseaseName ?? "Unknown"}</div>
        <div className="text-xs text-muted-foreground">
          {crop && crop !== "Unknown" ? crop : null}
          <span className="md:hidden">
            {crop && crop !== "Unknown" ? " · " : ""}
            {format(new Date(scan.createdAt), "d MMM")}
          </span>
        </div>
        <StatusBadge kind={kind} className="mt-1.5 md:hidden" />
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        {kind === "unsupported" || scan.confidence == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="tabular">{Math.round(scan.confidence)}%</span>
        )}
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <StatusBadge kind={kind} />
      </td>
      <td className="hidden px-4 py-3 text-muted-foreground tabular md:table-cell">
        {format(new Date(scan.createdAt), "d MMM yyyy")}
      </td>
      <td className="px-4 py-3 text-right">
        {scan.verifiedLabel ? (
          <span className="inline-flex items-center gap-1 text-xs text-status-healthy">
            <Check className="size-3.5" aria-hidden />
            {scan.verifiedLabel === scan.diseaseName ? "Confirmed" : `Corrected: ${scan.verifiedLabel}`}
          </span>
        ) : kind === "unsupported" ? (
          <span className="text-muted-foreground">—</span>
        ) : correcting ? (
          <form
            className="ml-auto flex max-w-xs gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              answer(false);
            }}
          >
            <Input
              autoFocus
              aria-label="What is it?"
              placeholder="What is it? (optional)"
              value={label}
              maxLength={100}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setCorrecting(false)}
              className="h-8"
            />
            <Button type="submit" size="sm" className="h-8" disabled={busy}>
              Send
            </Button>
          </form>
        ) : (
          <div className="inline-flex gap-1.5">
            <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => answer(true)}>
              Confirm
            </Button>
            <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => setCorrecting(true)}>
              Correct
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
