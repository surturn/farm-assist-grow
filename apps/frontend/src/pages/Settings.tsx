import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, LogOut, Plus } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { apiClient } from "@/api/client";

const KENYA_REGIONS = [
  "Central Kenya", "Rift Valley", "Western Kenya",
  "Eastern Kenya", "Coast", "Nairobi", "Nyanza", "North Eastern",
];
const LANGUAGES = [{ value: "en", label: "English" }, { value: "sw", label: "Kiswahili" }];

export default function Settings() {
  const { user, logout } = useAuth();
  const { farms, setFarms, setActiveFarmId } = useFarm();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", region: "Central Kenya", preferredLanguage: "en", avatarUrl: "" });
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");

  useEffect(() => {
    apiClient.get("/users/me")
      .then(({ data }) => setForm({
        firstName: data.firstName ?? "", lastName: data.lastName ?? "", phone: data.phone ?? "",
        region: data.region ?? "Central Kenya", preferredLanguage: data.preferredLanguage ?? "en",
        avatarUrl: data.avatarUrl ?? "",
      }))
      .catch(() => toast.error("Failed to load profile."))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const { avatarUrl, ...profile } = form;
      await apiClient.patch("/users/profile", profile);
      i18n.changeLanguage(form.preferredLanguage);
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("File size must be less than 2MB");
    const body = new FormData();
    body.append("avatar", file);
    try {
      const { data } = await apiClient.post("/users/avatar", body, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, avatarUrl: data.avatarUrl }));
      toast.success("Profile picture updated");
    } catch {
      toast.error("Failed to upload avatar");
    }
  };

  const createFarm = async () => {
    if (!farmName.trim()) return toast.error("Farm name is required");
    try {
      const { data } = await apiClient.post("/farms", { name: farmName, location: farmLocation });
      setFarms([...farms, { id: data.id, name: data.name, location: data.location }]);
      setActiveFarmId(data.id);
      setFarmName("");
      setFarmLocation("");
      toast.success("Farm created.");
    } catch {
      toast.error("Failed to create farm.");
    }
  };

  if (loading) {
    return <DashboardLayout><div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={form.avatarUrl} />
                <AvatarFallback>{(form.firstName[0] ?? user?.email?.[0] ?? "F").toUpperCase()}</AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>Change photo</Button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled readOnly /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>First name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Last name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KENYA_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={form.preferredLanguage} onValueChange={(v) => setForm({ ...form, preferredLanguage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Farms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y text-sm">
              {farms.map((f) => <li key={f.id} className="py-2">{f.name}{f.location ? ` · ${f.location}` : ""}</li>)}
            </ul>
            <div className="flex flex-col md:flex-row gap-2">
              <Input placeholder="Farm name" value={farmName} onChange={(e) => setFarmName(e.target.value)} />
              <Input placeholder="Location (optional)" value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} />
              <Button onClick={createFarm}><Plus className="w-4 h-4 mr-1" />Add farm</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={async () => { await logout(); navigate("/login"); }}>
              <LogOut className="w-4 h-4 mr-2" />Log out
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
