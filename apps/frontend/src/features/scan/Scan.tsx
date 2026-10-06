import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import CameraCapture from "@/components/CameraCapture";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useFarm } from "@/contexts/FarmContext";
import { processImageUpload } from "@/lib/image_upload_util";
import { scansService, type Analysis, type ScanRow } from "@/services/scans.service";

export default function Scan() {
  const { activeFarmId } = useFarm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ scan: ScanRow; analysis: Analysis } | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState("");
  const [history, setHistory] = useState<ScanRow[]>([]);

  useEffect(() => {
    scansService.list(activeFarmId).then(setHistory).catch(() => setHistory([]));
  }, [activeFarmId]);

  const onFile = async (file?: File) => {
    if (!file) return;
    const processed = await processImageUpload(file);
    if (!processed.success || !processed.data) {
      toast.error(processed.error || "Could not read that image");
      return;
    }
    setImage(processed.data);
    setResult(null);
  };

  const analyze = async () => {
    if (!image) return;
    setAnalyzing(true);
    try {
      const data = await scansService.diagnose(image, activeFarmId);
      setResult(data);
      setHistory((prev) => [data.scan, ...prev]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Diagnosis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const verify = async (correct: boolean) => {
    if (!result) return;
    try {
      const scan = await scansService.verify(result.scan.id, correct, correct ? undefined : correction);
      setResult({ ...result, scan });
      setHistory((prev) => prev.map((s) => (s.id === scan.id ? scan : s)));
      setCorrecting(false);
      toast.success("Thank you, this helps the diagnosis get better.");
    } catch {
      toast.error("Could not save your answer.");
    }
  };

  const a = result?.analysis;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <Card>
          <CardHeader><CardTitle>Scan a crop</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {showCamera ? (
              <CameraCapture
                onCapture={(src) => { setImage(src); setResult(null); setShowCamera(false); }}
                onCancel={() => setShowCamera(false)}
              />
            ) : image ? (
              <img src={image} alt="Selected crop" className="w-full max-h-96 object-contain rounded-lg bg-gray-50" />
            ) : (
              <p className="text-sm text-gray-500">Take or upload a clear photo of the affected leaf.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setShowCamera(true)}><Camera className="w-4 h-4 mr-2" />Camera</Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Upload</Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])} />
              <Button onClick={analyze} disabled={!image || analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Diagnose
              </Button>
            </div>
          </CardContent>
        </Card>

        {a && result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {a.diseaseName}
                <Badge variant="secondary">{Math.round(a.confidence)}%</Badge>
                <Badge variant="outline">{a.cropType}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {a.symptoms?.length > 0 && (
                <div><h4 className="font-semibold mb-1">Symptoms</h4><ul className="list-disc pl-5">{a.symptoms.map((s) => <li key={s}>{s}</li>)}</ul></div>
              )}
              {a.treatment && <div><h4 className="font-semibold mb-1">Treatment</h4><p>{a.treatment}</p></div>}
              {a.prevention?.length > 0 && (
                <div><h4 className="font-semibold mb-1">Prevention</h4><ul className="list-disc pl-5">{a.prevention.map((p) => <li key={p}>{p}</li>)}</ul></div>
              )}
              <p className="text-xs text-gray-500">This is advice, not a guarantee. Consult your agrovet if symptoms spread.</p>

              <div className="border-t pt-4">
                {result.scan.verifiedBy ? (
                  <p className="text-[#198754] font-medium">Thanks for confirming.</p>
                ) : correcting ? (
                  <div className="flex gap-2">
                    <Input value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="What is it? (optional)" maxLength={100} />
                    <Button onClick={() => verify(false)}>Send</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-medium">Was this right?</span>
                    <Button size="sm" variant="outline" onClick={() => verify(true)}><Check className="w-4 h-4 mr-1" />Yes</Button>
                    <Button size="sm" variant="outline" onClick={() => setCorrecting(true)}><X className="w-4 h-4 mr-1" />No</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Recent scans</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No scans yet.</p>
            ) : (
              <ul className="divide-y">
                {history.map((s) => (
                  <li key={s.id} className="py-2 flex justify-between text-sm">
                    <span>{s.diseaseName ?? "Unknown"}{s.verifiedLabel ? ` · confirmed: ${s.verifiedLabel}` : ""}</span>
                    <span className="text-gray-500">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
