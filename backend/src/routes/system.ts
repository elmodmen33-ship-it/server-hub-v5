import { Router, type IRouter } from "express";
import { execSync } from "child_process";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 3000 }).trim();
  } catch {
    return "N/A";
  }
}

function getCpuPercent(): number {
  try {
    const result = safeExec("grep 'cpu ' /proc/stat");
    const parts = result.split(/\s+/);
    const total = parts.slice(1, 8).reduce((a, b) => a + Number(b), 0);
    const idle = Number(parts[4]);
    return Math.round(((total - idle) / total) * 100);
  } catch {
    return 0;
  }
}

function getMemInfo(): { total: number; used: number; available: number } {
  try {
    const content = safeExec("cat /proc/meminfo");
    const lines = content.split("\n");
    const getVal = (key: string) => {
      const line = lines.find((l) => l.startsWith(key));
      if (!line) return 0;
      return parseInt(line.split(/\s+/)[1], 10) * 1024;
    };
    const total = getVal("MemTotal:");
    const free = getVal("MemFree:");
    const buffers = getVal("Buffers:");
    const cached = getVal("Cached:");
    const sreclaimable = getVal("SReclaimable:");
    const available = free + buffers + cached + sreclaimable;
    return { total, used: total - available, available };
  } catch {
    return { total: 0, used: 0, available: 0 };
  }
}

function getDiskInfo(): { total: number; used: number; free: number } {
  try {
    const result = safeExec("df -B1 / | tail -1");
    const parts = result.split(/\s+/);
    return {
      total: Number(parts[1]),
      used: Number(parts[2]),
      free: Number(parts[3]),
    };
  } catch {
    return { total: 0, used: 0, free: 0 };
  }
}

function getNetStats(): { sent: number; recv: number } {
  try {
    const result = safeExec("cat /proc/net/dev");
    let sent = 0,
      recv = 0;
    result.split("\n").forEach((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts[0] && parts[0].endsWith(":") && !parts[0].startsWith("lo")) {
        recv += Number(parts[1]) || 0;
        sent += Number(parts[9]) || 0;
      }
    });
    return { sent, recv };
  } catch {
    return { sent: 0, recv: 0 };
  }
}

function getUptime(): string {
  try {
    const secs = parseFloat(safeExec("cat /proc/uptime").split(" ")[0]);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  } catch {
    return "N/A";
  }
}

function getLoadAvg(): number {
  try {
    return parseFloat(safeExec("cat /proc/loadavg").split(" ")[0]);
  } catch {
    return 0;
  }
}

function getHostname(): string {
  try {
    return safeExec("hostname");
  } catch {
    return "unknown";
  }
}

function getIp(): string {
  try {
    return safeExec("hostname -I").split(" ")[0] || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}

function getProcessCount(): number {
  try {
    return parseInt(safeExec("ls /proc | grep -c '^[0-9]'"), 10);
  } catch {
    return 0;
  }
}

function getCpuCount(): number {
  try {
    return parseInt(safeExec("nproc"), 10);
  } catch {
    return 1;
  }
}

router.get("/system/stats", async (_req, res): Promise<void> => {
  try {
    const mem = getMemInfo();
    const disk = getDiskInfo();
    const net = getNetStats();
    const memPercent =
      mem.total > 0 ? Math.round((mem.used / mem.total) * 100) : 0;
    const diskPercent =
      disk.total > 0 ? Math.round((disk.used / disk.total) * 100) : 0;

    const stats = {
      cpu_percent: getCpuPercent(),
      cpu_count: getCpuCount(),
      cpu_freq: "N/A",
      mem_total: formatBytes(mem.total),
      mem_used: formatBytes(mem.used),
      mem_percent: memPercent,
      mem_available: formatBytes(mem.available),
      disk_total: formatBytes(disk.total),
      disk_used: formatBytes(disk.used),
      disk_percent: diskPercent,
      disk_free: formatBytes(disk.free),
      net_sent: formatBytes(net.sent),
      net_recv: formatBytes(net.recv),
      uptime: getUptime(),
      hostname: getHostname(),
      ip: getIp(),
      processes: getProcessCount(),
      load_avg: getLoadAvg(),
      timestamp: new Date().toTimeString().slice(0, 8),
    };

    res.json(stats);
  } catch (err) {
    logger.error({ err }, "Failed to get system stats");
    res.status(500).json({ error: "Failed to get system stats" });
  }
});

router.get("/system/ports", async (_req, res): Promise<void> => {
  try {
    const result = safeExec(
      "ss -tlnp 2>/dev/null | awk 'NR>1 {print $4, $6}' | head -30"
    );
    const ports: Array<{
      port: number;
      addr: string;
      pid: number | null;
      process: string;
    }> = [];

    result.split("\n").forEach((line) => {
      if (!line.trim()) return;
      const parts = line.split(/\s+/);
      const addr = parts[0] || "";
      const pidInfo = parts[1] || "";
      const lastColon = addr.lastIndexOf(":");
      const portStr = addr.slice(lastColon + 1);
      const port = parseInt(portStr, 10);
      if (isNaN(port) || port <= 0) return;
      const host = addr.slice(0, lastColon);
      const pidMatch = pidInfo.match(/pid=(\d+)/);
      const pid = pidMatch ? parseInt(pidMatch[1], 10) : null;
      const nameMatch = pidInfo.match(/\("([^"]+)"/);
      const process = nameMatch ? nameMatch[1] : "system";
      ports.push({ port, addr: host || "0.0.0.0", pid, process });
    });

    res.json(ports.slice(0, 20));
  } catch (err) {
    logger.error({ err }, "Failed to get open ports");
    res.json([]);
  }
});

router.get("/system/processes", async (_req, res): Promise<void> => {
  try {
    const result = safeExec(
      "ps aux --sort=-%cpu 2>/dev/null | head -21 | tail -20"
    );
    const processes = result
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[1], 10) || 0,
          name: parts[10]
            ? parts[10].split("/").pop() || parts[10]
            : "unknown",
          status: parts[7] || "S",
          cpu: parseFloat(parts[2]) || 0,
          memory: parseFloat(parts[3]) || 0,
          cmdline: parts.slice(10).join(" ").slice(0, 80),
        };
      });

    res.json(processes);
  } catch (err) {
    logger.error({ err }, "Failed to get processes");
    res.json([]);
  }
});

router.delete("/system/processes/:pid", async (req, res): Promise<void> => {
  try {
    const rawPid = Array.isArray(req.params.pid)
      ? req.params.pid[0]
      : req.params.pid;
    const pid = parseInt(rawPid, 10);
    if (isNaN(pid) || pid <= 1) {
      res.status(400).json({ success: false, message: "Invalid PID" });
      return;
    }
    try {
      execSync(`kill -9 ${pid}`, { timeout: 3000 });
      res.json({ success: true, message: `Process ${pid} killed` });
    } catch {
      res.json({ success: false, message: `Could not kill process ${pid}` });
    }
  } catch (err) {
    logger.error({ err }, "Failed to kill process");
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
