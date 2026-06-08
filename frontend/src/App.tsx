import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { ToastProvider } from "@/contexts/toast";
import { AuthProvider, useAuth } from "@/contexts/auth";
import { LanguageProvider } from "@/contexts/language";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import TerminalPage from "@/pages/terminal";
import EditorPage from "@/pages/editor";
import FilesPage from "@/pages/files";
import AIPage from "@/pages/ai";
import AdminPage from "@/pages/admin";
import ProfilePage from "@/pages/profile";
import SettingsPage from "@/pages/settings";
import CommandsPage from "@/pages/commands";
import ActivityPage from "@/pages/activity";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen" style={{ background: "#0b0616" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "linear-gradient(135deg,#6d28d9,#a855f7)", boxShadow: "0 0 30px rgba(139,92,246,0.4)" }}>
          <span className="text-white font-bold text-xl">S</span>
        </div>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#8b5cf6", borderTopColor: "transparent" }} />
      </div>
    </div>
  );
}

function useHashRouter() {
  const [path, setPath] = useState(() => {
    const hash = window.location.hash.replace(/^#/, "") || "/";
    return hash;
  });

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace(/^#/, "") || "/";
      setPath(hash);
    };
    window.addEventListener("hashchange", handler);
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("hashchange", handler);
      window.removeEventListener("popstate", handler);
    };
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
  };

  return { path, navigate };
}

function AppRoutes() {
  const { user, isLoading } = useAuth();
  const { path, navigate } = useHashRouter();

  if (isLoading) return <LoadingScreen />;

  if (!user) {
    if (path === "/login") return <LoginPage />;
    return <LoginPage />;
  }

  const renderPage = () => {
    const p = path.split("?")[0];
    switch (p) {
      case "/": return <Dashboard />;
      case "/terminal": return <TerminalPage />;
      case "/editor": return <EditorPage />;
      case "/files": return <FilesPage />;
      case "/ai": return <AIPage />;
      case "/admin": return user.role === "admin" ? <AdminPage /> : <Dashboard />;
      case "/settings": return user.role === "admin" ? <SettingsPage /> : <Dashboard />;
      case "/commands": return <CommandsPage />;
      case "/activity": return user.role === "admin" ? <ActivityPage /> : <Dashboard />;
      case "/profile": return <ProfilePage />;
      default: return <NotFound />;
    }
  };

  return (
    <Layout path={path} navigate={navigate}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <Toaster />
        </ToastProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
