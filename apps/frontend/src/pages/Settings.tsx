import { useState, useEffect, useRef } from "react";
import {
  User, Sprout, Bell, ShieldCheck, UserCircle2, CreditCard,
  Loader2, Camera, Mail, Phone, MapPin, Globe, Pencil,
  LogOut, Trash2, Lock, CalendarDays, ChevronRight, Plus
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useFarm } from "@/contexts/FarmContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { apiClient } from "@/api/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const KENYA_REGIONS = [
  "Central Kenya", "Rift Valley", "Western Kenya",
  "Eastern Kenya", "Coast", "Nairobi", "Nyanza", "North Eastern",
];

const UNITS_OPTIONS = [
  { value: "metric", label: "Metric (°C, kg, ha)" },
  { value: "imperial", label: "Imperial (°F, lb, ac)" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "sw", label: "Kiswahili" },
];

type Section = "profile" | "farm" | "notifications" | "security" | "account" | "billing";

const NAV_ITEMS: { id: Section; label: string; sub: string; icon: any }[] = [
  { id: "profile", label: "Profile", sub: "Personal information", icon: User },
  { id: "farm", label: "Farm Preferences", sub: "Location, units & language", icon: Sprout },
  { id: "notifications", label: "Notifications", sub: "Alerts and updates", icon: Bell },
  { id: "security", label: "Security", sub: "Password & 2FA", icon: ShieldCheck },
  { id: "account", label: "Account", sub: "Logout and account actions", icon: UserCircle2 },
  { id: "billing", label: "Billing", sub: "Manage your subscription", icon: CreditCard },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const { farms, setFarms, setActiveFarmId } = useFarm();
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const location = useLocation();

  const [activeSection, setActiveSection] = useState<Section>(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    return (tab as Section) || "profile";
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    if (tab && NAV_ITEMS.some(item => item.id === tab)) {
      setActiveSection(tab as Section);
    }
  }, [location.search]);
  
  const [isCreatingFarm, setIsCreatingFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLocation, setNewFarmLocation] = useState("Central Kenya");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    location: "Central Kenya",
    units: "metric",
    language: "en",
    role: "Farmer",
    memberSince: "",
    avatarUrl: "",
  });

  const [notifications, setNotifications] = useState({
    weatherAlerts: true,
    pestOutbreakAlerts: true,
    governmentSubsidies: true,
    weeklyAiReport: true,
    smsNotifications: false,
  });

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFormData({
            fullName: data.full_name || user.displayName || "",
            phone: data.phone || "",
            location: data.location || "Central Kenya",
            units: data.units || "metric",
            language: data.language || "en",
            role: data.role || "Farmer",
            avatarUrl: data.avatarUrl || "",
            memberSince: data.createdAt
              ? format(new Date(data.createdAt), "MMMM yyyy")
              : user.metadata?.creationTime
              ? format(new Date(user.metadata.creationTime), "MMMM yyyy")
              : "",
          });
          if (data.notifications) {
            setNotifications({ ...notifications, ...data.notifications });
          }
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Save to Firebase Firestore (legacy/auth settings)
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, {
        full_name: formData.fullName,
        phone: formData.phone,
        location: formData.location,
        units: formData.units,
        language: formData.language,
        notifications,
      }, { merge: true });

      // 2. Save to Postgres via API
      try {
        await apiClient.patch('/users/profile', {
          region: formData.location,
          phone: formData.phone,
          preferredLanguage: formData.language
        });
      } catch (apiError) {
        console.error("Failed to sync profile to Postgres database", apiError);
      }

      i18n.changeLanguage(formData.language);
      toast.success("Settings saved successfully.");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFarm = async () => {
    if (!newFarmName.trim()) {
      toast.error("Farm name is required");
      return;
    }
    
    setIsCreatingFarm(true);
    try {
      const { data } = await apiClient.post('/farms', {
        name: newFarmName,
        location: newFarmLocation
      });
      
      const newFarm = { id: data.id, name: data.name, location: data.location };
      setFarms([...farms, newFarm]);
      setActiveFarmId(data.id);
      
      setNewFarmName("");
      toast.success("Farm created successfully!");
    } catch (error) {
      console.error("Error creating farm:", error);
      toast.error("Failed to create farm.");
    } finally {
      setIsCreatingFarm(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Only JPEG, PNG, and WebP images are supported");
      return;
    }

    setUploadingAvatar(true);
    const form = new FormData();
    form.append("avatar", file);

    try {
      const { data } = await apiClient.post('/users/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Store as relative URL — works through Vite proxy in dev
      const avatarUrl = data.avatarUrl;
      
      setFormData(prev => ({ ...prev, avatarUrl }));
      
      // Persist to firestore
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { avatarUrl }, { merge: true });
      
      toast.success("Profile picture updated");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload avatar");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getUserInitials = () => {
    if (formData.fullName) {
      return formData.fullName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || "FA";
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#198754]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto pb-10">

        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-400 font-medium">Manage your account and application preferences</p>
          </div>
        </div>

        <div className="flex gap-6">

          {/* Left Panel: Profile Card + Nav */}
          <div className="w-[260px] shrink-0 space-y-4">

            {/* Profile Card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
              <div className="relative mb-3">
                <Avatar className="w-20 h-20 border-4 border-white shadow-md">
                  <AvatarImage src={formData.avatarUrl} alt="Avatar" className="object-cover" />
                  <AvatarFallback className="bg-[#198754] text-white text-xl font-bold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleAvatarUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 text-[#198754] animate-spin" /> : <Camera className="w-3.5 h-3.5 text-gray-600" />}
                </button>
              </div>
              <p className="font-bold text-gray-900 text-base">{formData.fullName || user?.email?.split("@")[0] || "Farmer"}</p>
              <p className="text-sm text-gray-500 mt-0.5">
                {formData.role} {formData.location ? `• ${formData.location}` : ""}
              </p>
              <Badge className="mt-2 bg-[#f2f9f5] text-[#198754] border border-green-200 font-semibold text-xs hover:bg-[#f2f9f5]">
                Free Plan
              </Badge>
              {formData.memberSince && (
                <div className="mt-4 pt-4 border-t border-gray-100 w-full flex flex-col items-center gap-1">
                  <p className="text-[11px] text-gray-400 font-medium">Member since</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {formData.memberSince}
                  </div>
                </div>
              )}
            </div>

            {/* Section Navigation */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {NAV_ITEMS.map((item, i) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-50 last:border-0
                      ${isActive ? "bg-[#f2f9f5] border-l-2 border-l-[#198754]" : "hover:bg-gray-50/80"}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#198754]" : "text-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isActive ? "text-[#198754]" : "text-gray-700"}`}>{item.label}</p>
                      <p className="text-[11px] text-gray-400 truncate">{item.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Upgrade Card */}
            <div className="bg-[#0f5132] rounded-2xl p-5 relative overflow-hidden">
              <Sprout className="absolute -bottom-4 -right-4 w-20 h-20 text-white/5" />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-400 text-base">★</span>
                <span className="text-white font-bold text-sm">FarmAssist Pro</span>
              </div>
              <p className="text-white/70 text-xs leading-relaxed mb-3">
                Unlock unlimited scans, advanced insights and smart farm reports.
              </p>
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full bg-[#198754] hover:bg-[#146c43] text-white text-xs font-semibold h-9 rounded-lg">
                    Upgrade Now →
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upgrade to FarmAssist Pro</DialogTitle>
                    <DialogDescription>
                      Get unlimited AI disease scans, weather forecasts for multiple farms, and dedicated agronomist support.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex justify-end">
                    <Button onClick={() => toast.success("Billing integration coming soon!")} className="bg-[#198754] text-white hover:bg-[#146c43]">
                      Proceed to Checkout
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Need Help */}
            <a href="mailto:support@farmassist.app" className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-500 font-bold">?</span>
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold text-gray-700">Need help?</p>
                  <p className="text-[10px] text-gray-400">Contact support</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </a>
          </div>

          {/* Right Panel: Settings Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Profile Section */}
              {activeSection === "profile" && (
                <div>
                  <SectionHeader icon={User} title="Personal Information" sub="Update your personal details." />
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input value={user?.email || ""} disabled readOnly className="pl-9 bg-gray-50 border-gray-200 text-gray-500 text-sm" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Full Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            placeholder="Your full name"
                            className="pl-9 border-gray-200 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Phone Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="+254 7XX XXX XXX"
                            className="pl-9 border-gray-200 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />
                  <SectionHeader icon={Sprout} title="Farm Preferences" sub="Set your farm related preferences." />
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Region</Label>
                        <Select value={formData.location} onValueChange={(v) => setFormData({ ...formData, location: v })}>
                          <SelectTrigger className="border-gray-200 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {KENYA_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Preferred Units</Label>
                        <Select value={formData.units} onValueChange={(v) => setFormData({ ...formData, units: v })}>
                          <SelectTrigger className="border-gray-200 text-sm">
                            <Pencil className="w-4 h-4 text-gray-400 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Language</Label>
                        <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                          <SelectTrigger className="border-gray-200 text-sm">
                            <Globe className="w-4 h-4 text-gray-400 mr-2" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGE_OPTIONS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      Your location helps us provide accurate weather updates and relevant advice.
                    </p>
                  </div>

                  <div className="border-t border-gray-100" />
                  <SectionHeader icon={Bell} title="Notifications" sub="Choose what updates you want to receive." />
                  <div className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-4">
                      {[
                        { key: "weatherAlerts", label: "Weather Alerts" },
                        { key: "pestOutbreakAlerts", label: "Pest Outbreak Alerts" },
                        { key: "governmentSubsidies", label: "Government Subsidies" },
                        { key: "weeklyAiReport", label: "Weekly AI Report" },
                      ].map((n) => (
                        <div key={n.key} className="flex items-center gap-2">
                          <Checkbox
                            id={n.key}
                            checked={notifications[n.key as keyof typeof notifications]}
                            onCheckedChange={(v) => setNotifications({ ...notifications, [n.key]: !!v })}
                            className="data-[state=checked]:bg-[#198754] data-[state=checked]:border-[#198754] border-gray-300"
                          />
                          <label htmlFor={n.key} className="text-sm font-medium text-gray-700 cursor-pointer">{n.label}</label>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 mt-4">
                      <Checkbox
                        id="sms"
                        checked={notifications.smsNotifications}
                        onCheckedChange={(v) => setNotifications({ ...notifications, smsNotifications: !!v })}
                        className="data-[state=checked]:bg-[#198754] data-[state=checked]:border-[#198754] border-gray-300 mt-0.5"
                      />
                      <div>
                        <label htmlFor="sms" className="text-sm font-medium text-gray-700 cursor-pointer">SMS Notifications</label>
                        <p className="text-[11px] text-gray-400 mt-0.5">Receive important alerts via SMS</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />
                  <SectionHeader icon={ShieldCheck} title="Security" sub="Manage your account security." />
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1 flex items-center gap-4">
                        <div className="flex-1 space-y-2">
                          <Label className="text-xs font-semibold text-gray-600">Password</Label>
                          <Input type="password" value="••••••••••••••" readOnly className="border-gray-200 text-sm bg-gray-50" />
                        </div>
                        <div className="pt-6">
                          <Button variant="outline" className="border-[#198754] text-[#198754] hover:bg-[#f2f9f5] text-xs font-semibold h-9 gap-2">
                            <Lock className="w-3.5 h-3.5" /> Change Password
                          </Button>
                        </div>
                      </div>
                      <div className="flex-1 border-l border-gray-100 pl-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-semibold text-gray-700">Two-Factor Authentication</p>
                            <p className="text-xs text-gray-400 mt-1">Add an extra layer of security to your account.</p>
                          </div>
                          <Badge className="bg-red-50 text-red-500 border border-red-100 text-xs font-semibold hover:bg-red-50">Disabled</Badge>
                        </div>
                        <Button variant="outline" className="mt-3 border-[#198754] text-[#198754] hover:bg-[#f2f9f5] text-xs font-semibold h-9 gap-2">
                          <ShieldCheck className="w-3.5 h-3.5" /> Enable 2FA
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100" />
                  <SectionHeader icon={UserCircle2} title="Account" sub="Manage your account actions." />
                  <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[#198754]">Log Out</p>
                        <p className="text-xs text-gray-400 mt-1 mb-3">Sign out of your account on this device.</p>
                        <Button
                          variant="outline"
                          onClick={handleLogout}
                          className="border-[#198754] text-[#198754] hover:bg-[#f2f9f5] text-xs font-semibold h-9 gap-2"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Log Out
                        </Button>
                      </div>
                      <div className="flex-1 border-l border-gray-100 pl-6">
                        <p className="text-sm font-semibold text-red-500">Delete Account</p>
                        <p className="text-xs text-gray-400 mt-1 mb-3">Permanently delete your account and all data.</p>
                        <Button
                          variant="outline"
                          className="border-red-200 text-red-500 hover:bg-red-50 text-xs font-semibold h-9 gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Farm Preferences Section */}
              {activeSection === "farm" && (
                <div>
                  <SectionHeader icon={Sprout} title="Farm Preferences" sub="Set your farm related preferences." />
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Region</Label>
                        <Select value={formData.location} onValueChange={(v) => setFormData({ ...formData, location: v })}>
                          <SelectTrigger className="border-gray-200 text-sm">
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent>
                            {KENYA_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Preferred Units</Label>
                        <Select value={formData.units} onValueChange={(v) => setFormData({ ...formData, units: v })}>
                          <SelectTrigger className="border-gray-200 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNITS_OPTIONS.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Language</Label>
                        <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                          <SelectTrigger className="border-gray-200 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LANGUAGE_OPTIONS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      Your location helps us provide accurate weather updates and relevant advice.
                    </p>
                    
                    <div className="border-t border-gray-100 pt-6 mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">Your Farms</h4>
                          <p className="text-[11px] text-gray-400">Manage the farms you own or have access to.</p>
                        </div>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button className="bg-[#f2f9f5] hover:bg-[#e5f3eb] text-[#198754] text-xs font-semibold h-8 px-3 border border-green-200 shadow-sm gap-1.5 rounded-lg">
                              <Plus className="w-3.5 h-3.5" /> New Farm
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create a New Farm</DialogTitle>
                              <DialogDescription>
                                Add a new farm to your account to track crops, tasks, and scans separately.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Farm Name</Label>
                                <Input 
                                  value={newFarmName}
                                  onChange={(e) => setNewFarmName(e.target.value)}
                                  placeholder="e.g. Sunny Acres Farm" 
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Region</Label>
                                <Select value={newFarmLocation} onValueChange={setNewFarmLocation}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select region" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {KENYA_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                onClick={handleCreateFarm} 
                                disabled={isCreatingFarm || !newFarmName.trim()} 
                                className="bg-[#198754] text-white hover:bg-[#146c43]"
                              >
                                {isCreatingFarm ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Create Farm
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      
                      {farms.length === 0 ? (
                        <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                          <p className="text-sm text-gray-500">You don't have any farms yet.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {farms.map(farm => (
                            <div key={farm.id} className="p-4 border border-gray-100 bg-white rounded-xl shadow-sm flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#f2f9f5] flex items-center justify-center shrink-0 mt-0.5">
                                <MapPin className="w-4 h-4 text-[#198754]" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{farm.name}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{farm.location || "Unknown location"}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications Section */}
              {activeSection === "notifications" && (
                <div>
                  <SectionHeader icon={Bell} title="Notifications" sub="Choose what updates you want to receive." />
                  <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-5">
                      {[
                        { key: "weatherAlerts", label: "Weather Alerts" },
                        { key: "pestOutbreakAlerts", label: "Pest Outbreak Alerts" },
                        { key: "governmentSubsidies", label: "Government Subsidies" },
                        { key: "weeklyAiReport", label: "Weekly AI Report" },
                      ].map((n) => (
                        <div key={n.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`notif-${n.key}`}
                            checked={notifications[n.key as keyof typeof notifications]}
                            onCheckedChange={(v) => setNotifications({ ...notifications, [n.key]: !!v })}
                            className="data-[state=checked]:bg-[#198754] data-[state=checked]:border-[#198754] border-gray-300"
                          />
                          <label htmlFor={`notif-${n.key}`} className="text-sm font-medium text-gray-700 cursor-pointer">{n.label}</label>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
                      <Checkbox
                        id="sms2"
                        checked={notifications.smsNotifications}
                        onCheckedChange={(v) => setNotifications({ ...notifications, smsNotifications: !!v })}
                        className="data-[state=checked]:bg-[#198754] data-[state=checked]:border-[#198754] border-gray-300 mt-0.5"
                      />
                      <div>
                        <label htmlFor="sms2" className="text-sm font-medium text-gray-700 cursor-pointer">SMS Notifications</label>
                        <p className="text-[11px] text-gray-400 mt-0.5">Receive important alerts via SMS</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Security Section */}
              {activeSection === "security" && (
                <div>
                  <SectionHeader icon={ShieldCheck} title="Security" sub="Manage your account security." />
                  <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <Label className="text-xs font-semibold text-gray-600">Password</Label>
                        <Input type="password" value="••••••••••••••" readOnly className="border-gray-200 text-sm bg-gray-50" />
                      </div>
                      <div className="pt-6">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="border-[#198754] text-[#198754] hover:bg-[#f2f9f5] text-xs font-semibold h-9 gap-2">
                              <Lock className="w-3.5 h-3.5" /> Change Password
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Change Password</DialogTitle>
                              <DialogDescription>Enter your new password below to update your credentials.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Current Password</Label>
                                <Input type="password" />
                              </div>
                              <div className="space-y-2">
                                <Label>New Password</Label>
                                <Input type="password" />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => toast.success("Password changed successfully")} className="bg-[#198754] text-white hover:bg-[#146c43]">Save Password</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-6 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">Two-Factor Authentication</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-xs">Add an extra layer of security to your account.</p>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="mt-3 border-[#198754] text-[#198754] hover:bg-[#f2f9f5] text-xs font-semibold h-9 gap-2">
                              <ShieldCheck className="w-3.5 h-3.5" /> Enable 2FA
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
                              <DialogDescription>Secure your account by linking an authenticator app.</DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <p className="text-sm text-gray-600">Scan this QR code with Google Authenticator or Authy to proceed.</p>
                              <div className="w-32 h-32 bg-gray-100 mx-auto mt-4 rounded flex items-center justify-center">
                                <span className="text-gray-400 text-xs text-center p-2">QR Code Placeholder</span>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={() => toast.success("2FA Enabled")} className="bg-[#198754] text-white hover:bg-[#146c43]">Verify & Enable</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <Badge className="bg-red-50 text-red-500 border border-red-100 text-xs font-semibold hover:bg-red-50">Disabled</Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Account Section */}
              {activeSection === "account" && (
                <div>
                  <SectionHeader icon={UserCircle2} title="Account" sub="Manage your account actions." />
                  <div className="p-6 space-y-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1 p-5 border border-gray-100 rounded-xl">
                        <p className="text-sm font-bold text-[#198754]">Log Out</p>
                        <p className="text-xs text-gray-400 mt-1 mb-4">Sign out of your account on this device.</p>
                        <Button variant="outline" onClick={handleLogout} className="border-[#198754] text-[#198754] hover:bg-[#f2f9f5] text-xs font-semibold h-9 gap-2">
                          <LogOut className="w-3.5 h-3.5" /> Log Out
                        </Button>
                      </div>
                      <div className="flex-1 p-5 border border-red-100 rounded-xl bg-red-50/30">
                        <p className="text-sm font-bold text-red-500">Delete Account</p>
                        <p className="text-xs text-gray-400 mt-1 mb-4">Permanently delete your account and all data.</p>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="border-red-300 text-red-500 hover:bg-red-50 text-xs font-semibold h-9 gap-2">
                              <Trash2 className="w-3.5 h-3.5" /> Delete Account
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete your account
                                and remove your farm data from our servers.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => toast.success("Account deletion requested.")} className="bg-red-600 hover:bg-red-700 text-white">
                                Delete Account
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Billing Section */}
              {activeSection === "billing" && (
                <div>
                  <SectionHeader icon={CreditCard} title="Billing" sub="Manage your subscription and billing." />
                  <div className="p-6 flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <CreditCard className="w-10 h-10 text-gray-200" />
                    <p className="text-sm font-medium text-gray-500">You are on the Free Plan</p>
                    <p className="text-[11px] text-gray-400 max-w-xs">Upgrade to FarmAssist Pro to unlock unlimited scans, advanced insights and smart farm reports.</p>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button className="bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold h-10 px-6 rounded-xl mt-2">
                          Upgrade to Pro →
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Upgrade to FarmAssist Pro</DialogTitle>
                          <DialogDescription>
                            Get unlimited AI disease scans, weather forecasts for multiple farms, and dedicated agronomist support.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-end mt-4">
                          <Button onClick={() => toast.success("Billing integration coming soon!")} className="bg-[#198754] text-white hover:bg-[#146c43]">
                            Proceed to Checkout
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}

            </div>

            {/* Action Footer */}
            <div className="flex justify-end gap-3 mt-5">
              <Button onClick={() => navigate(-1)} variant="outline" className="border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold h-10 px-6">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold h-10 px-6 gap-2 rounded-xl"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sprout className="w-4 h-4" />}
                Save Changes
              </Button>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}

function SectionHeader({ icon: Icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/50">
      <div className="w-8 h-8 rounded-lg bg-[#f2f9f5] flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#198754]" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-400">{sub}</p>
      </div>
    </div>
  );
}
