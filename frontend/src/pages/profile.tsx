import { useState, useRef } from "react";
import { useAuth } from "@/contexts/auth";
import { useLang } from "@/contexts/language";
import { api, authFetch } from "@/lib/api";
import { Camera, User, Lock, Shield, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function ProfilePage() {
  const { user, refreshMe } = useAuth();
  const { t } = useLang();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [saving, setSaving] = useState(false);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (newPass && newPass !== confirmPass) {
      toast({ title: t("error"), description: t("passwords_dont_match"), variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = { display_name: displayName };
      if (avatar !== user?.avatar) body.avatar = avatar;
      if (newPass) { body.current_password = currentPass; body.new_password = newPass; }
      const res = await authFetch(`/api/auth/profile`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        toast({ title: t("success"), description: t("profile_updated") });
        await refreshMe();
        setCurrentPass(""); setNewPass(""); setConfirmPass("");
      } else {
        const d = await res.json();
        toast({ title: t("error"), description: d.message, variant: "destructive" });
      }
    } finally { setSaving(false); }
  };

  const getDaysLeft = () => {
    if (!user?.expires_at) return null;
    const diff = new Date(user.expires_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const daysLeft = getDaysLeft();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold">{t("profile_title")}</h1><p className="text-zinc-400 text-sm mt-1">{t("account_info")}</p></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl border p-6 flex flex-col items-center gap-4" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)" }}>
            <div className="relative">
              <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold overflow-hidden border-2"
                style={{ borderColor: "#a855f7", background: "linear-gradient(135deg,#6d28d9,#a855f7)" }}>
                {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <span>{(user?.display_name || "?")[0].toUpperCase()}</span>}
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-[#0b0616] transition-colors hover:bg-accent"
                style={{ background: "#6d28d9" }}>
                <Camera className="w-4 h-4 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-white">{user?.display_name}</p>
              <p className="text-zinc-500 text-sm">@{user?.username}</p>
            </div>
          </div>
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)" }}>
            <div className="flex items-center gap-2 text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" /> {t("account_info")}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">{t("role")}</span><span className="text-white capitalize">{user?.role}</span></div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{t("subscription")}</span>
                {user?.expires_at === null ? <span className="text-green-400">{t("unlimited")}</span>
                  : daysLeft === 0 ? <span className="text-red-400">Expired</span>
                  : <span className={daysLeft! < 7 ? "text-yellow-400" : "text-white"}>{daysLeft} {t("days")}</span>}
              </div>
              {user?.expires_at && (
                <div className="flex justify-between"><span className="text-zinc-500">{t("expires")}</span><span className="text-zinc-300 text-xs">{new Date(user.expires_at).toLocaleDateString()}</span></div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border p-5" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)" }}>
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-zinc-300"><User className="w-4 h-4 text-accent" /> {t("display_name")}</div>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-[#1d1033] border-[rgba(139,92,246,0.3)] text-white" placeholder={t("display_name")} />
          </div>
          <div className="rounded-2xl border p-5" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)" }}>
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-zinc-300"><Lock className="w-4 h-4 text-accent" /> {t("change_password")}</div>
            <div className="space-y-3">
              <Input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} placeholder={t("current_password")} className="bg-[#1d1033] border-[rgba(139,92,246,0.3)] text-white placeholder:text-zinc-600" />
              <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t("new_password")} className="bg-[#1d1033] border-[rgba(139,92,246,0.3)] text-white placeholder:text-zinc-600" />
              <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder={t("confirm_password")}
                className={`bg-[#1d1033] border-[rgba(139,92,246,0.3)] text-white placeholder:text-zinc-600 ${newPass && confirmPass && newPass !== confirmPass ? "border-red-500/60" : ""}`} />
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full h-11 font-semibold" style={{ background: "linear-gradient(135deg,#6d28d9,#a855f7)" }}>
            {saving ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t("loading")}</span>
              : <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t("save_profile")}</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
