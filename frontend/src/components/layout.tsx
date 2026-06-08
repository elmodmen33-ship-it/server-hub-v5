import { useState, useEffect } from "react";
import {
  Activity, TerminalSquare, Code, Folder, Bot,
  ChevronLeft, ChevronRight, Menu, Settings, User,
  Shield, LogOut, Globe, X, Bell, Wifi, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { useAuth } from "@/contexts/auth";
import { useLang } from "@/contexts/language";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: React.ReactNode;
  path: string;
  navigate: (to: string) => void;
}

export function Layout({ children, path, navigate }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelStatus, setTunnelStatus] = useState<string>("inactive");
  const { user, logout } = useAuth();
  const { t, lang, setLang, isRTL } = useLang();
  const { toast } = useToast();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (tunnelStatus === "inactive") return;
    const id = setInterval(async () => {
      try {
        const data = await api.getTunnelStatus();
        setTunnelUrl(data.url);
        setTunnelStatus(data.status);
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [tunnelStatus]);

  const handleTunnel = async () => {
    if (tunnelStatus === "active") {
      try {
        await api.stopTunnel();
        setTunnelStatus("inactive");
        setTunnelUrl(null);
        toast({ title: "Tunnel stopped" });
      } catch { toast({ title: "Failed to stop tunnel", variant: "destructive" }); }
    } else {
      try {
        const data = await api.createTunnel();
        setTunnelUrl(data.url);
        setTunnelStatus("active");
        toast({ title: "Tunnel created", description: data.url, variant: "success" });
      } catch { toast({ title: "Failed to create tunnel", variant: "destructive" }); }
    }
  };

  const mainNavItems = [
    { href: "/", label: t("dashboard"), icon: Activity },
    { href: "/terminal", label: t("terminal"), icon: TerminalSquare },
    { href: "/editor", label: t("editor"), icon: Code },
    { href: "/files", label: t("files"), icon: Folder },
    { href: "/ai", label: t("ai_chat"), icon: Bot },
    { href: "/commands", label: t("commands"), icon: BookOpen },
  ];

  const adminNavItems = user?.role === "admin" ? [
    { href: "/admin", label: t("admin"), icon: Shield },
    { href: "/settings", label: t("settings"), icon: Settings },
  ] : [];

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const NavItem = ({ href, label, icon: Icon, onClick }: { href: string; label: string; icon: any; onClick?: () => void }) => (
    <div onClick={() => { navigate(href); onClick?.(); }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 group relative ${
        isActive(href) ? "bg-primary/20 text-white" : "text-zinc-400 hover:text-white hover:bg-white/5"
      }`}>
      {isActive(href) && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: "linear-gradient(180deg,#8b5cf6,#a855f7)" }} />
      )}
      <Icon className={`w-5 h-5 shrink-0 transition-colors ${isActive(href) ? "text-accent" : "text-zinc-500 group-hover:text-zinc-300"}`} />
      {!collapsed && <span className="font-medium text-sm truncate">{label}</span>}
    </div>
  );

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col h-full relative" style={{ background: "var(--sidebar)" }}>
      {/* Purple ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 pointer-events-none opacity-30"
        style={{ background: "radial-gradient(ellipse at center top, rgba(139,92,246,0.4) 0%, transparent 70%)" }} />

      <div className="flex items-center px-4 h-16 border-b shrink-0 relative z-10" style={{ borderColor: "var(--sidebar-border)" }}>
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ boxShadow: "0 0 20px rgba(139,92,246,0.3)", border: "1px solid rgba(139,92,246,0.3)" }}>
            <img src="https://i.ibb.co/s9P5XZrz/IMG-20260525-202044-835.jpg" alt="MODMEN" className="w-full h-full object-cover rounded-xl" />
          </div>
          {!collapsed && (
            <div className="flex flex-col overflow-hidden">
              <span className="text-white font-bold tracking-[0.2em] text-xs" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SERVER HUB</span>
              <span className="text-[9px] text-zinc-500 tracking-wider">v5</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 py-3 flex flex-col gap-0.5 px-2 overflow-y-auto min-h-0">
        {mainNavItems.map((item) => <NavItem key={item.href} {...item} onClick={onNav} />)}
        {adminNavItems.length > 0 && (
          <>
            {!collapsed && <div className="px-3 pt-4 pb-1"><span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Admin</span></div>}
            {collapsed && <div className="my-2 border-t mx-3" style={{ borderColor: "var(--sidebar-border)" }} />}
            {adminNavItems.map((item) => <NavItem key={item.href} {...item} onClick={onNav} />)}
          </>
        )}

        {!collapsed && (
          <div className="px-3 pt-4 pb-1"><span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Theme</span></div>
        )}
        {!collapsed && <div className="px-2"><ThemeSwitcher /></div>}

        {!collapsed && (
          <div className="px-3 pt-4 pb-1"><span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">Tunnel</span></div>
        )}
        {!collapsed && (
          <div className="px-2">
            <button onClick={handleTunnel}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tunnelStatus === "active" ? "bg-green-500/10 text-green-400 border border-green-500/30" : "text-zinc-500 hover:text-white hover:bg-white/5 border border-transparent"
              }`}>
              <Wifi className={`w-3.5 h-3.5 ${tunnelStatus === "active" ? "text-green-400" : ""}`} />
              {tunnelStatus === "active" ? "Tunnel Active" : "Create Tunnel"}
            </button>
            {tunnelUrl && <a href={tunnelUrl} target="_blank" rel="noopener noreferrer" className="block mt-1 px-3 py-1 text-[10px] text-accent font-mono truncate hover:underline">{tunnelUrl}</a>}
          </div>
        )}
      </div>

      <div className="border-t p-2 space-y-0.5 shrink-0" style={{ borderColor: "var(--sidebar-border)" }}>
        {!collapsed && (
          <button onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all text-sm">
            <Globe className="w-5 h-5 shrink-0" />
            <span>{lang === "en" ? "العربية" : "English"}</span>
          </button>
        )}
        <div onClick={() => { navigate("/profile"); onNav?.(); }}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-all ${isActive("/profile") ? "bg-primary/20" : ""}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg,#6d28d9,#a855f7)" }}>
            {(user?.display_name || "?")[0].toUpperCase()}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
              <p className="text-[10px] text-zinc-500 truncate">@{user?.username}</p>
            </div>
          )}
        </div>
        <button onClick={() => { logout(); onNav?.(); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all">
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t("logout")}</span>}
        </button>
        {!isMobile && (
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-2 text-zinc-600 hover:text-zinc-400 transition-colors">
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full overflow-hidden text-foreground"
      style={{ background: "var(--background)", direction: isRTL ? "rtl" : "ltr" }}>
      {!isMobile && (
        <div className="flex-shrink-0 border-r transition-all duration-300 ease-in-out"
          style={{ width: collapsed ? "68px" : "232px", borderColor: "var(--sidebar-border)" }}>
          <SidebarContent />
        </div>
      )}

      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 z-30 flex items-center justify-between px-4 border-b"
          style={{ background: "var(--sidebar)", borderColor: "var(--sidebar-border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden"
              style={{ border: "1px solid rgba(139,92,246,0.3)" }}>
              <img src="https://i.ibb.co/s9P5XZrz/IMG-20260525-202044-835.jpg" alt="MODMEN" className="w-full h-full object-cover rounded-lg" />
            </div>
            <span className="font-bold text-white text-sm tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SERVER HUB</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleTunnel}
              className={`h-8 w-8 p-0 ${tunnelStatus === "active" ? "text-green-400" : "text-zinc-500"}`}>
              <Wifi className="w-4 h-4" />
            </Button>
            <button onClick={() => setMobileOpen(true)} className="text-zinc-400 h-9 w-9 flex items-center justify-center">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 inset-y-0 w-[260px] flex flex-col border-r"
            style={{ background: "var(--sidebar)", borderColor: "var(--sidebar-border)" }}
            onClick={(e) => e.stopPropagation()}>
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className={`flex-1 flex flex-col min-w-0 overflow-hidden ${isMobile ? "pt-14 pb-16" : ""}`}>
        <main className="flex-1 overflow-auto h-full">{children}</main>
      </div>

      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 h-16 z-30 flex items-center justify-around px-1 border-t"
          style={{ background: "var(--sidebar)", borderColor: "var(--sidebar-border)" }}>
          {mainNavItems.map((item) => (
            <div key={item.href} onClick={() => navigate(item.href)}
              className={`flex flex-col items-center justify-center w-14 h-full gap-0.5 cursor-pointer transition-all ${isActive(item.href) ? "text-accent" : "text-zinc-500"}`}>
              <item.icon className="w-5 h-5" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
