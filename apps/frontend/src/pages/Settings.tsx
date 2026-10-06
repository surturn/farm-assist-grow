import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { apiClient } from "@/api/client";
import { KENYA_REGIONS } from "@/lib/weather";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
];

type Profile = { firstName: string; lastName: string; phone: string; region: string; preferredLanguage: string };
const EMPTY: Profile = { firstName: "", lastName: "", phone: "", region: "Central Kenya", preferredLanguage: "en" };

function Section({ id, title, description, children }: { id?: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 border-t py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_1fr] md:gap-8">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { farms, setFarms, setActiveFarmId } = useFarm();
  const { i18n } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Profile | null>(null);
  const [form, setForm] = useState<Profile>(EMPTY);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmLocation, setFarmLocation] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiClient
      .get("/users/me")
      .then(({ data }) => {
        const p: Profile = {
          firstName: data.firstName ?? "",
          lastName: data.lastName ?? "",
          phone: data.phone ?? "",
          region: data.region ?? "Central Kenya",
          preferredLanguage: data.preferredLanguage ?? "en",
        };
        setSaved(p);
        setForm(p);
        setAvatarUrl(data.avatarUrl ?? "");
      })
      .catch(() => toast.error("Couldn't load your profile."));
  }, []);

  useEffect(() => {
    if (saved && window.location.hash === "#farms") document.getElementById("farms")?.scrollIntoView();
  }, [saved]);

  const dirty = saved !== null && (Object.keys(form) as (keyof Profile)[]).some((k) => form[k] !== saved[k]);
  const set = (k: keyof Profile) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch("/users/profile", form);
      setSaved(form);
      i18n.changeLanguage(form.preferredLanguage);
      toast.success("Profile saved.");
    } catch {
      toast.error("Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Choose an image under 2 MB.");
    const body = new FormData();
    body.append("avatar", file);
    try {
      const { data } = await apiClient.post("/users/avatar", body, { headers: { "Content-Type": "multipart/form-data" } });
      setAvatarUrl(data.avatarUrl);
      toast.success("Photo updated.");
    } catch {
      toast.error("Couldn't upload that photo.");
    }
  };

  const createFarm = async () => {
    if (!farmName.trim()) return toast.error("Give the farm a name.");
    setCreating(true);
    try {
      const { data } = await apiClient.post("/farms", { name: farmName.trim(), location: farmLocation.trim() });
      setFarms([...farms, { id: data.id, name: data.name, location: data.location }]);
      setActiveFarmId(data.id);
      setFarmName("");
      setFarmLocation("");
      toast.success(`${data.name} added and selected.`);
    } catch {
      toast.error("Couldn't add the farm. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const initial = (form.firstName[0] ?? user?.email?.[0] ?? "F").toUpperCase();

  return (
    <DashboardLayout>
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <div className="mt-8">
        <Section title="Profile" description="How you appear and how we reach you.">
          {saved === null ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="space-y-5"
            >
              <div className="flex items-center gap-4">
                <Avatar className="size-12">
                  <AvatarImage src={avatarUrl} alt="" />
                  <AvatarFallback className="bg-secondary font-medium">{initial}</AvatarFallback>
                </Avatar>
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  Change photo
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => uploadAvatar(e.target.files?.[0])}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="firstName" label="First name">
                  <Input id="firstName" autoComplete="given-name" value={form.firstName} onChange={(e) => set("firstName")(e.target.value)} />
                </Field>
                <Field id="lastName" label="Last name">
                  <Input id="lastName" autoComplete="family-name" value={form.lastName} onChange={(e) => set("lastName")(e.target.value)} />
                </Field>
                <Field id="email" label="Email" hint="Used to sign in. Can't be changed here.">
                  <Input id="email" value={user?.email ?? ""} disabled readOnly />
                </Field>
                <Field id="phone" label="Phone" hint="Format: +254 7XX XXX XXX">
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
                </Field>
                <Field id="region" label="Region" hint="Sets the weather on your overview.">
                  <Select value={form.region} onValueChange={set("region")}>
                    <SelectTrigger id="region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KENYA_REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="language" label="Language">
                  <Select value={form.preferredLanguage} onValueChange={set("preferredLanguage")}>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.value} value={l.value}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={!dirty || saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
                {dirty && (
                  <Button type="button" variant="ghost" onClick={() => setForm(saved)}>
                    Discard
                  </Button>
                )}
              </div>
            </form>
          )}
        </Section>

        <Section id="farms" title="Farms" description="Scans and weather follow the farm selected in the sidebar.">
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {farms.length === 0 ? (
              <li className="px-4 py-3 text-muted-foreground">No farms yet.</li>
            ) : (
              farms.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="font-medium">{f.name}</span>
                  <span className="truncate text-muted-foreground">{f.location}</span>
                </li>
              ))
            )}
          </ul>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              createFarm();
            }}
          >
            <Field id="farmName" label="Farm name">
              <Input id="farmName" value={farmName} onChange={(e) => setFarmName(e.target.value)} placeholder="e.g. Upper plot" />
            </Field>
            <Field id="farmLocation" label="Location (optional)">
              <Input id="farmLocation" value={farmLocation} onChange={(e) => setFarmLocation(e.target.value)} placeholder="e.g. Kericho" />
            </Field>
            <Button type="submit" variant="outline" disabled={creating}>
              Add farm
            </Button>
          </form>
        </Section>
      </div>
    </DashboardLayout>
  );
}
