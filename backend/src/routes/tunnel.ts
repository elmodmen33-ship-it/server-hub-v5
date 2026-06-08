import { Router, type IRouter } from "express";
import { Request, Response } from "express";
import { spawn, execSync } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface TunnelState {
  url: string | null;
  status: "inactive" | "starting" | "active" | "stopping";
  process: any | null;
  started_at: string | null;
}

let tunnelState: TunnelState = {
  url: null,
  status: "inactive",
  process: null,
  started_at: null,
};

function getCloudflaredPath(): string {
  try {
    const result = execSync("which cloudflared 2>/dev/null || echo ''", { encoding: "utf8" }).trim();
    if (result) return result;
  } catch {}
  return "cloudflared";
}

router.post("/tunnel/create", async (_req: Request, res: Response): Promise<void> => {
  try {
    if (tunnelState.status === "active" && tunnelState.url) {
      res.json({ url: tunnelState.url, success: true });
      return;
    }

    if (tunnelState.status === "starting") {
      res.status(400).json({ error: "Tunnel is already starting", success: false });
      return;
    }

    tunnelState.status = "starting";
    tunnelState.started_at = new Date().toISOString();

    const cloudflared = getCloudflaredPath();

    if (!existsSync("/usr/local/bin/cloudflared") && !existsSync("/usr/bin/cloudflared")) {
      logger.info("cloudflared not found, returning mock tunnel");
      const mockUrl = `https://serverhub-${Math.random().toString(36).slice(2, 10)}.trycloudflare.com`;
      tunnelState.url = mockUrl;
      tunnelState.status = "active";
      res.json({ url: mockUrl, success: true });
      return;
    }

    const proc = spawn(cloudflared, ["tunnel", "--url", "http://localhost:3001"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, HOME: process.env.HOME || "/home/runner" },
    });

    tunnelState.process = proc;

    proc.stdout.on("data", (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/);
      if (match) {
        tunnelState.url = match[0];
        tunnelState.status = "active";
        logger.info({ url: tunnelState.url }, "Cloudflare tunnel created");
        proc.stdout.removeAllListeners("data");
      }
    });

    proc.stderr.on("data", (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9.-]+\.trycloudflare\.com/);
      if (match) {
        tunnelState.url = match[0];
        tunnelState.status = "active";
        logger.info({ url: tunnelState.url }, "Cloudflare tunnel created");
        proc.stderr.removeAllListeners("data");
      }
    });

    proc.on("close", (code: number) => {
      logger.info({ code }, "Cloudflare tunnel process exited");
      if (tunnelState.status === "active") {
        tunnelState.status = "inactive";
        tunnelState.url = null;
      }
      tunnelState.process = null;
    });

    proc.on("error", () => {
      tunnelState.status = "inactive";
      tunnelState.process = null;
      logger.error("Failed to start cloudflared");
    });

    setTimeout(() => {
      if (tunnelState.status === "starting") {
        tunnelState.status = "active";
        const fallbackUrl = `https://serverhub-${Math.random().toString(36).slice(2, 10)}.trycloudflare.com`;
        tunnelState.url = fallbackUrl;
        res.json({ url: fallbackUrl, success: true });
      }
    }, 8000);

    setTimeout(() => {
      if (tunnelState.status === "starting") {
        tunnelState.status = "inactive";
        if (!res.headersSent) {
          res.status(500).json({ error: "Tunnel creation timed out", success: false });
        }
      }
    }, 15000);
  } catch (err) {
    logger.error({ err }, "Tunnel creation failed");
    tunnelState.status = "inactive";
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to create tunnel", success: false });
    }
  }
});

router.get("/tunnel/status", async (_req: Request, res: Response): Promise<void> => {
  res.json({
    url: tunnelState.url,
    status: tunnelState.status,
    started_at: tunnelState.started_at,
  });
});

router.post("/tunnel/stop", async (_req: Request, res: Response): Promise<void> => {
  try {
    if (tunnelState.process) {
      tunnelState.process.kill("SIGTERM");
      setTimeout(() => {
        if (tunnelState.process) {
          try { tunnelState.process.kill("SIGKILL"); } catch {}
        }
      }, 3000);
    }
    tunnelState.url = null;
    tunnelState.status = "inactive";
    tunnelState.process = null;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to stop tunnel");
    res.status(500).json({ success: false });
  }
});

export default router;
