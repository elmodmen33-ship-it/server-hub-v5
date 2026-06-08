const BASE = import.meta.env.VITE_API_URL || "";

function getToken(): string | null {
  return localStorage.getItem("sh_token");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createTerminalSession: (data: { name?: string; cwd?: string }) =>
    request<{ id: string; name: string; created_at: string; status: string }>("/api/terminal/sessions", { method: "POST", body: JSON.stringify(data) }),
  killTerminalSession: (id: string) =>
    request<{ success: boolean }>(`/api/terminal/sessions/${id}`, { method: "DELETE" }),
  getTerminalSessions: () =>
    request<Array<{ id: string; name: string; created_at: string; status: string }>>("/api/terminal/sessions"),

  login: (username: string, password: string) =>
    request<{ token: string; user: any }>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  getMe: () => request<any>("/api/auth/me"),
  updateProfile: (data: any) => request<any>("/api/auth/profile", { method: "PUT", body: JSON.stringify(data) }),

  getUsers: () => request<any[]>("/api/users"),
  createUser: (data: any) => request<any>("/api/users", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: string, data: any) => request<any>(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteUser: (id: string) => request<any>(`/api/users/${id}`, { method: "DELETE" }),

  getSettings: () => request<any>("/api/settings"),
  updateSettings: (data: any) => request<any>("/api/settings", { method: "PUT", body: JSON.stringify(data) }),
  testTelegram: () => request<{ success: boolean }>("/api/settings/telegram/test", { method: "POST" }),

  getSystemStats: () => request<any>("/api/system/stats"),
  getSystemPorts: () => request<any[]>("/api/system/ports"),
  getSystemProcesses: () => request<any[]>("/api/system/processes"),
  killProcess: (pid: number) => request<any>(`/api/system/processes/${pid}`, { method: "DELETE" }),

  listFiles: (path: string) => request<any[]>(`/api/files/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) => request<{ content: string }>(`/api/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) => request<any>("/api/files/write", { method: "POST", body: JSON.stringify({ path, content }) }),
  deleteFile: (path: string) => request<any>("/api/files/delete", { method: "POST", body: JSON.stringify({ path }) }),
  renameFile: (oldPath: string, newPath: string) => request<any>("/api/files/rename", { method: "POST", body: JSON.stringify({ oldPath, newPath }) }),
  createDir: (path: string) => request<any>("/api/files/mkdir", { method: "POST", body: JSON.stringify({ path }) }),
  searchFiles: (query: string) => request<any[]>(`/api/files/search?q=${encodeURIComponent(query)}`),
  extractFile: (path: string, dest?: string) =>
    request<{ success: boolean; files: string[] }>("/api/files/extract", { method: "POST", body: JSON.stringify({ path, dest }) }),

  sendChatMessage: (model: string, message: string, onChunk?: (chunk: string) => void) => {
    const token = getToken();
    return fetch(`${BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ model, message, stream: !!onChunk }),
    });
  },

  createTunnel: () =>
    request<{ url: string; success: boolean }>("/api/tunnel/create", { method: "POST" }),
  getTunnelStatus: () =>
    request<{ url: string | null; status: string }>("/api/tunnel/status"),
  stopTunnel: () =>
    request<{ success: boolean }>("/api/tunnel/stop", { method: "POST" }),

  getLogs: () => request<any[]>("/api/logs"),

  getActivity: (params?: { q?: string; action?: string; status?: string; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.set("q", params.q);
    if (params?.action) searchParams.set("action", params.action);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.limit) searchParams.set("limit", String(params.limit));
    return request<{ items: any[]; total: number }>(`/api/activity?${searchParams.toString()}`);
  },
  getActivityStats: () => request<any>("/api/activity/stats"),
  clearActivity: () => request<{ success: boolean }>("/api/activity", { method: "DELETE" }),
};

export function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  return fetch(`${BASE}${url}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
}
