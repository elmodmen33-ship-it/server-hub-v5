import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "xterm/css/xterm.css";
import {
  Plus, X, RotateCcw, Trash2, TerminalSquare,
  Eye, EyeOff, Maximize2, Minimize2,
  Palette, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type ConnStatus = "connecting" | "connected" | "reconnecting" | "offline";
type ThemeKey = "dark" | "kali" | "ubuntu" | "hacker" | "dracula";

interface Tab {
  id: string;
  name: string;
  sessionId: string;
}

interface TabResources {
  ws: WebSocket | null;
  term: XTerm | null;
  fitAddon: FitAddon | null;
  heartbeat: ReturnType<typeof setInterval> | null;
}

const KALI_THEME = {
  background: "#1a1a2e",
  foreground: "#00ff41",
  cursor: "#00ff41",
  cursorAccent: "#1a1a2e",
  selection: "rgba(0,255,65,0.3)",
  black: "#0a0a0a", red: "#ff4444", green: "#00ff41", yellow: "#ffd700",
  blue: "#00bfff", magenta: "#ff69b4", cyan: "#00ffff", white: "#e0e0e0",
  brightBlack: "#555555", brightRed: "#ff6666", brightGreen: "#55ff55",
  brightYellow: "#ffff55", brightBlue: "#66bbff", brightMagenta: "#ff99ff",
  brightCyan: "#55ffff", brightWhite: "#ffffff",
};

const DARK_THEME = {
  background: "#0d1117",
  foreground: "#c9d1d9",
  cursor: "#58a6ff",
  cursorAccent: "#0d1117",
  selection: "rgba(88,166,255,0.3)",
  black: "#0d1117", red: "#ff7b72", green: "#3fb950", yellow: "#d29922",
  blue: "#58a6ff", magenta: "#bc8cff", cyan: "#39c5cf", white: "#c9d1d9",
  brightBlack: "#484f58", brightRed: "#ffa198", brightGreen: "#56d364",
  brightYellow: "#e3b341", brightBlue: "#79c0ff", brightMagenta: "#d2a8ff",
  brightCyan: "#56d4dd", brightWhite: "#f0f6fc",
};

const UBUNTU_THEME = {
  background: "#300a24",
  foreground: "#eeeeec",
  cursor: "#eeeeec",
  cursorAccent: "#300a24",
  selection: "rgba(252,233,79,0.3)",
  black: "#2e3436", red: "#cc0000", green: "#4e9a06", yellow: "#c4a000",
  blue: "#3465a4", magenta: "#75507b", cyan: "#06989a", white: "#eeeeec",
  brightBlack: "#555753", brightRed: "#ef2929", brightGreen: "#8ae234",
  brightYellow: "#fce94f", brightBlue: "#729fcf", brightMagenta: "#ad7fa8",
  brightCyan: "#34e2e2", brightWhite: "#ffffff",
};

const HACKER_THEME = {
  background: "#000000",
  foreground: "#00ff00",
  cursor: "#00ff00",
  cursorAccent: "#000000",
  selection: "rgba(0,255,0,0.4)",
  black: "#000000", red: "#ff0000", green: "#00ff00", yellow: "#ffff00",
  blue: "#00aa00", magenta: "#00ff00", cyan: "#00ffaa", white: "#00ff00",
  brightBlack: "#003300", brightRed: "#ff3333", brightGreen: "#55ff55",
  brightYellow: "#ffff55", brightBlue: "#55ff55", brightMagenta: "#55ff55",
  brightCyan: "#55ffaa", brightWhite: "#88ff88",
};

const DRACULA_THEME = {
  background: "#282a36",
  foreground: "#f8f8f2",
  cursor: "#f8f8f2",
  cursorAccent: "#282a36",
  selection: "rgba(68,71,90,0.5)",
  black: "#21222c", red: "#ff5555", green: "#50fa7b", yellow: "#f1fa8c",
  blue: "#bd93f9", magenta: "#ff79c6", cyan: "#8be9fd", white: "#f8f8f2",
  brightBlack: "#6272a4", brightRed: "#ff6e6e", brightGreen: "#69ff94",
  brightYellow: "#ffffa5", brightBlue: "#d6acff", brightMagenta: "#ff92df",
  brightCyan: "#a4ffff", brightWhite: "#ffffff",
};

const THEMES: Record<ThemeKey, { label: string; theme: typeof DARK_THEME; preview: string }> = {
  dark: { label: "GitHub Dark", theme: DARK_THEME, preview: "#0d1117" },
  kali: { label: "Kali", theme: KALI_THEME, preview: "#1a1a2e" },
  ubuntu: { label: "Ubuntu", theme: UBUNTU_THEME, preview: "#300a24" },
  hacker: { label: "Matrix", theme: HACKER_THEME, preview: "#000000" },
  dracula: { label: "Dracula", theme: DRACULA_THEME, preview: "#282a36" },
};

const STORAGE_KEY = "sh_terminal_tabs";

function loadSavedTabs(): Tab[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveTabs(tabs: Tab[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

export default function TerminalPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ConnStatus>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [termTheme, setTermTheme] = useState<ThemeKey>(() => {
    return (localStorage.getItem("sh_term_theme") as ThemeKey) || "kali";
  });
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const resources = useRef<Record<string, TabResources>>({});
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const logsEndRef = useRef<HTMLDivElement>(null);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-100), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  useEffect(() => {
    localStorage.setItem("sh_term_theme", termTheme);
  }, [termTheme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setShowThemePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setStatus = (tabId: string, s: ConnStatus) => setStatuses((prev) => ({ ...prev, [tabId]: s }));

  const buildWsUrl = (sessionId: string) => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/terminal/ws/${sessionId}`;
  };

  const getRes = (tabId: string): TabResources => {
    if (!resources.current[tabId]) resources.current[tabId] = { ws: null, term: null, fitAddon: null, heartbeat: null };
    return resources.current[tabId];
  };

  const connectWs = useCallback((tabId: string, sessionId: string) => {
    const res = getRes(tabId);
    if (res.ws) { res.ws.onclose = null; res.ws.close(); }
    if (res.heartbeat) clearInterval(res.heartbeat);

    setStatus(tabId, "connecting");
    const ws = new WebSocket(buildWsUrl(sessionId));
    res.ws = ws;

    ws.onopen = () => {
      setStatus(tabId, "connected");
      addLog(`Session connected`);
      const { fitAddon } = getRes(tabId);
      if (fitAddon) {
        try {
          fitAddon.fit();
          const dims = fitAddon.proposeDimensions();
          if (dims) ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        } catch {}
      }
      res.heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 25000);
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string);
        const { term } = getRes(tabId);
        if (msg.type === "output" && term) term.write(msg.data);
        else if (msg.type === "exit") { setStatus(tabId, "offline"); addLog(`Session exited`); }
      } catch {}
    };

    ws.onclose = () => {
      const r = getRes(tabId);
      if (r.heartbeat) { clearInterval(r.heartbeat); r.heartbeat = null; }
      setStatus(tabId, "reconnecting");
      addLog(`Disconnected, reconnecting...`);
      setTimeout(() => { if (getRes(tabId).ws === ws || getRes(tabId).ws === null) connectWs(tabId, sessionId); }, 3000);
    };

    ws.onerror = () => { setStatus(tabId, "offline"); addLog(`Connection error`); };
  }, [addLog]);

  const mountTerminal = useCallback((tabId: string, el: HTMLDivElement, sessionId: string) => {
    const res = getRes(tabId);
    if (res.term) return;

    const termThemeObj = THEMES[termTheme].theme;

    const term = new XTerm({
      theme: termThemeObj,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Noto Sans Mono", monospace',
      fontSize: 15,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "bar",
      allowTransparency: true,
      scrollback: 50000,
      smoothScrollDuration: 0,
      drawBoldTextInBrightColors: true,
      minimumContrastRatio: 1,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = "11";
    term.open(el);

    requestAnimationFrame(() => { try { fitAddon.fit(); } catch {} });
    setTimeout(() => { try { fitAddon.fit(); } catch {} }, 100);

    res.term = term;
    res.fitAddon = fitAddon;

    term.onData((data) => {
      const { ws } = getRes(tabId);
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", data }));
    });

    term.attachCustomKeyEventHandler((e) => {
      if (e.type === "keydown" && e.ctrlKey && e.key === "v") {
        navigator.clipboard.readText().then((text) => {
          const { ws } = getRes(tabId);
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "input", data: text }));
        });
        return false;
      }
      return true;
    });

    connectWs(tabId, sessionId);
  }, [connectWs, termTheme]);

  const createTab = useCallback(async (name?: string) => {
    const tabName = name || `Terminal`;
    try {
      const session = await api.createTerminalSession({ name: tabName });
      const tabId = session.id;
      const newTab = { id: tabId, name: tabName, sessionId: session.id };
      setTabs((prev) => {
        const updated = [...prev, newTab];
        saveTabs(updated);
        return updated;
      });
      setActiveTabId(tabId);
      addLog(`Created terminal: ${tabName}`);
      return newTab;
    } catch {
      toast({ title: "Failed to create terminal", variant: "destructive" });
      return null;
    }
  }, [addLog, toast]);

  const closeTab = useCallback((tabId: string) => {
    const res = getRes(tabId);
    if (res.heartbeat) clearInterval(res.heartbeat);
    if (res.ws) { res.ws.onclose = null; res.ws.close(); }
    if (res.term) res.term.dispose();
    delete resources.current[tabId];
    delete containerRefs.current[tabId];
    const tab = tabs.find((t) => t.id === tabId);
    if (tab) api.killTerminalSession(tab.sessionId).catch(() => {});
    setTabs((prev) => {
      const rem = prev.filter((t) => t.id !== tabId);
      saveTabs(rem);
      setActiveTabId((curr) => curr === tabId ? (rem.length > 0 ? rem[rem.length - 1].id : null) : curr);
      return rem;
    });
    setStatuses((prev) => { const n = { ...prev }; delete n[tabId]; return n; });
    addLog(`Closed terminal`);
  }, [tabs, addLog]);

  // Initialize: load saved tabs or create default
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    const saved = loadSavedTabs();
    if (saved.length > 0) {
      setTabs(saved);
      setActiveTabId(saved[0].id);
      addLog("Restored saved sessions");
    } else {
      createTab("Terminal");
    }
  }, [initialized, createTab, addLog]);

  useEffect(() => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const el = containerRefs.current[activeTabId];
    if (!el) return;
    const res = getRes(activeTabId);
    if (res.term) { requestAnimationFrame(() => { try { res.fitAddon?.fit(); } catch {} }); return; }
    mountTerminal(activeTabId, el, tab.sessionId);
  }, [activeTabId, tabs, mountTerminal]);

  useEffect(() => {
    const handleResize = () => {
      for (const tabId of Object.keys(resources.current)) {
        const { fitAddon, ws } = resources.current[tabId];
        if (!fitAddon) continue;
        try {
          fitAddon.fit();
          if (ws?.readyState === WebSocket.OPEN) {
            const dims = fitAddon.proposeDimensions();
            if (dims) ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
          }
        } catch {}
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const newTheme = THEMES[termTheme].theme;
    for (const tabId of Object.keys(resources.current)) {
      const { term } = resources.current[tabId];
      if (term) term.options.theme = newTheme;
    }
  }, [termTheme]);

  const clearActive = () => { if (activeTabId) getRes(activeTabId).term?.clear(); };
  const restartActive = () => {
    if (!activeTabId) return;
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    getRes(activeTabId).term?.clear();
    connectWs(activeTabId, tab.sessionId);
  };

  const activeStatus = activeTabId ? statuses[activeTabId] : undefined;

  const StatusDot = ({ status }: { status: ConnStatus | undefined }) => {
    const colors: Record<string, string> = { connected: "bg-green-500", offline: "bg-red-500", reconnecting: "bg-yellow-500", connecting: "bg-yellow-500" };
    return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${colors[status || "connecting"]} ${status === "connecting" || status === "reconnecting" ? "animate-pulse" : ""}`} />;
  };

  const statusLabel = (s: ConnStatus | undefined) => {
    if (s === "connected") return "Connected";
    if (s === "offline") return "Offline";
    if (s === "reconnecting") return "Reconnecting...";
    return "Connecting";
  };

  const terminalBg = "var(--background)";
  const headerBg = "var(--card)";

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50" : "h-full"}`} style={{ background: terminalBg }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0" style={{ background: headerBg, borderColor: "var(--border)" }}>
        <div className="flex items-center gap-1 flex-1 overflow-x-auto min-w-0 scrollbar-none">
          {tabs.map((tab) => {
            const status = statuses[tab.id];
            const isActive = tab.id === activeTabId;
            return (
              <div key={tab.id} onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-xs font-mono whitespace-nowrap group shrink-0 ${
                  isActive ? "bg-primary/20 text-foreground border border-accent/30" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent"
                }`}>
                <StatusDot status={status} />
                <TerminalSquare className={`w-3.5 h-3.5 ${isActive ? "text-accent" : "text-zinc-600"}`} />
                <span>{tab.name}</span>
                <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all p-0.5 rounded">
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => createTab()} className="h-7 px-2 shrink-0 gap-1 text-xs" title="New Terminal">
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        {activeTabId && (
          <div className="flex items-center gap-2 text-xs px-2 py-1 rounded-md border shrink-0" style={{ background: headerBg, borderColor: "var(--border)" }}>
            <StatusDot status={activeStatus} />
            <span className="text-zinc-500 font-mono">{statusLabel(activeStatus)}</span>
          </div>
        )}

        <div className="relative shrink-0 pl-2 border-l" style={{ borderColor: "var(--border)" }} ref={themePickerRef}>
          <Button variant="ghost" size="sm" onClick={() => setShowThemePicker(!showThemePicker)} title="Theme" className="h-7 px-2 gap-1.5 text-xs">
            <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: THEMES[termTheme].preview }} />
            <Palette className="w-3 h-3" />
            <ChevronDown className="w-3 h-3" />
          </Button>
          {showThemePicker && (
            <div className="absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-xl p-1 min-w-[140px]"
              style={{ background: headerBg, borderColor: "var(--border)" }}>
              {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                <button key={key} onClick={() => { setTermTheme(key); setShowThemePicker(false); }}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors ${
                    termTheme === key ? "bg-primary/20 text-foreground" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                  }`}>
                  <div className="w-3 h-3 rounded-full border border-white/20 shrink-0" style={{ background: THEMES[key].preview }} />
                  <span>{THEMES[key].label}</span>
                  {termTheme === key && <span className="ml-auto text-accent text-[10px]">active</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0 pl-2 border-l" style={{ borderColor: "var(--border)" }}>
          <Button variant="ghost" size="sm" onClick={clearActive} title="Clear" className="h-7 w-7 p-0">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={restartActive} title="Restart" className="h-7 w-7 p-0">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowLogs(!showLogs)} title="Logs" className="h-7 w-7 p-0">
            {showLogs ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} title="Fullscreen" className="h-7 w-7 p-0">
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center border" style={{ background: "rgba(139,92,246,0.1)", borderColor: "rgba(139,92,246,0.2)" }}>
                <TerminalSquare className="w-10 h-10 text-accent opacity-60" />
              </div>
              <div className="text-center">
                <p className="text-zinc-400 text-sm font-medium">No terminal sessions</p>
                <p className="text-zinc-600 text-xs mt-1">Start a new session to run commands</p>
              </div>
              <Button onClick={() => createTab()} className="gap-2 text-white" style={{ background: "linear-gradient(135deg,#6d28d9,#a855f7)" }}>
                <Plus className="w-4 h-4" /> New Terminal
              </Button>
            </div>
          ) : (
            tabs.map((tab) => (
              <div key={tab.id} className="absolute inset-0 p-2" style={{ display: tab.id === activeTabId ? "flex" : "none", flexDirection: "column" }}>
                <div
                  ref={(el) => { containerRefs.current[tab.id] = el; }}
                  className="flex-1 min-h-0 rounded-lg overflow-hidden"
                  style={{ boxShadow: "0 0 15px rgba(139,92,246,0.15), 0 0 30px rgba(139,92,246,0.05)" }}
                />
              </div>
            ))
          )}
        </div>

        {showLogs && (
          <div className="w-80 border-l flex flex-col shrink-0" style={{ background: headerBg, borderColor: "var(--border)" }}>
            <div className="px-3 py-2 border-b text-xs font-semibold text-zinc-500" style={{ borderColor: "var(--border)" }}>
              Live Logs
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-zinc-700 text-center py-4">No logs yet</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`${log.includes("error") || log.includes("Error") ? "text-red-400" : log.includes("connected") || log.includes("created") ? "text-green-400" : log.includes("disconnected") || log.includes("exited") ? "text-yellow-400" : "text-zinc-500"}`}>
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {activeTabId && tabs.length > 0 && (
        <div className="flex items-center justify-between px-4 py-1 border-t shrink-0 text-xs font-mono" style={{ background: headerBg, borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3 text-zinc-700">
            <span>bash</span><span>·</span>
            <span>{tabs.find((t) => t.id === activeTabId)?.name}</span><span>·</span>
            <span className="text-zinc-600">{tabs.length} session(s)</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusDot status={activeStatus} />
            <span className="text-zinc-700">{statusLabel(activeStatus)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
