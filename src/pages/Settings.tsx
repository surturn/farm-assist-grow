import { useState, useEffect } from "react";
import { Settings as SettingsIcon, User, Globe, LogOut, Loader2, Save } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const KENYA_REGIONS = [
  "Central Kenya",
  "Rift Valley",
  "Western Kenya",
  "Eastern Kenya",
  "Coast",
  "Nairobi"
];

export default function Settings() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    location: "",
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
            fullName: data.full_name || "",
            phone: data.phone || "",
            location: data.location || "",
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
        toast.error(t('settings.error'));
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [user, t]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const docRef = doc(db, "users", user.uid);
      await updateDoc(docRef, {
        full_name: formData.fullName,
        phone: formData.phone,
        location: formData.location,
      });
      toast.success(t('settings.success'));
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(t('settings.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Main Settings Card */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                {t('settings.title')}
              </CardTitle>
              <CardDescription>
                {t('settings.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t('settings.profile')}
                  </TabsTrigger>
                  <TabsTrigger value="preferences" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t('settings.preferences')}
                  </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input value={user?.email || ""} disabled readOnly className="bg-muted" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t('settings.fullName')}</Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">{t('settings.phoneNumber')}</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location">{t('settings.location')}</Label>
                      <Select
                        value={formData.location}
                        onValueChange={(val) => setFormData({ ...formData, location: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('settings.selectRegion')} />
                        </SelectTrigger>
                        <SelectContent>
                          {KENYA_REGIONS.map((region) => (
                            <SelectItem key={region} value={region}>{region}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4">
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('settings.saving')}
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            {t('settings.save')}
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent value="preferences">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label>{t('settings.language')}</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        {t('settings.languageDesc')}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant={i18n.language === 'en' ? 'default' : 'outline'}
                          onClick={() => changeLanguage('en')}
                          className="w-32"
                        >
                          English
                        </Button>
                        <Button
                          variant={i18n.language === 'sw' ? 'default' : 'outline'}
                          onClick={() => changeLanguage('sw')}
                          className="w-32"
                        >
                          Kiswahili
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Logout Button */}
        <div className="flex justify-end">
          <Button variant="destructive" onClick={handleLogout} className="w-full md:w-auto">
            <LogOut className="mr-2 h-4 w-4" />
            {t('settings.logout')}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
