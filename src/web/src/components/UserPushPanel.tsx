import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  Clock,
  Eye,
  KeyRound,
  ListOrdered,
  Loader2,
  Moon,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Bootstrap } from "../lib/session.ts";

type MePushConfig = {
  enabled: boolean;
  hasToken: boolean;
  botTokenMask: string;
  chatId: string;
  useGlobalBlocks: boolean;
  dailyEnabled: boolean;
  consecutiveFails: number;
  lastError: string | null;
  lastFlushAt: string | null;
  lastPushedAt: string | null;
  settings: Record<string, unknown>;
};

type MePushPayload = {
  config: MePushConfig;
  settings: Record<string, unknown>;
  stats: { queued: number; sentLast24h: number; sentLastHour: number; failures: number; lastError: string | null };
  quiet: boolean;
  ready: boolean;
  caps: { maxPerHour: number; maxPerInstant: number };
};

type Preview = {
  instant: string[];
  batch: string[];
  scanned: number;
  matched: number;
  rejectedBy: Record<string, number>;
  queued: number;
};

const num = (v: unknown, fallback: number): number => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

function Toast2({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="toast-enter fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-ink-800 bg-ink-950 px-3.5 py-2 text-[12.5px] font-medium text-white">
      {msg}
    </div>
  );
}

export function UserPushPanel({ boot }: { boot: Bootstrap }) {
  const [payload, setPayload] = useState<MePushPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [detected, setDetected] = useState<{ chatId: string; title: string; type: string }[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [logs, setLogs] = useState<
    { id: number; kind: string; count: number; ok: number; error: string | null; reason: string | null; created_at: string; text: string }[]
  >([]);

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/push");
      if (res.ok) {
        const data = (await res.json()) as MePushPayload;
        setPayload(data);
        setChatInput((prev) => (prev ? prev : data.config.chatId));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (patch: Record<string, unknown>) => {
      const res = await fetch("/api/me/push", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        notify(data.error ?? "Save failed");
        return false;
      }
      await load();
      return true;
    },
    [load, notify],
  );

  const s = (payload?.settings ?? {}) as Record<string, unknown>;
  const cfg = payload?.config;

  if (loading) return <div className="panel p-6 text-[13px] text-ink-500">Loading personal push settings…</div>;
  if (!payload || !cfg) return <div className="panel p-6 text-[13px] text-alert">Failed to load personal push settings</div>;

  return (
    <div className="space-y-4">
      <Toast2 msg={toast} />

      <div className="panel flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-950">
            <Bot size={15} className="text-accent" /> Me Telegram push
          </div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-500">
            Pushes only to you: your own Bot Token and Chat ID, with independent rules, dedupe, and rate limits — it never touches the admin's global pushes. 
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11.5px] font-medium ${cfg.enabled ? "text-deal" : "text-ink-500"}`}>
            {cfg.enabled ? "On" : "Off"}
          </span>
          <button
            type="button"
            onClick={() => void save({ enabled: !cfg.enabled })}
            className={
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors " +
              (cfg.enabled ? "bg-brand" : "bg-ink-300")
            }
            title={cfg.enabled ? "Click to disable personal push" : "Click to enable personal push"}
          >
            <span
              className={
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform " +
                (cfg.enabled ? "translate-x-4.5" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      </div>

      {cfg.lastError && (
        <div className="panel border-alert-border bg-alert-subtle p-3.5 text-[12px] text-alert">
          Last failure: Failed: {cfg.lastError}
          {cfg.consecutiveFails > 0 ? `(${cfg.consecutiveFails} consecutive failures; auto-disabled at 3)` : ""}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-950">
            <KeyRound size={14} className="text-accent" /> Bot credentials
            <span className="ml-auto rounded-full bg-canvas-subtle px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
              {cfg.settings.deliverVia === "webhook" ? "Webhook" : "Telegram"}
            </span>
          </div>
          <div className="flex gap-1.5">
            {(["telegram", "webhook"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => void save({ deliverVia: v })}
                className={
                  "flex-1 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors " +
                  (cfg.settings.deliverVia === v
                    ? "border-ink-950 bg-ink-950 text-white"
                    : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                }
              >
                {v === "telegram" ? "Telegram Bot" : "Webhook"}
              </button>
            ))}
          </div>
          {cfg.settings.deliverVia === "webhook" ? (
            <>
              <label className="block">
                <span className="text-[12px] font-medium text-ink-700">Webhook URL</span>
                <input
                  defaultValue={String(cfg.settings.webhookUrl ?? "")}
                  onBlur={(e) => void save({ webhookUrl: e.target.value.trim() })}
                  placeholder="http://127.0.0.1:3000/send_private_msg or https://api.day.app/xxx"
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 font-mono text-[12px] text-ink-950 outline-none focus:border-accent"
                />
                <span className="mt-1 block text-[11px] text-ink-500">
                  Receives POST JSON with source / text / sentAt. For QQ use NapCat or Lagrange's HTTP API (the official bot can't push proactively). 
                </span>
              </label>
              <label className="block">
                <span className="text-[12px] font-medium text-ink-700">Verification secret (optional)</span>
                <input
                  defaultValue={String(cfg.settings.webhookSecret ?? "")}
                  onBlur={(e) => void save({ webhookSecret: e.target.value.trim() })}
                  placeholder="Sent as the X-Radar-Secret header"
                  className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 font-mono text-[12px] text-ink-950 outline-none focus:border-accent"
                />
              </label>
            </>
          ) : null}
          <label className="block">
            <span className="text-[12px] font-medium text-ink-700">Bot Token</span>
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder={cfg.hasToken ? `Saved: ${cfg.botTokenMask}` : "123456789:AA..."}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 font-mono text-[12px] text-ink-950 outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[11px] text-ink-500">
              Create a bot at @BotFather to get the token; it is stored encrypted server-side and the API only returns a masked value. 
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                if (!tokenInput.trim()) return notify("Paste a Bot Token first");
                setBusy("token");
                try {
                  const ok = await save({ botToken: tokenInput.trim() });
                  if (ok) {
                    setTokenInput("");
                    notify("Token Saved");
                  }
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {busy === "token" ? <Loader2 size={12} className="animate-spin" /> : null}
              Save Token
            </button>
            <button
              type="button"
              onClick={async () => {
                setBusy("detect");
                try {
                  const res = await fetch("/api/me/push/detect-chat", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ botToken: tokenInput.trim() || undefined }),
                  });
                  const data = (await res.json().catch(() => ({}))) as { error?: string; chats?: typeof detected };
                  if (!res.ok) notify(data.error ?? "Probe failed");
                  else {
                    setDetected(data.chats ?? []);
                    notify((data.chats?.length ?? 0) ? `Detected ${data.chats!.length} chats` : "No chats detected — send /start to the bot first");
                  }
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-60"
            >
              {busy === "detect" ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Detect Chat ID
            </button>
            {cfg.hasToken && (
              <button
                type="button"
                onClick={() => void save({ clearToken: true })}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-[12px] font-medium text-alert hover:bg-ink-100"
              >
                Clear token
              </button>
            )}
          </div>

          {detected.length > 0 && (
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-2.5">
              <div className="mb-1.5 text-[11.5px] font-medium text-ink-700">Click to fill Chat ID</div>
              <div className="flex flex-wrap gap-1.5">
                {detected.map((c) => (
                  <button
                    key={c.chatId}
                    type="button"
                    onClick={() => setChatInput(c.chatId)}
                    className="rounded-md border border-ink-200 bg-surface px-2 py-1 text-[11.5px] text-ink-700 hover:bg-ink-100"
                  >
                    {c.title} · {c.chatId}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-[12px] font-medium text-ink-700">Chat ID</span>
            <div className="mt-1 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Your private chat or channel ID"
                className="w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 font-mono text-[12px] text-ink-950 outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={async () => {
                  const ok = await save({ chatId: chatInput.trim() });
                  if (ok) notify("Chat ID saved");
                }}
                className="shrink-0 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Save
              </button>
            </div>
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                setBusy("test");
                try {
                  const res = await fetch("/api/me/push/test", { method: "POST" });
                  const data = (await res.json().catch(() => ({}))) as { error?: string };
                  notify(res.ok ? "Test message sent" : (data.error ?? "Send failed"));
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null || !cfg.hasToken || !cfg.chatId}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-50"
            >
              {busy === "test" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} send test message
            </button>
            <button
              type="button"
              onClick={async () => {
                setBusy("flush");
                try {
                  const res = await fetch("/api/me/push/flush", { method: "POST" });
                  const data = (await res.json().catch(() => ({}))) as { sent?: number; queued?: number; error?: string };
                  notify(res.ok ? `Sent ${data.sent ?? 0}, ${data.queued ?? 0} queued` : (data.error ?? "Send failed"));
                  await load();
                } finally {
                  setBusy(null);
                }
              }}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-50"
            >
              {busy === "flush" ? <Loader2 size={12} className="animate-spin" /> : <ListOrdered size={12} />} send batch now
            </button>
          </div>
        </section>

        <section className="panel space-y-3 p-5">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-950">
            <Clock size={14} className="text-accent" /> trigger thresholds & rate
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[12px] text-ink-700">Instant threshold</span>
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={num(s.instantScore, 70)}
                onBlur={(e) => void save({ instantScore: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-950 outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-ink-700">Batch threshold</span>
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={num(s.batchScore, 60)}
                onBlur={(e) => void save({ batchScore: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-950 outline-none focus:border-accent"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-[12px] text-ink-700">Hourly push limit</span>
            <input
              type="number"
              min={1}
              max={payload.caps.maxPerHour}
              defaultValue={num(s.maxPerHour, 24)}
              onBlur={(e) => void save({ maxPerHour: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-950 outline-none focus:border-accent"
            />
            <span className="mt-1 block text-[11px] text-ink-500">site cap {payload.caps.maxPerHour} items/h</span>
          </label>
          <label className="block">
            <span className="text-[12px] text-ink-700">Batch interval</span>
            <select
              value={num(s.batchIntervalMin, 30)}
              onChange={(e) => void save({ batchIntervalMin: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-950 outline-none focus:border-accent"
            >
              <option value={0}>Batching off</option>
              <option value={5}>Every 5 min</option>
              <option value={10}>Every 10 min</option>
              <option value={30}>Every 30 min</option>
              <option value={60}>Every 1h</option>
              <option value={120}>Every 2h</option>
            </select>
          </label>
          <div className="space-y-1.5 rounded-lg border border-ink-200 bg-surface-hover p-3">
            <label className="flex items-center justify-between gap-2 text-[12px] text-ink-700">
              <span className="inline-flex items-center gap-1.5">
                <Moon size={12} className="text-ink-500" /> quiet hours
              </span>
              <input
                type="checkbox"
                checked={bool(s.quietEnabled, true)}
                onChange={(e) => void save({ quietEnabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#111318]"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-[12px] text-ink-700">
              <span>Hours</span>
              <input
                defaultValue={str(s.quietHours, "23:30-08:00")}
                onBlur={(e) => void save({ quietHours: e.target.value })}
                className="w-[130px] rounded border border-ink-200 bg-surface px-2 py-1 font-mono text-[11.5px] text-ink-900 outline-none focus:border-accent"
              />
            </label>
            <label className="flex items-center justify-between gap-2 text-[12px] text-ink-700">
              <span>Timezone</span>
              <select
                value={str(s.timezone, "Asia/Shanghai")}
                onChange={(e) => void save({ timezone: e.target.value })}
                className="rounded border border-ink-200 bg-surface px-2 py-1 text-[11.5px] text-ink-900 outline-none focus:border-accent"
              >
                <option value="Asia/Shanghai">Beijing time</option>
                <option value="Asia/Tokyo">Tokyo time</option>
                <option value="UTC">UTC</option>
                <option value="America/New_York">US Eastern</option>
                <option value="Europe/London">London</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-[12px] text-ink-700">
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={cfg.useGlobalBlocks}
                onChange={(e) => void save({ useGlobalBlocks: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#111318]"
              />
              Inherit the site-wide noise blocklist
            </label>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={cfg.dailyEnabled}
                onChange={(e) => void save({ dailyEnabled: e.target.checked })}
                className="h-3.5 w-3.5 accent-[#111318]"
              />
              Send me a daily digest
            </label>
          </div>
        </section>
      </div>

      <section className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-950">
              <Sparkles size={14} className="text-accent" /> live preview (nothing is actually sent)
            </div>
            <p className="mt-0.5 text-[12px] text-ink-500">Dry-runs your rules on the last 180 items to show hits and rejection reasons.</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              setBusy("preview");
              try {
                const res = await fetch("/api/me/push/preview");
                if (res.ok) setPreview((await res.json()) as Preview);
              } finally {
                setBusy(null);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ink-950 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-hover"
          >
            {busy === "preview" ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} dry-run
          </button>
        </div>

        {preview && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-200 bg-surface-hover px-3 py-2 text-[11.5px]">
              <span className="font-medium text-ink-700">
                Scanned {preview.scanned} items · matched {preview.matched} items · queued {preview.queued} items
              </span>
              {Object.entries(preview.rejectedBy).map(([k, v]) => (
                <span key={k} className="rounded bg-ink-100 px-2 py-0.5 text-ink-600">
                  {k} <span className="font-mono font-medium">{v}</span>
                </span>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-ink-200 bg-surface-hover p-3">
                <div className="mb-1.5 text-[12px] font-medium text-deal">⚡ Instant push</div>
                <pre className="max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-700">
                  {preview.instant.length ? preview.instant.join("\n") : "(no instant-push items under current conditions)"}
                </pre>
              </div>
              <div className="rounded-lg border border-ink-200 bg-surface-hover p-3">
                <div className="mb-1.5 text-[12px] font-medium text-brand">📦 Goes to batch</div>
                <pre className="max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-700">
                  {preview.batch.length ? preview.batch.join("\n") : "(no batch items under current conditions)"}
                </pre>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <span className="text-[13.5px] font-semibold text-ink-950">My push history</span>
          <div className="flex items-center gap-3 text-[11.5px] text-ink-500">
            <span>sent last 24h: {payload.stats.sentLast24h}</span>
            <span>queue: {payload.stats.queued}</span>
            <button
              type="button"
              onClick={async () => {
                const res = await fetch("/api/me/push/log?limit=30");
                if (res.ok) setLogs(((await res.json()) as { logs: typeof logs }).logs);
              }}
              className="font-medium text-accent hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="max-h-[360px] divide-y divide-ink-100 overflow-auto">
          {logs.length === 0 && <div className="px-5 py-8 text-center text-[12.5px] text-ink-500">Records not loaded yet</div>}
          {logs.map((l) => (
            <div key={l.id} className="px-5 py-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                <span className="rounded-md bg-ink-100 px-2 py-0.5 font-medium text-ink-700">
                  {l.kind === "instant" ? "Instant" : l.kind === "batch" ? "Batch" : l.kind}
                </span>
                <span className="font-mono text-ink-500">{l.created_at.replace("T", " ").slice(5, 19)}</span>
                <span className="text-ink-600">{l.count} items</span>
                {l.ok === 0 && <span className="rounded bg-alert-subtle px-1.5 py-0.5 text-alert">Failed</span>}
                {l.reason && <span className="truncate text-ink-500">· {l.reason}</span>}
              </div>
              <pre className="mt-1 max-h-[64px] overflow-hidden font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-600">
                {(l.text ?? "").slice(0, 200)}
              </pre>
              {l.error && <div className="mt-1 font-mono text-[11px] text-alert">{l.error}</div>}
            </div>
          ))}
        </div>
      </section>

      {boot.siteMode === "public" && (
        <p className="px-1 text-[11.5px] leading-relaxed text-ink-500">
          Only the most common settings live here. For kind, category, obtain mode, price, language, freshness, and multi-route fine-tuning, open "My Push Rules" on the left —
          it is the same full panel, just writing to your own rules. Personal blocklist and watched keywords are managed in "My Subscriptions & Blocklist". 
        </p>
      )}
    </div>
  );
}