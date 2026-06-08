import { useState, useEffect, useCallback } from "react";
import {
  Activity, Cpu, HardDrive, Server, Network, Clock,
  Zap, MemoryStick, Wifi, X, RefreshCw,
  TrendingUp, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/language";
import { api } from "@/lib/api";

function RadialProgress({ value, size = 80, stroke = 8, color = "#8b5cf6" }: {
  value: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

function MetricCard({ title, value, percent, sub, icon: Icon, color = "#8b5cf6" }: {
  title: string; value: string; percent?: number; sub?: string; icon: any; color?: string;
}) {
  const isHigh = (percent || 0) > 85;
  const isMed = (percent || 0) > 65;
  const ringColor = isHigh ? "#ef4444" : isMed ? "#f59e0b" : color;
  return (
    <div className="relative rounded-2xl border p-5 overflow-hidden flex flex-col gap-3"
      style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
        </div>
        {percent !== undefined ? (
          <div className="relative flex items-center justify-center">
            <RadialProgress value={percent} size={64} stroke={6} color={ringColor} />
            <span className="absolute text-xs font-bold" style={{ color: ringColor }}>{Math.round(percent)}%</span>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        )}
      </div>
      {percent !== undefined && (
        <div className="h-1.5 rounded-full overflow-hidden bg-white/5">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, percent)}%`, background: `linear-gradient(90deg, ${ringColor}80, ${ringColor})` }} />
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${ringColor}40, transparent)` }} />
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { t } = useLang();
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [ports, setPorts] = useState<any[]>([]);
  const [portsLoading, setPortsLoading] = useState(true);
  const [processes, setProcesses] = useState<any[]>([]);
  const [processesLoading, setProcessesLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try { setStats(await api.getSystemStats()); } catch {} finally { setStatsLoading(false); }
  }, []);
  const fetchPorts = useCallback(async () => {
    try { setPorts(await api.getSystemPorts()); } catch {} finally { setPortsLoading(false); }
  }, []);
  const fetchProcesses = useCallback(async () => {
    try { setProcesses(await api.getSystemProcesses()); } catch {} finally { setProcessesLoading(false); }
  }, []);

  useEffect(() => {
    fetchStats(); fetchPorts(); fetchProcesses();
    const si = setInterval(fetchStats, 3000);
    const pi = setInterval(fetchPorts, 10000);
    const pri = setInterval(fetchProcesses, 5000);
    const ci = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(si); clearInterval(pi); clearInterval(pri); clearInterval(ci); };
  }, []);

  const handleKill = async (pid: number) => {
    try {
      await api.killProcess(pid);
      toast({ title: "Process killed", description: `PID ${pid} terminated` });
      fetchProcesses();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to kill process", variant: "destructive" });
    }
  };

  return (
    <div className="p-5 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" /> {t("system_overview")}
          </h1>
          <p className="text-zinc-500 text-sm mt-0.5">{t("live_monitoring")}</p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)" }}>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <Globe className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-mono text-zinc-300 text-xs">{stats.hostname}</span>
              {stats.ip && <span className="text-zinc-600 text-xs font-mono">{stats.ip}</span>}
            </div>
          )}
          <div className="text-xs font-mono text-zinc-600 tabular-nums">{now.toLocaleTimeString()}</div>
          <Button variant="ghost" size="sm" onClick={fetchStats} className="h-8 w-8 p-0 text-zinc-500 hover:text-white">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ background: "#140a24" }} />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title={t("cpu_usage")} value={`${stats.cpu_percent?.toFixed(1) || "0"}%`} percent={stats.cpu_percent}
            sub={`${stats.cpu_count} ${t("cores")} · ${t("load")}: ${stats.load_avg?.toFixed(2) ?? "N/A"}`} icon={Cpu} color="#8b5cf6" />
          <MetricCard title={t("memory")} value={stats.mem_used} percent={stats.mem_percent}
            sub={`${t("of")} ${stats.mem_total}${stats.mem_available ? ` · ${stats.mem_available} free` : ""}`} icon={MemoryStick} color="#a855f7" />
          <MetricCard title={t("disk_space")} value={stats.disk_used} percent={stats.disk_percent}
            sub={`${t("of")} ${stats.disk_total}${stats.disk_free ? ` · ${stats.disk_free} free` : ""}`} icon={HardDrive} color="#6d28d9" />
          <MetricCard title={t("uptime")} value={stats.uptime}
            sub={stats.timestamp ? new Date(stats.timestamp).toLocaleDateString() : undefined} icon={Clock} color="#7c3aed" />
        </div>
      ) : null}

      {stats && (stats.net_sent || stats.net_recv || stats.cpu_freq) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.net_sent && (
            <div className="rounded-2xl border p-4 flex items-center gap-4" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.15)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,197,94,0.1)" }}>
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div><p className="text-xs text-zinc-500 uppercase tracking-wider">Net Sent</p><p className="text-base font-bold text-white font-mono">{stats.net_sent}</p></div>
            </div>
          )}
          {stats.net_recv && (
            <div className="rounded-2xl border p-4 flex items-center gap-4" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.15)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(59,130,246,0.1)" }}>
                <Network className="w-5 h-5 text-blue-400" />
              </div>
              <div><p className="text-xs text-zinc-500 uppercase tracking-wider">Net Received</p><p className="text-base font-bold text-white font-mono">{stats.net_recv}</p></div>
            </div>
          )}
          {stats.cpu_freq && (
            <div className="rounded-2xl border p-4 flex items-center gap-4" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.15)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(139,92,246,0.1)" }}>
                <Zap className="w-5 h-5 text-accent" />
              </div>
              <div><p className="text-xs text-zinc-500 uppercase tracking-wider">CPU Frequency</p><p className="text-base font-bold text-white font-mono">{stats.cpu_freq}</p></div>
            </div>
          )}
          <div className="rounded-2xl border p-4 flex items-center gap-4" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.15)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(168,85,247,0.1)" }}>
              <Server className="w-5 h-5 text-accent" />
            </div>
            <div><p className="text-xs text-zinc-500 uppercase tracking-wider">Processes</p><p className="text-base font-bold text-white font-mono">{stats.processes}</p></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border flex flex-col" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)", minHeight: 360, maxHeight: 420 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
            <div className="flex items-center gap-2"><Wifi className="w-4 h-4 text-accent" /><span className="font-semibold text-sm">{t("open_ports")}</span></div>
            <Badge className="text-xs bg-accent/10 text-accent border-accent/20">{ports?.length ?? 0}</Badge>
          </div>
          <div className="flex-1 overflow-auto">
            {portsLoading ? (
              <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 w-full rounded-lg animate-pulse" style={{ background: "#1d1033" }} />)}</div>
            ) : ports && ports.length > 0 ? (
              <div className="divide-y divide-white/5">
                {ports.map((port, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-0.5 rounded text-xs font-mono font-bold border" style={{ background: "rgba(139,92,246,0.15)", borderColor: "rgba(139,92,246,0.3)", color: "#a855f7" }}>
                        :{port.port}
                      </div>
                      <div><span className="text-sm font-medium text-white">{port.process || "unknown"}</span>{port.pid && <span className="text-xs text-zinc-600 font-mono ml-2">PID:{port.pid}</span>}</div>
                    </div>
                    <span className="text-xs text-zinc-600 font-mono">{port.addr}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                <Wifi className="w-10 h-10 opacity-20" /><p className="text-sm">{t("no_ports")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border flex flex-col" style={{ background: "#140a24", borderColor: "rgba(139,92,246,0.2)", minHeight: 360, maxHeight: 420 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "rgba(139,92,246,0.15)" }}>
            <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /><span className="font-semibold text-sm">{t("top_processes")}</span></div>
            <div className="flex items-center gap-2">
              <Badge className="text-xs bg-white/5 text-zinc-400 border-white/10">{processes?.length ?? 0}</Badge>
              <Button variant="ghost" size="sm" onClick={fetchProcesses} className="h-6 w-6 p-0 text-zinc-600 hover:text-white">
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {processesLoading ? (
              <div className="p-4 space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-12 w-full rounded-lg animate-pulse" style={{ background: "#1d1033" }} />)}</div>
            ) : processes && processes.length > 0 ? (
              <div className="divide-y divide-white/5">
                {processes.slice(0, 40).map((proc) => (
                  <div key={proc.pid} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{proc.name}</span>
                        <span className="text-[10px] text-zinc-600 font-mono shrink-0">#{proc.pid}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-16 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, proc.cpu)}%`, background: proc.cpu > 50 ? "#ef4444" : "#8b5cf6" }} />
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono w-10">{proc.cpu?.toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-1 w-16 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, proc.memory)}%`, background: "#a855f7" }} />
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono w-10">{proc.memory?.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleKill(proc.pid)}
                      className="h-7 px-2 text-xs text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <X className="w-3 h-3 mr-1" /> {t("kill")}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                <Server className="w-10 h-10 opacity-20" /><p className="text-sm">{t("no_processes")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
