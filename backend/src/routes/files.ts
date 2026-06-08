import { Router, type IRouter } from "express";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger";
import { authenticate } from "../middleware/authenticate";

const execFileAsync = promisify(execFile);

const router: IRouter = Router();

const BASE_DIR = process.env.FILES_BASE_DIR || process.env.HOME || "/";

function safePath(requestPath: string): string | null {
  const normalized = path.normalize(requestPath);
  const resolved = path.resolve(BASE_DIR, normalized);
  if (!resolved.startsWith(BASE_DIR)) return null;
  return resolved;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return "folder";
  const ext = path.extname(name).toLowerCase();
  const map: Record<string, string> = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".php": "php",
    ".json": "json",
    ".xml": "xml",
    ".md": "markdown",
    ".txt": "text",
    ".sh": "shell",
    ".bash": "shell",
    ".zip": "archive",
    ".tar": "archive",
    ".gz": "archive",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".gif": "image",
    ".svg": "image",
    ".mp4": "video",
    ".mp3": "audio",
    ".pdf": "pdf",
    ".sql": "database",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".vue": "vue",
    ".toml": "toml",
    ".env": "env",
  };
  return map[ext] || "file";
}

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".php": "php",
    ".json": "json",
    ".xml": "xml",
    ".md": "markdown",
    ".txt": "plaintext",
    ".sh": "shell",
    ".bash": "shell",
    ".sql": "sql",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".vue": "html",
    ".toml": "toml",
    ".env": "shell",
  };
  return map[ext] || "plaintext";
}

function isTextFile(filePath: string): boolean {
  const textExts = new Set([
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".html",
    ".htm",
    ".css",
    ".php",
    ".json",
    ".xml",
    ".yaml",
    ".yml",
    ".md",
    ".txt",
    ".sh",
    ".bash",
    ".env",
    ".cfg",
    ".conf",
    ".ini",
    ".sql",
    ".rb",
    ".go",
    ".rs",
    ".cpp",
    ".c",
    ".h",
    ".java",
    ".vue",
    ".log",
    ".csv",
    ".toml",
    ".lock",
    ".mod",
    ".gitignore",
    ".htaccess",
  ]);
  const ext = path.extname(filePath).toLowerCase();
  if (textExts.has(ext)) return true;
  if (!ext) {
    try {
      const chunk = fs.readFileSync(filePath).slice(0, 512);
      return !chunk.includes(0);
    } catch {
      return false;
    }
  }
  return false;
}

function getFileInfo(
  filePath: string
): {
  name: string;
  path: string;
  is_dir: boolean;
  size: string;
  size_bytes: number;
  modified: string;
  ext: string;
  icon: string;
  language: string;
} | null {
  try {
    const stat = fs.statSync(filePath);
    const name = path.basename(filePath);
    const isDir = stat.isDirectory();
    const ext = isDir ? "" : path.extname(name).toLowerCase().slice(1);
    return {
      name,
      path: filePath,
      is_dir: isDir,
      size: isDir ? "-" : formatBytes(stat.size),
      size_bytes: stat.size,
      modified: new Date(stat.mtime).toISOString().slice(0, 16).replace("T", " "),
      ext,
      icon: getFileIcon(name, isDir),
      language: isDir ? "" : getLanguage(filePath),
    };
  } catch {
    return null;
  }
}

router.get("/files/list", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const reqPath = (req.query.path as string) || "/";
    const dirPath = safePath(reqPath);
    if (!dirPath) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    if (!fs.existsSync(dirPath)) {
      res.status(404).json({ error: "Path not found" });
      return;
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: "Not a directory" });
      return;
    }

    const entries = fs.readdirSync(dirPath);
    const items = entries
      .map((entry) => getFileInfo(path.join(dirPath, entry)))
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    res.json({ path: dirPath, items });
  } catch (err) {
    logger.error({ err }, "Failed to list files");
    res.status(500).json({ error: "Failed to list files" });
  }
});

router.get("/files/read", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ error: "Path required" });
      return;
    }

    const resolved = safePath(filePath);
    if (!resolved) {
      res.status(400).json({ error: "Invalid path" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      res.status(400).json({ error: "Cannot read directory" });
      return;
    }

    const isText = isTextFile(resolved);
    let content = "";
    if (isText) {
      try {
        content = fs.readFileSync(resolved, "utf8");
      } catch {
        content = "";
      }
    }

    res.json({
      path: resolved,
      content,
      language: getLanguage(resolved),
      is_text: isText,
      size: formatBytes(stat.size),
    });
  } catch (err) {
    logger.error({ err }, "Failed to read file");
    res.status(500).json({ error: "Failed to read file" });
  }
});

router.post("/files/write", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content == null) {
      res.status(400).json({ success: false, message: "Path and content required" });
      return;
    }

    const resolved = safePath(filePath);
    if (!resolved) {
      res.status(400).json({ success: false, message: "Invalid path" });
      return;
    }

    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
    res.json({ success: true, message: "File saved" });
  } catch (err) {
    logger.error({ err }, "Failed to write file");
    res.status(500).json({ success: false, message: "Failed to write file" });
  }
});

router.delete("/files/delete", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) {
      res.status(400).json({ success: false, message: "Path required" });
      return;
    }

    const resolved = safePath(filePath);
    if (!resolved) {
      res.status(400).json({ success: false, message: "Invalid path" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ success: false, message: "File not found" });
      return;
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true });
    } else {
      fs.unlinkSync(resolved);
    }

    res.json({ success: true, message: "Deleted successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to delete file");
    res.status(500).json({ success: false, message: "Failed to delete file" });
  }
});

router.post("/files/rename", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
      res.status(400).json({ success: false, message: "oldPath and newPath required" });
      return;
    }

    const resolvedOld = safePath(oldPath);
    const resolvedNew = safePath(newPath);
    if (!resolvedOld || !resolvedNew) {
      res.status(400).json({ success: false, message: "Invalid path" });
      return;
    }

    if (!fs.existsSync(resolvedOld)) {
      res.status(404).json({ success: false, message: "Source not found" });
      return;
    }

    fs.mkdirSync(path.dirname(resolvedNew), { recursive: true });
    fs.renameSync(resolvedOld, resolvedNew);
    res.json({ success: true, message: "Renamed successfully" });
  } catch (err) {
    logger.error({ err }, "Failed to rename file");
    res.status(500).json({ success: false, message: "Failed to rename file" });
  }
});

router.post("/files/mkdir", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: dirPath } = req.body;
    if (!dirPath) {
      res.status(400).json({ success: false, message: "Path required" });
      return;
    }

    const resolved = safePath(dirPath);
    if (!resolved) {
      res.status(400).json({ success: false, message: "Invalid path" });
      return;
    }

    fs.mkdirSync(resolved, { recursive: true });
    res.json({ success: true, message: "Directory created" });
  } catch (err) {
    logger.error({ err }, "Failed to create directory");
    res.status(500).json({ success: false, message: "Failed to create directory" });
  }
});

router.post("/files/upload", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const busboy = await import("busboy");
    const uploadPath = (req.headers["x-upload-path"] as string) || "/tmp";
    const bb = busboy.default({ headers: req.headers });

    let saved = false;
    bb.on("file", (_name, file, info) => {
      const { filename } = info;
      const dest = path.join(safePath(uploadPath) || "/tmp", path.basename(filename));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const ws = fs.createWriteStream(dest);
      file.pipe(ws);
      ws.on("close", () => {
        saved = true;
      });
    });

    bb.on("finish", () => {
      if (saved) {
        res.json({ success: true, message: "File uploaded" });
      } else {
        res.json({ success: false, message: "No file received" });
      }
    });

    req.pipe(bb);
  } catch (err) {
    logger.error({ err }, "Failed to upload file");
    res.status(500).json({ success: false, message: "Failed to upload file" });
  }
});

router.get("/files/search", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query.q as string;
    const searchPath = (req.query.path as string) || "/";
    if (!q) {
      res.status(400).json({ error: "Query required" });
      return;
    }

    const resolved = safePath(searchPath);
    if (!resolved || !fs.existsSync(resolved)) {
      res.json([]);
      return;
    }

    const results: ReturnType<typeof getFileInfo>[] = [];
    const qLower = q.toLowerCase();

    function walkDir(dir: string, depth = 0) {
      if (depth > 5 || results.length >= 50) return;
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.startsWith(".") && depth > 0) continue;
        const full = path.join(dir, entry);
        if (entry.toLowerCase().includes(qLower)) {
          const info = getFileInfo(full);
          if (info) results.push(info);
        }
        try {
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walkDir(full, depth + 1);
          }
        } catch {
          // skip
        }
      }
    }

    walkDir(resolved);
    res.json(results.filter(Boolean));
  } catch (err) {
    logger.error({ err }, "Failed to search files");
    res.status(500).json({ error: "Search failed" });
  }
});

router.post("/files/extract", authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { path: archivePath, dest } = req.body;
    if (!archivePath) {
      res.status(400).json({ success: false, message: "Path required" });
      return;
    }

    const resolved = safePath(archivePath);
    if (!resolved) {
      res.status(400).json({ success: false, message: "Invalid path" });
      return;
    }

    if (!fs.existsSync(resolved)) {
      res.status(404).json({ success: false, message: "Archive not found" });
      return;
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      res.status(400).json({ success: false, message: "Path is a directory, not an archive" });
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    const baseName = path.basename(resolved);
    const extractDir = dest ? (safePath(dest) || path.dirname(resolved)) : path.dirname(resolved);

    fs.mkdirSync(extractDir, { recursive: true });

    const isTarGz = baseName.endsWith(".tar.gz") || baseName.endsWith(".tgz");
    const isTar = ext === ".tar" || baseName.endsWith(".tar.");
    const isZip = ext === ".zip";

    if (!isTarGz && !isTar && !isZip) {
      res.status(400).json({
        success: false,
        message: "Unsupported archive format. Supported: .zip, .tar, .tar.gz, .tgz",
      });
      return;
    }

    if (isZip) {
      // Use PowerShell Expand-Archive on Windows
      const psScript = `Expand-Archive -Path '${resolved}' -DestinationPath '${extractDir}' -Force`;
      await execFileAsync("powershell", ["-NoProfile", "-Command", psScript]);
    } else if (isTarGz) {
      await execFileAsync("tar", ["-xzf", resolved, "-C", extractDir]);
    } else if (isTar) {
      await execFileAsync("tar", ["-xf", resolved, "-C", extractDir]);
    }

    // Collect list of extracted files
    const extractedFiles: string[] = [];
    function listFiles(dir: string, prefix: string) {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const full = path.join(dir, entry);
          const rel = prefix ? `${prefix}/${entry}` : entry;
          extractedFiles.push(rel);
          const s = fs.statSync(full);
          if (s.isDirectory()) {
            listFiles(full, rel);
          }
        }
      } catch {
        // skip unreadable entries
      }
    }
    listFiles(extractDir, "");

    logger.info({ archive: resolved, dest: extractDir, count: extractedFiles.length }, "Archive extracted");
    res.json({ success: true, files: extractedFiles });
  } catch (err: any) {
    logger.error({ err }, "Failed to extract archive");
    res.status(500).json({ success: false, message: err.message || "Failed to extract archive" });
  }
});

export default router;
