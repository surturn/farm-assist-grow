import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { Camera, Check, ImageUp } from "lucide-react";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import manifest from "@farmassist/ai/class-manifest.json";
import DashboardLayout from "@/components/DashboardLayout";
import CameraCapture from "@/components/CameraCapture";
import { StatusBadge } from "@/components/ScanStatus";
import { scanStatus } from "@/lib/scan-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFarm } from "@/contexts/FarmContext";
import { processImageUpload } from "@/lib/image_upload_util";
import { cn } from "@/lib/utils";
import { scansService, type DiagnosisStep, type ScanRow } from "@/services/scans.service";

const SUPPORTED_CROPS: string[] = manifest.trainedCrops;

export default function Scan() {
  const { activeFarmId } = useFarm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisStep | null>(null);
  const [answering, setAnswering] = useState(false);
  const [history, setHistory] = useState<ScanRow[] | null>(null);

  const refreshHistory = () => scansService.list(activeFarmId).then(setHistory).catch(() => setHistory([]));

  useEffect(() => {
    refreshHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFarmId]);

  const pickImage = (src: string) => {
    setImage(src);
    setResult(null);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const processed = await processImageUpload(file);
    if (!processed.success || !processed.data) {
      toast.error(processed.error || "That file isn't an image we can read.");
      return;
    }
    pickImage(processed.data);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  };

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    setResult(null);
    try {
      setResult(await scansService.diagnose(image, activeFarmId));
      refreshHistory();
    } catch (error) {
      const message = isAxiosError(error) ? error.response?.data?.error : undefined;
      toast.error(message || "Diagnosis failed. Try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const onAnswer = async (questionId: string, optionId: string) => {
    if (!result) return;
    setAnswering(true);
    try {
      setResult(await scansService.answer(result.scanId, questionId, optionId));
      refreshHistory();
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 409) {
        toast.error("That question expired. Diagnose the photo again.");
        setResult(null);
      } else {
        toast.error("Couldn't save your answer. Try again.");
      }
    } finally {
      setAnswering(false);
    }
  };

  const onVerified = (scan: ScanRow) => setHistory((prev) => (prev ?? []).map((s) => (s.id === scan.id ? scan : s)));

  return (
    <DashboardLayout>
      <h1 className="text-xl font-semibold tracking-tight">Scan a leaf</h1>
      <p className="mt-1 text-sm text-muted-foreground">Supported crops: {SUPPORTED_CROPS.join(", ")}.</p>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <section aria-label="Photo" className="rounded-lg border bg-card p-4">
          {showCamera ? (
            <CameraCapture
              onCapture={(src) => {
                pickImage(src);
                setShowCamera(false);
              }}
              onCancel={() => setShowCamera(false)}
            />
          ) : image ? (
            <img src={image} alt="Leaf to diagnose" className="aspect-[4/3] w-full rounded-md bg-muted object-contain" />
          ) : (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "flex aspect-[4/3] flex-col items-center justify-center rounded-md border border-dashed px-6 text-center transition-colors duration-150",
                dragging ? "border-primary bg-status-healthy-bg" : "bg-muted/40",
              )}
            >
              <ImageUp className="size-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">
                <span className="[@media(pointer:fine)]:hidden">Add a photo of the leaf</span>
                <span className="hidden [@media(pointer:fine)]:inline">Drop a photo here</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">One leaf, in daylight, filling most of the frame.</p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {!showCamera && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" onClick={() => setShowCamera(true)}>
                <Camera aria-hidden />
                Take photo
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <ImageUp aria-hidden />
                {image ? "Replace" : "Choose file"}
              </Button>
              <Button className="col-span-2 sm:ml-auto" onClick={analyze} disabled={!image || analyzing}>
                {analyzing ? "Diagnosing…" : "Diagnose"}
              </Button>
            </div>
          )}
        </section>

        <section
          aria-label="Diagnosis"
          aria-live="polite"
          className={cn("rounded-lg border bg-card p-5", !analyzing && !result && "hidden lg:block")}
        >
          {analyzing ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="mt-6 h-20 w-full" />
              <p className="text-xs text-muted-foreground">Usually takes under 10 seconds.</p>
            </div>
          ) : result ? (
            <div key={result.scanId}>
              <StepView step={result} onAnswer={onAnswer} busy={answering} />
              {result.band === "confident" && <Feedback scanId={result.scanId} onVerified={onVerified} />}
            </div>
          ) : (
            <div className="flex h-full min-h-48 items-center justify-center text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                The diagnosis appears here, with what to do next.
              </p>
            </div>
          )}
        </section>
      </div>

      <History scans={history} />
    </DashboardLayout>
  );
}

function StepView({ step, onAnswer, busy }: { step: DiagnosisStep; onAnswer: (q: string, o: string) => void; busy: boolean }) {
  if (step.band === "rejected") {
    const text =
      step.reason === "unsupported"
        ? `We can't diagnose this crop yet. FarmAssist covers ${SUPPORTED_CROPS.join(", ")}.`
        : step.reason === "not_plant"
          ? "We couldn't see a plant. Try a close photo of one leaf."
          : "We couldn't read that photo. Try another, in daylight.";
    return (
      <div>
        <StatusBadge kind="unsupported" />
        <p className="mt-3 text-sm">{text}</p>
      </div>
    );
  }

  if (step.band === "uncertain") {
    return (
      <div>
        <StatusBadge kind="uncertain" />
        <h2 className="mt-3 text-lg font-semibold">Not sure yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't tell with enough confidence. An expert will look at your photo.
        </p>
      </div>
    );
  }

  if (step.band === "ask" && step.question) {
    const q = step.question;
    return (
      <div>
        <StatusBadge kind="uncertain" />
        <h2 className="mt-3 text-lg font-semibold">{q.text}</h2>
        <p className="mt-1 text-sm text-muted-foreground">One detail helps tell two look-alike diseases apart.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {q.options.map((o) => (
            <Button key={o.id} variant="outline" disabled={busy} onClick={() => onAnswer(q.id, o.id)}>
              {o.text}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const a = step.advice;
  if (!a) return null;
  const confidence = Math.max(0, Math.min(100, Math.round(step.confidence * 100)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind={a.healthy ? "healthy" : "disease"} />
        {step.crop && <span className="text-xs text-muted-foreground">{step.crop}</span>}
      </div>
      <h2 className="mt-2 text-lg font-semibold">{a.diseaseName}</h2>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Confidence</span>
          <span className="tabular">{confidence}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
          <div className="h-full rounded-full bg-foreground/70" style={{ width: `${confidence}%` }} />
        </div>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        {a.symptoms.length > 0 && (
          <Block title="Signs">
            <ul className="list-disc space-y-0.5 pl-5 leading-relaxed">
              {a.symptoms.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Block>
        )}
        {a.treatment ? (
          <Block title="What to do">
            <p className="leading-relaxed">{a.treatment}</p>
          </Block>
        ) : (
          !a.healthy && (
            <Block title="What to do">
              <p>Ask your agrovet for treatment.</p>
            </Block>
          )
        )}
        {a.chemicals.length > 0 && (
          <Block title="Registered active ingredients">
            <p>
              {a.chemicals.map((c) => c.activeIngredient).join(", ")}. Ask your agrovet for the right product and dose.
            </p>
          </Block>
        )}
        {a.prevention.length > 0 && (
          <Block title="Prevention">
            <ul className="list-disc space-y-0.5 pl-5 leading-relaxed">
              {a.prevention.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Block>
        )}
        {a.source && (
          <p className="text-xs text-muted-foreground">
            Source:{" "}
            <a className="underline underline-offset-2" href={a.source.url} target="_blank" rel="noreferrer">
              {a.source.title}
            </a>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          This is advice, not a guarantee. Ask your agrovet before spraying, especially if symptoms spread.
        </p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Feedback({ scanId, onVerified }: { scanId: string; onVerified: (s: ScanRow) => void }) {
  const [correcting, setCorrecting] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  const send = async (correct: boolean) => {
    setBusy(true);
    try {
      onVerified(await scansService.verify(scanId, correct, correct ? undefined : label));
      setVerified(true);
    } catch {
      toast.error("Couldn't save your answer. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 border-t pt-4">
      {verified ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-status-healthy">
          <Check className="size-4" aria-hidden />
          Thanks. Your answer makes the next diagnosis better.
        </p>
      ) : correcting ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(false);
          }}
        >
          <Input
            autoFocus
            aria-label="What is it?"
            placeholder="What is it? (optional)"
            value={label}
            maxLength={100}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            Send
          </Button>
          <Button type="button" variant="ghost" onClick={() => setCorrecting(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-sm font-medium">Is this right?</span>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => send(true)}>
            Yes
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setCorrecting(true)}>
            No, it's something else
          </Button>
        </div>
      )}
    </div>
  );
}

function History({ scans }: { scans: ScanRow[] | null }) {
  return (
    <section aria-labelledby="history" className="mt-8">
      <h2 id="history" className="text-sm font-semibold">
        Scan history
      </h2>
      <div className="mt-3 overflow-hidden rounded-lg border bg-card">
        {scans === null ? (
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : scans.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No scans on this farm yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {scans.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.diseaseName ?? "Unknown"}</div>
                  {s.verifiedLabel && s.verifiedLabel !== s.diseaseName && (
                    <div className="truncate text-xs text-muted-foreground">Corrected to {s.verifiedLabel}</div>
                  )}
                </div>
                <StatusBadge kind={scanStatus(s)} />
                <span className="w-20 text-right text-xs text-muted-foreground tabular">
                  {format(new Date(s.createdAt), "d MMM")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
