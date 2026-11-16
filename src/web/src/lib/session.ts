import { useCallback, useEffect, useState } from "react";

export type SessionUser = {
  id: number;
  linuxdoId: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  trustLevel: number;
  rssToken: string;
  disabled: boolean;
};

export type Onboarding = {
  enabled: boolean;
  title: string;
  content: string;
  showGuideCards: boolean;
  version: number;
};

export type Bootstrap = {
  siteMode: "selfhost" | "public";
  loginEnabled: boolean;
  registrationMode: "open" | "invite" | "closed";
  suspendUserSessionsOnClose: boolean;
  minTrustLevel: number;
  oauthConfigured: boolean;
  githubConfigured: boolean;
  devMockEnabled: boolean;
  adminConfigured: boolean;
  adminLocked: boolean;
  isAdmin: boolean;
  user: SessionUser | null;
  onboarding: Onboarding;
  features: { rss: boolean; userPush: boolean };
};

export function useBootstrap(): { data: Bootstrap | null; loading: boolean; reload: () => void } {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    fetch("/api/site/bootstrap", { signal: ac.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Bootstrap>) : null))
      .then((d) => d && setData(d))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [nonce]);
  return { data, loading, reload };
}

/* ------------------------------------------------------------------ *
 * 访客本地Status: 公开站未Log in时, "hide / star / read / quick-block"
 * 只存在这台浏览器里, 绝不发请求, 所以谁也不会影响别人. 
 * ------------------------------------------------------------------ */

const GUEST_KEY = "radar_guest_state_v1";

export type GuestState = {
  hidden: number[];
  starred: number[];
  read: number[];
  blocked: string[];
};

const EMPTY: GuestState = { hidden: [], starred: [], read: [], blocked: [] };

export function readGuest(): GuestState {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return { ...EMPTY, hidden: [], starred: [], read: [], blocked: [] };
    const parsed = JSON.parse(raw) as Partial<GuestState>;
    const arr = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)) : []);
    return {
      hidden: arr(parsed.hidden),
      starred: arr(parsed.starred),
      read: arr(parsed.read),
      blocked: Array.isArray(parsed.blocked) ? parsed.blocked.filter((s): s is string => typeof s === "string") : [],
    };
  } catch {
    return { ...EMPTY, hidden: [], starred: [], read: [], blocked: [] };
  }
}

export function writeGuest(state: GuestState): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(state));
  } catch {
    /* 隐私模式 / 配额满: 静默降级, 本轮仍可用内存Status */
  }
}

export function clearGuest(): void {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

function toggle(list: number[], id: number, on: boolean): number[] {
  const set = new Set(list);
  if (on) set.add(id);
  else set.delete(id);
  return [...set];
}

/** 访客版 PATCH: and /api/me/items/:id 同语义, 只是落到 localStorage */
export function guestPatch(id: number, body: { starred?: boolean; read?: boolean; status?: string }): GuestState {
  const s = readGuest();
  if (typeof body.starred === "boolean") s.starred = toggle(s.starred, id, body.starred);
  if (typeof body.read === "boolean") s.read = toggle(s.read, id, body.read);
  if (body.status === "ignored") s.hidden = toggle(s.hidden, id, true);
  else if (body.status === "active") s.hidden = toggle(s.hidden, id, false);
  writeGuest(s);
  return s;
}

export function guestBatch(ids: number[], action: string): GuestState {
  const s = readGuest();
  for (const id of ids) {
    if (action === "read") s.read = toggle(s.read, id, true);
    else if (action === "unread") s.read = toggle(s.read, id, false);
    else if (action === "ignore") s.hidden = toggle(s.hidden, id, true);
    else if (action === "restore") s.hidden = toggle(s.hidden, id, false);
  }
  writeGuest(s);
  return s;
}

export function guestAddBlock(pattern: string): GuestState {
  const s = readGuest();
  const p = pattern.trim();
  if (p && !s.blocked.includes(p)) s.blocked = [...s.blocked, p];
  writeGuest(s);
  return s;
}

export function guestRemoveBlock(pattern: string): GuestState {
  const s = readGuest();
  s.blocked = s.blocked.filter((x) => x !== pattern);
  writeGuest(s);
  return s;
}

/** 访客本地Blocklist是否match (Keyword, 大小写不敏感) */
export function guestBlocks(title: string, summary: string | null, patterns: string[]): boolean {
  if (!patterns.length) return false;
  const hay = (title + " " + (summary ?? "")).toLowerCase();
  return patterns.some((p) => hay.includes(p.toLowerCase()));
}

export function guestCounts(s: GuestState): { hidden: number; starred: number; read: number; blocked: number } {
  return { hidden: s.hidden.length, starred: s.starred.length, read: s.read.length, blocked: s.blocked.length };
}

/** Log in成功后把本地偏好Merge进account (用户手动点"Merge"才调用) */
export async function importGuestToAccount(s: GuestState): Promise<{ ok: boolean; imported: number; error?: string }> {
  const res = await fetch("/api/me/items/import-guest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hidden: s.hidden, starred: s.starred, read: s.read }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, imported: 0, error: err.error ?? "Merge failed" };
  }
  const data = (await res.json()) as { imported: number };
  clearGuest();
  return { ok: true, imported: data.imported };
}