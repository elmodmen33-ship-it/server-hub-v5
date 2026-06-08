import { Router, type IRouter } from "express";
import { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { logger } from "../lib/logger";
import * as os from "os";
import * as path from "path";
import { execSync } from "child_process";
import * as fs from "fs";

export const terminalRouterAPI: IRouter = Router();

interface TerminalSession {
  id: string;
  name: string;
  created_at: string;
  status: string;
  ptyProcess?: any;
  clients: Set<WebSocket>;
}

const sessions = new Map<string, TerminalSession>();

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const isWindows = os.platform() === "win32";

function detectWslShell(): string | null {
  if (!isWindows) return null;
  try {
    const output = execSync("wsl -l -q 2>&1", { timeout: 5000, encoding: "utf8" }).trim();
    const distros = output.split(/\r?\n/).map(l => l.replace(/\0/g, "").trim()).filter(l => l.length > 0 && !l.includes("Copyright") && !l.includes("Usage"));
    if (distros.length > 0) return "wsl";
  } catch {}
  return null;
}

function getShellInitScript(): string {
  const initPath = path.join(__dirname, "..", "shell-init.ps1");
  try {
    return fs.readFileSync(initPath, "utf8").trim();
  } catch {
    return "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8";
  }
}

terminalRouterAPI.get("/terminal/sessions", async (_req: Request, res: Response): Promise<void> => {
  const list = Array.from(sessions.values()).map((s) => ({
    id: s.id, name: s.name, created_at: s.created_at, status: s.status,
  }));
  res.json(list);
});

terminalRouterAPI.post("/terminal/sessions", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name = "Terminal", cwd } = req.body;
    const id = generateId();
    const session: TerminalSession = {
      id, name: name || "Terminal",
      created_at: new Date().toISOString(),
      status: "running",
      clients: new Set(),
    };

    const pty = await import("node-pty");

    const workDir = cwd || (isWindows ? process.env.USERPROFILE || "C:\\" : process.env.HOME || "/");

    let shell: string;
    let shellArgs: string[];

    if (isWindows) {
      const wslShell = detectWslShell();
      if (wslShell) {
        shell = "wsl.exe";
        shellArgs = [];
      } else {
        shell = "powershell.exe";
        const initScript = getShellInitScript();
        shellArgs = ["-NoLogo", "-NoProfile", "-NoExit", "-Command", initScript];
      }
    } else {
      shell = process.env.SHELL || "/bin/bash";
      shellArgs = ["--norc", "--noprofile", "-i"];
    }

    const useWsl = isWindows && detectWslShell() !== null;

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: useWsl ? "/root" : workDir,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        FORCE_COLOR: "true",
        PS1: "\\[\\033[32m\\]\\u@serverhub:\\w$\\[\\033[0m\\] ",
      } as Record<string, string>,
    });

    session.ptyProcess = ptyProcess;

    if (!isWindows) {
      const welcomeCmd = [
        'clear',
        'echo ""',
        'echo "  \\033[1;35m╔══════════════════════════════════════════════════════╗\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m                                                      \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m    \\033[1;37m ██████╗ ██████╗ ██████╗ ███████╗\\033[0m                 \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m    \\033[1;37m██╔════╝██╔═══██╗██╔══██╗██╔════╝\\033[0m                 \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m    \\033[1;37m██║     ██║   ██║██████╔╝█████╗  \\033[0m                 \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m    \\033[1;37m██║     ██║   ██║██╔═══╝ ██╔══╝  \\033[0m                 \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m    \\033[1;37m╚██████╗╚██████╔╝██║     ███████╗\\033[0m                 \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m    \\033[1;37m ╚═════╝ ╚═════╝ ╚═╝     ╚══════╝\\033[0m                 \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m                                                      \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;36mWelcome to Server Hub v5 Terminal\\033[0m                    \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m                                                      \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;33mFeatures:\\033[0m                                          \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;32m•\\033[0m \\033[1;37mFull Linux Environment\\033[0m                           \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;32m•\\033[0m \\033[1;37mSudo & Package Management\\033[0m                        \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;32m•\\033[0m \\033[1;37mFile Management & Editor\\033[0m                         \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;32m•\\033[0m \\033[1;37mNetwork & System Tools\\033[0m                           \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m  \\033[1;32m•\\033[0m \\033[1;37mMulti-tab Support\\033[0m                               \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m║\\033[0m                                                      \\033[1;35m║\\033[0m"',
        'echo "  \\033[1;35m╚══════════════════════════════════════════════════════╝\\033[0m"',
        'echo ""',
        'export PS1="\\[\\033[32m\\]┌──(\\[\\033[37m\\]runner\\[\\033[90m\\]㉿\\[\\033[37m\\]serverhub\\[\\033[32m\\])-([\\[\\033[34m\\]\\w\\[\\033[0m\\])\\n\\[\\033[32m\\]└─\\[\\033[0m\\]\\$ "',
      ].join(' && ');
      setTimeout(() => { ptyProcess.write(welcomeCmd + '\n'); }, 500);
    }

    ptyProcess.onData((data: string) => {
      const msg = JSON.stringify({ type: "output", data });
      session.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      session.status = "exited";
      logger.info({ id, exitCode }, "Terminal session exited");
      const msg = JSON.stringify({ type: "exit" });
      session.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    });

    sessions.set(id, session);
    logger.info({ id, name: session.name, shell, wsl: useWsl }, "Terminal session created");

    res.status(201).json({
      id, name: session.name, created_at: session.created_at, status: session.status,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create terminal session");
    res.status(500).json({ error: "Failed to create session" });
  }
});

terminalRouterAPI.delete("/terminal/sessions/:id", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const session = sessions.get(rawId);
  if (!session) { res.status(404).json({ success: false, message: "Session not found" }); return; }
  try {
    if (session.ptyProcess) session.ptyProcess.kill();
    session.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) { client.send(JSON.stringify({ type: "exit" })); client.close(); }
    });
    sessions.delete(rawId);
    res.json({ success: true, message: "Session killed" });
  } catch (err) {
    logger.error({ err }, "Failed to kill session");
    res.status(500).json({ success: false, message: "Failed to kill session" });
  }
});

export function setupTerminalWebSocket(wss: WebSocketServer): void {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = req.url || "";
    const match = url.match(/\/api\/terminal\/ws\/([^/?]+)/);
    if (!match) {
      ws.close(); return;
    }

    const sessionId = match[1];
    const session = sessions.get(sessionId);
    if (!session) {
      ws.close(); return;
    }

    session.clients.add(ws);
    logger.info({ sessionId }, "WebSocket client connected to terminal");

    ws.on("message", (rawMsg: Buffer) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        if (msg.type === "input" && msg.data && session.ptyProcess) {
          session.ptyProcess.write(msg.data);
        } else if (msg.type === "resize" && session.ptyProcess) {
          if (msg.cols && msg.rows) {
            try { session.ptyProcess.resize(msg.cols, msg.rows); } catch {}
          }
        } else if (msg.type === "ping") {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (err) {
        logger.warn({ err }, "Failed to parse terminal message");
      }
    });

    ws.on("close", () => {
      session.clients.delete(ws);
      logger.info({ sessionId }, "WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error({ err, sessionId }, "WebSocket error");
      session.clients.delete(ws);
    });
  });
}

export default terminalRouterAPI;
