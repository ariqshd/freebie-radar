import { useEffect, useState } from "react";
import {
  BellRing,
  Bot,
  Check,
  Clock,
  Eye,
  Filter,
  Languages,
  ListOrdered,
  Loader2,
  Moon,
  RotateCcw,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  CATEGORY_DESC,
  CATEGORY_GROUPS,
  CATEGORY_LABEL,
  CHANNELS,
  KIND_LABEL,
  KIND_ORDER,
  OBTAIN_LABEL,
  OBTAIN_ORDER,
  categoryLabel,
} from "../lib/sources.ts";
import type {
  AiFallbackMode,
  PushLogItem,
  PushPayload,
  PushPreview,
  PushSettings,
  PushRoute,
  PushSourceMode,
  Source,
} from "../types.ts";

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-200 bg-surface-hover px-3.5 py-2.5 text-left transition-colors hover:border-ink-300"
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-ink-900">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] leading-snug text-ink-500">{hint}</div>}
      </div>
      <span
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors " +
          (value ? "bg-brand" : "bg-ink-300")
        }
      >
        <span
          className={
            "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform " +
            (value ? "translate-x-4.5" : "translate-x-0.5")
          }
        />
      </span>
    </button>
  );
}

/** 支持拖动滑杆 (松手提交)and直接输入精确数值 (失焦/回车提交).  */
function NumberField({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onCommit,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const clampAndCommit = (raw: number) => {
    const clamped = Math.min(Math.max(Number.isFinite(raw) ? Math.round(raw) : value, min), max);
    setDraft(clamped);
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-surface-hover px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink-900">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={draft}
            onChange={(e) => setDraft(Number(e.target.value))}
            onBlur={(e) => clampAndCommit(Number(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") clampAndCommit(Number((e.target as HTMLInputElement).value));
            }}
            className="w-16 rounded-md border border-ink-200 bg-surface px-1.5 py-0.5 text-right font-mono text-[12.5px] font-semibold tabular-nums text-brand outline-none focus:border-brand"
          />
          {suffix && <span className="text-[12px] text-ink-500">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(Math.max(draft, min), max)}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => clampAndCommit(draft)}
        onKeyUp={() => clampAndCommit(draft)}
        className="mt-2 w-full accent-brand"
      />
      {hint && <div className="mt-1 text-[11px] leading-snug text-ink-500">{hint}</div>}
    </div>
  );
}

const PRICE_CAPS: { label: string; value: number | null }[] = [
  { label: "Any price", value: null },
  { label: "Freebies only", value: 0 },
  { label: "≤ 5", value: 5 },
  { label: "≤ 10", value: 10 },
  { label: "≤ 30", value: 30 },
  { label: "≤ 100", value: 100 },
];

const AGE_OPTIONS: { label: string; hours: number }[] = [
  { label: "Within 24h", hours: 24 },
  { label: "Within 72h (default)", hours: 72 },
  { label: "Within 7 days", hours: 168 },
  { label: "Within 30 days", hours: 720 },
  { label: "Any time", hours: 0 },
];

const REJECT_LABELS: { key: string; label: string }[] = [
  { key: "blocked", label: "Blocklist" },
  { key: "duplicate", label: "Cross-source dedupe" },
  { key: "stale", label: "Past freshness" },
  { key: "source", label: "Source filter" },
  { key: "lang", label: "Language mismatch" },
  { key: "kind", label: "Kind" },
  { key: "category", label: "Category mismatch" },
  { key: "price", label: "Over price cap" },
  { key: "ai", label: "AI review blocked" },
  { key: "obtain", label: "Obtain mode" },
  { key: "route", label: "No route matched" },
  { key: "lowScore", label: "Below push score" },
];

type PushSubTab = "filters" | "timing" | "logs";

export function PushPanel({
  payload,
  preview,
  logs,
  sources,
  onSave,
  onPreview,
  onFlush,
  onTest,
}: {
  payload: PushPayload | null;
  preview: PushPreview | null;
  logs: PushLogItem[];
  sources: Source[];
  onSave: (patch: Partial<PushSettings>) => Promise<void>;
  onPreview: () => Promise<void>;
  onFlush: () => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<PushSubTab>("filters");
  const [busy, setBusy] = useState<string | null>(null);
  const s = payload?.settings;
  const stats = payload?.stats;

  const [quietFrom, setQuietFrom] = useState("23:30");
  const [quietTo, setQuietTo] = useState("08:00");
  const [customHeaderDraft, setCustomHeaderDraft] = useState("");
  const [customPriceDraft, setCustomPriceDraft] = useState("");
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [routeDraft, setRouteDraft] = useState<PushRoute | null>(null);
  const [routeKeywordsInput, setRouteKeywordsInput] = useState("");
  const [routePriceInput, setRoutePriceInput] = useState("");

  useEffect(() => {
    if (!s) return;
    if (s.quietHours) {
      const [a, b] = s.quietHours.split("-");
      if (a) setQuietFrom(a);
      if (b) setQuietTo(b);
    }
    setCustomHeaderDraft(s.customHeader ?? "");
    setCustomPriceDraft(s.maxPrice !== null && ![0, 5, 10, 30, 100].includes(s.maxPrice) ? String(s.maxPrice) : "");
  }, [s?.quietHours, s?.customHeader, s?.maxPrice]);

  const save = async (patch: Partial<PushSettings>) => {
    setBusy("save");
    try {
      await onSave(patch);
    } finally {
      setBusy(null);
    }
  };

  if (!s) return <div className="panel p-6 text-[13px] text-ink-500">Loading push rules…</div>;

  const toggleCategory = (cat: string) => {
    const exists = s.categories.includes(cat);
    const next = exists ? s.categories.filter((c) => c !== cat) : [...s.categories, cat];
    void save({ categories: next });
  };

  const toggleSourceId = (id: string) => {
    const exists = s.sourceIds.includes(id);
    const next = exists ? s.sourceIds.filter((x) => x !== id) : [...s.sourceIds, id];
    void save({ sourceIds: next });
  };

  const enabledSources = sources.filter((src) => src.enabled);

  return (
    <div className="space-y-4">
      {/* 总开关 + 实时Statusitems */}
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className={`grid h-10 w-10 place-items-center rounded-lg ${s.enabled ? "bg-deal-subtle text-deal" : "bg-ink-100 text-ink-500"}`}>
              <BellRing size={18} />
            </div>
            <div>
              <div className="text-[14px] font-semibold text-ink-950">Telegram auto-push</div>
              <div className="text-[12px] text-ink-500">
                {s.enabled
                  ? payload?.quiet
                    ? `On · In quiet hours (${s.quietAction === "drop" ? "skip entirely" : "queued for batching"})`
                    : `Live monitoring · ${s.pushTiming === "wait_ai" ? "AI first, then push" : "Instant first, review after"}`
                  : "Push paused; collecting to the local DB only"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 border-l border-ink-200 pl-6 text-[12px]">
            <div>
              <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink-950">
                {stats?.pushedLastHour ?? 0}/{s.maxPerHour}
              </span>
              <span className="text-ink-500">Hourly quota</span>
            </div>
            <div>
              <span className="block font-mono text-[15px] font-semibold tabular-nums text-ink-950">
                {stats?.pushedLast24h ?? 0}
              </span>
              <span className="text-ink-500">Pushed (24h)</span>
            </div>
            <div>
              <span className="block font-mono text-[15px] font-semibold tabular-nums text-brand">
                {stats?.queued ?? 0}
              </span>
              <span className="text-ink-500">Batch queue</span>
            </div>
            {(stats?.failures ?? 0) > 0 && (
              <div>
                <span className="block font-mono text-[15px] font-semibold tabular-nums text-alert">
                  {stats?.failures ?? 0}
                </span>
                <span className="text-ink-500">Push failed</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {payload?.defaults && (
            <button
              type="button"
              onClick={() => void save(payload.defaults)}
              className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-[12px] font-medium text-ink-600 hover:bg-ink-100"
              title="Reset all push rules to defaults"
            >
              <RotateCcw size={13} /> Reset to defaults
            </button>
          )}
          <button
            type="button"
            onClick={() => save({ enabled: !s.enabled })}
            className={
              "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors " +
              (s.enabled
                ? "border-deal-border bg-deal-subtle text-deal hover:bg-emerald-100"
                : "border-ink-200 bg-ink-100 text-ink-600 hover:bg-ink-200")
            }
          >
            <Settings2 size={14} /> {s.enabled ? "Push on (click to pause)" : "Push off (click to enable)"}
          </button>
        </div>
      </section>

      {!payload?.ready && (
        <div className="rounded-lg border border-code-border bg-code-subtle p-3.5 text-[12.5px] text-amber-900">
          The server has no TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID yet (or PUSH_CHANNEL=none); settings here save in advance and take effect as soon as credentials are set. 
        </div>
      )}

      {/* 子页签导航 */}
      <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "filters" as PushSubTab, label: "Push timing & filters", icon: Filter },
            { key: "timing" as PushSubTab, label: "Thresholds, format & quiet hours", icon: Clock },
            { key: "logs" as PushSubTab, label: `Dry-run & logs (${logs.length})`, icon: Sparkles },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors " +
                (subTab === t.key ? "bg-brand text-white" : "text-ink-600 hover:bg-ink-100")
              }
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[11.5px] text-ink-500">
          {busy === "save" ? "Saving…" : "Changes apply instantly (no restart needed)"}
        </span>
      </div>

      {subTab === "filters" && (
        <div className="space-y-4">
          {/* 1. AI 协同and推送时机 (统一归属到Push Rules中) */}
          <section className="panel space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-950">
                <Bot size={15} className="text-brand" /> push timing & AI strategy
              </div>
              <span className="text-[11.5px] text-ink-500">
                Model connection, rule pre-filter, and prompts are configured on the "AI Engine" page.
              </span>
            </div>

            {/* 当前这套设置下, 一items新items目会怎么走: 把"Thresholds / cap / Time window / Fallback"四件事讲清楚 */}
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="mb-2 text-[12px] font-medium text-ink-900">With current settings, a new item flows like this</div>
              <ol className="space-y-1.5 text-[11.5px] leading-relaxed text-ink-600">
                <li>
                  <span className="font-mono text-ink-400">1</span> items are rule-pre-filtered right after collection (help requests / patch notes / custom noise words are dropped, no AI). 
                </li>
                <li>
                  <span className="font-mono text-ink-400">2</span>{" "}
                  {s.pushTiming === "wait_ai"
                    ? `Each round holds up to ${s.syncPrePushLimit} items for AI, the rest queue in the background${s.pushAfterBackfill ? " and get pushed after passing" : " with no extra push"}.`
                    : "Rules decide pushes instantly; items needing review go to the background queue and AI verdicts fill in later."}
                </li>
                <li>
                  <span className="font-mono text-ink-400">3</span>{" "}
                  <span className="font-medium text-ink-900">Quality bar</span>: score ≥ {s.instantScore} goes instant; ≥ {s.batchScore} goes batch. 
                  {s.instantOnCodes ? "has codes, " : ""}
                  {s.instantOnUrgent ? "limited/deadline in title, " : ""}
                  {s.prioritizeSubscribed ? "matches subscription" : "no extra instant conditions"} can go instant directlyInstant. 
                </li>
                <li>
                  <span className="font-mono text-ink-400">4</span>{" "}
                  <span className="font-medium text-ink-900">Rate limits</span>: up to {s.maxPerHour} items (Instant+Batchshared), 
                  Per round instant max {s.maxPerInstant} items; the overflow is automatically moved to the Batch queue, nothing is lost. 
                </li>
                <li>
                  <span className="font-mono text-ink-400">5</span>{" "}
                  <span className="font-medium text-ink-900">Time window</span>: 
                  {s.batchIntervalMin === 0 ? "Batching is off; the queue only sends when you click \u201cSend batch now\u201d." : `Batch pushes every ${s.batchIntervalMin} min, max ${s.maxPerBatch} items per batch.`}
                  {s.quietEnabled ? ` Quiet hours ${s.quietHours}: ${s.quietAction === "drop" ? "skip entirely" : "batch only"}.` : " Quiet hours off."}
                </li>
                <li>
                  <span className="font-mono text-ink-400">6</span>{" "}
                  <span className="font-medium text-ink-900">Fallback</span>: 
                  {s.aiFallbackMode === "strict"
                    ? "Push only when AI explicitly verifies a freebie; no verdict, no push."
                    : s.aiFallbackMode === "rule_fallback"
                      ? "AI rejections are blocked; without an AI verdict, only items with redeem codes or high scores pass."
                      : "Ignore AI verdicts entirely; filter only by blocklist / score / price / obtain mode."}
                </li>
              </ol>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => save({ pushTiming: "wait_ai" })}
                className={
                  "rounded-lg border px-3.5 py-2.5 text-left transition-colors " +
                  (s.pushTiming === "wait_ai"
                    ? "border-brand bg-brand-subtle text-brand"
                    : "border-ink-200 bg-surface-hover text-ink-700 hover:bg-ink-100")
                }
              >
                <div className="text-[13px] font-semibold">AI review before push (recommended)</div>
                <div className="mt-0.5 text-[11.5px] font-normal text-ink-500">
                  New items wait for AI verification before hitting Telegram (~1-3s extra), precisely blocking news and patch notes
                </div>
              </button>
              <button
                type="button"
                onClick={() => save({ pushTiming: "instant_first" })}
                className={
                  "rounded-lg border px-3.5 py-2.5 text-left transition-colors " +
                  (s.pushTiming === "instant_first"
                    ? "border-brand bg-brand-subtle text-brand"
                    : "border-ink-200 bg-surface-hover text-ink-700 hover:bg-ink-100")
                }
              >
                <div className="text-[13px] font-semibold">Instant first, review after</div>
                <div className="mt-0.5 text-[11.5px] font-normal text-ink-500">
                  High scores / redeem codes are sent with zero delay; AI fills in the verdict and category asynchronously in the background
                </div>
              </button>
            </div>

            {s.pushTiming === "wait_ai" && (
              <NumberField
                label="Items to hold for AI before push"
                hint="How many items per collection round to hold for AI before deciding pushes; the rest go to the background queue, and the switch below decides whether to push after review"
                value={s.syncPrePushLimit}
                min={5}
                max={60}
                step={1}
                suffix=" /round"
                onCommit={(v) => void save({ syncPrePushLimit: v })}
              />
            )}

            <div>
              <div className="mb-1.5 text-[12px] font-medium text-ink-700">AI fallback & filtering mode (when an item has no AI verdict yet or was rejected by AI)</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  {
                    key: "strict" as AiFallbackMode,
                    title: "Strict mode (quality over quantity)",
                    desc: "With AI on, only items AI explicitly verifies as freebies are pushed; timeouts/unreviewed are not (rules decide when AI is off)",
                  },
                  {
                    key: "rule_fallback" as AiFallbackMode,
                    title: "Balanced fallback (recommended)",
                    desc: "AI rejections are blocked; without a result, only redeem codes or high-score freebie signals pass",
                  },
                  {
                    key: "ignore_ai" as AiFallbackMode,
                    title: "Rules only (ignore AI)",
                    desc: "Don't block pushes by AI verdict; filter only by blocklist, score, price, and obtain mode",
                  },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => save({ aiFallbackMode: opt.key })}
                    className={
                      "rounded-lg border px-3 py-2 text-left transition-colors " +
                      (s.aiFallbackMode === opt.key
                        ? "border-brand bg-brand-subtle text-brand"
                        : "border-ink-200 bg-surface-hover text-ink-700 hover:bg-ink-100")
                    }
                  >
                    <div className="text-[12.5px] font-semibold">{opt.title}</div>
                    <div className="mt-0.5 text-[11px] leading-snug text-ink-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <Toggle
                label="Auto-push after background review passes"
                hint="When backfill review confirms a freebie beyond the sync limit or in instant-first mode, it is added to the push pipeline automatically (never re-sends an item already pushed)"
                value={s.pushAfterBackfill}
                onChange={(v) => save({ pushAfterBackfill: v })}
              />
              <Toggle
                label="Subscription hits push first"
                hint="Items matching \u201cMy subscriptions\u201d keywords are pushed instantly as singles"
                value={s.prioritizeSubscribed}
                onChange={(v) => save({ prioritizeSubscribed: v })}
              />
              <Toggle
                label="Also apply to the daily digest"
                hint="The daily digest also respects price, category, source, and AI conditions"
                value={s.applyToDigest}
                onChange={(v) => save({ applyToDigest: v })}
              />
            </div>
          </section>

          {/* 2. 多维推送Filters */}
          <section className="panel space-y-4 p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-950">
              <SlidersHorizontal size={15} className="text-brand" /> Push content filters
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {/* 最高Price cap */}
              <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink-900">Max push price</span>
                  <span className="font-mono text-[12px] text-brand">
                    {s.maxPrice === null ? "Any" : s.maxPrice === 0 ? "Totally free" : `≤ ${s.maxPrice}`}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {PRICE_CAPS.map((p) => {
                    const active = s.maxPrice === p.value;
                    return (
                      <button
                        key={String(p.value)}
                        type="button"
                        onClick={() => save({ maxPrice: p.value })}
                        className={
                          "rounded-lg border px-2 py-1.5 text-[11.5px] font-medium transition-colors " +
                          (active
                            ? "border-brand bg-brand text-white"
                            : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                        }
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={customPriceDraft}
                    onChange={(e) => setCustomPriceDraft(e.target.value)}
                    placeholder="Custom amount"
                    className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-surface px-2 py-1 font-mono text-[11.5px] text-ink-900 outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const n = Number(customPriceDraft);
                      if (customPriceDraft.trim() !== "" && Number.isFinite(n) && n >= 0) {
                        void save({ maxPrice: n });
                      }
                    }}
                    className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-ink-100"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* language filter */}
              <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                  <Languages size={14} className="text-ink-500" /> language filter
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: "all" as const, label: "Push both languages" },
                    { key: "zh" as const, label: "Chinese sources only" },
                    { key: "en" as const, label: "English sources only" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => save({ langMode: o.key })}
                      className={
                        "rounded-lg border px-2 py-1.5 text-[12px] font-medium transition-colors " +
                        (s.langMode === o.key
                          ? "border-brand bg-brand text-white"
                          : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-ink-500">
                  Auto-detected from the Chinese share of the title; English items get an EN tag and CNY-converted prices. 
                </p>
              </div>

              {/* 新帖时效cap */}
              <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-ink-900">Freshness window</span>
                  <span className="font-mono text-[12px] text-brand">
                    {s.maxAgeHours <= 0 ? "Any" : `${s.maxAgeHours}h`}
                  </span>
                </div>
                <select
                  value={AGE_OPTIONS.some((o) => o.hours === s.maxAgeHours) ? s.maxAgeHours : "custom"}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) void save({ maxAgeHours: v });
                  }}
                  className="w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-brand"
                >
                  {AGE_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>
                      {o.label}
                    </option>
                  ))}
                  {!AGE_OPTIONS.some((o) => o.hours === s.maxAgeHours) && (
                    <option value="custom">Custom: within {s.maxAgeHours}h</option>
                  )}
                </select>
                <p className="mt-2 text-[11px] leading-snug text-ink-500">
                  Stops stale posts from being re-pushed as new freebies, so old forum threads can't flood the feed. 
                </p>
              </div>
            </div>

            {/* Kind白名单 */}
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink-900">Which content kinds to push (none checked = all valid kinds)</span>
                {(s.kinds?.length ?? 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => save({ kinds: [] })}
                    className="text-[12px] font-medium text-brand hover:underline"
                  >
                    Reset all kinds
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {KIND_ORDER.map((key) => {
                  const checked = (s.kinds ?? []).includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        save({
                          kinds: checked ? (s.kinds ?? []).filter((x) => x !== key) : [...(s.kinds ?? []), key],
                        })
                      }
                      className={
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] transition-colors " +
                        (checked
                          ? "border-brand bg-brand-subtle font-medium text-brand"
                          : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                      }
                    >
                      {checked && <Check size={12} />}
                      {KIND_LABEL[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category白名单: pts组and主页频道一致,  can go instant directly套用频道默认集合 */}
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink-900">Which categories to push (none checked = push all)</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11.5px] text-ink-500">Apply homepage channel:</span>
                  {CHANNELS.map((ch) => {
                    const same =
                      s.categories.length === ch.categories.length &&
                      ch.categories.every((c) => s.categories.includes(c));
                    return (
                      <button
                        key={ch.key}
                        type="button"
                        onClick={() => save({ categories: [...ch.categories] })}
                        className={
                          "rounded border px-2 py-0.5 text-[11.5px] transition-colors " +
                          (same
                            ? "border-brand bg-brand text-white"
                            : "border-ink-200 bg-surface text-ink-600 hover:border-brand-border hover:text-brand")
                        }
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                  {s.categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => save({ categories: [] })}
                      className="text-[12px] font-medium text-brand hover:underline"
                    >
                      Reset all categories
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                {CATEGORY_GROUPS.map((group) => (
                  <div key={group.key} className="flex flex-wrap items-center gap-1.5">
                    <span className="w-[62px] shrink-0 text-[11px] text-ink-400">{group.label}</span>
                    {group.categories.map((key) => {
                      const checked = s.categories.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          title={CATEGORY_DESC[key]}
                          onClick={() => toggleCategory(key)}
                          className={
                            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] transition-colors " +
                            (checked
                              ? "border-brand bg-brand-subtle font-medium text-brand"
                              : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                          }
                        >
                          {checked && <Check size={12} />}
                          {CATEGORY_LABEL[key]}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Obtain mode白名单 */}
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink-900">Push only these obtain modes (none selected = no limit)</span>
                {s.obtainModes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => save({ obtainModes: [] })}
                    className="text-[12px] font-medium text-brand hover:underline"
                  >
                    AnyObtain mode
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(["free", "conditional", "paid", "lottery", "trial", "promo"] as const).map((key) => {
                  const checked = s.obtainModes.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        save({
                          obtainModes: checked ? s.obtainModes.filter((x) => x !== key) : [...s.obtainModes, key],
                        })
                      }
                      className={
                        "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] transition-colors " +
                        (checked
                          ? "border-brand bg-brand-subtle font-medium text-brand"
                          : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                      }
                    >
                      {checked && <Check size={12} />}
                      {OBTAIN_LABEL[key]}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-500">
                Giveaways, trials, and promos often mix in marketing — by default only "Free" is pushed. 
              </p>
            </div>

            {/* 多频道推送路由 */}
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[13px] font-medium text-ink-900">Multi-topic routes (optional)</span>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    When any route is enabled, items are matched per route (several routes can push at once; with routes disabled the global filters apply).
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const next: PushRoute = {
                        id: `free-${Date.now()}`,
                        name: "Freebies instant",
                        enabled: true,
                        kinds: ["freebie"],
                        categories: [],
                        obtainModes: ["free", "conditional"],
                        keywords: [],
                        maxPrice: 0,
                        minScore: 65,
                        instant: true,
                        header: "🎁 Verified Freebies",
                      };
                      void save({ routes: [...(s.routes ?? []), next] });
                    }}
                    className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-ink-100"
                  >
                    + Verified Freebies route
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      save({
                        routes: [
                          ...(s.routes ?? []),
                          {
                            id: `vps-${Date.now()}`,
                            name: "Black Friday / VPS Deals",
                            enabled: true,
                            kinds: ["deal", "freebie"],
                            categories: ["vps", "cloud", "domain"],
                            obtainModes: ["free", "conditional", "paid"],
                            keywords: ["Black Friday", "vps", "kvm", "yearly"],
                            maxPrice: null,
                            minScore: 55,
                            instant: true,
                            header: "🖥 VPS Deals",
                          },
                        ],
                      })
                    }
                    className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-ink-100"
                  >
                    + Black Friday / VPS route
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      save({
                        routes: [
                          ...(s.routes ?? []),
                          {
                            id: `os-${Date.now()}`,
                            name: "Open-source picks",
                            enabled: true,
                            kinds: ["opensource"],
                            categories: [],
                            obtainModes: [],
                            keywords: [],
                            maxPrice: null,
                            minScore: 60,
                            instant: false,
                            header: "📦 Open Source Radar",
                          },
                        ],
                      })
                    }
                    className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-ink-100"
                  >
                    + Open Source route
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      save({
                        routes: [
                          ...(s.routes ?? []),
                          {
                            id: `news-${Date.now()}`,
                            name: "News morning brief",
                            enabled: true,
                            kinds: ["info"],
                            categories: ["headline", "finance", "ai", "dev", "opensource", "security", "hardware", "news"],
                            obtainModes: [],
                            keywords: [],
                            maxPrice: null,
                            minScore: 55,
                            instant: false,
                            header: "📰 News",
                          },
                        ],
                      })
                    }
                    className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-ink-100"
                  >
                    + News route
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next: PushRoute = {
                        id: `custom-${Date.now()}`,
                        name: "Custom topic routes",
                        enabled: true,
                        kinds: [],
                        categories: [],
                        obtainModes: [],
                        keywords: [],
                        maxPrice: null,
                        minScore: 60,
                        instant: false,
                        header: "",
                      };
                      void save({ routes: [...(s.routes ?? []), next] }).then(() => {
                        setEditingRouteId(next.id);
                        setRouteDraft(next);
                        setRouteKeywordsInput("");
                        setRoutePriceInput("");
                      });
                    }}
                    className="rounded-lg border border-brand bg-brand-subtle px-2.5 py-1 text-[11.5px] font-medium text-brand hover:bg-brand/10"
                  >
                    + New custom route
                  </button>
                </div>
              </div>
              {(s.routes?.length ?? 0) > 0 && (
                <div className="mt-2 space-y-2">
                  {(s.routes ?? []).map((rt, idx) => {
                    const isEditing = editingRouteId === rt.id && routeDraft;
                    return (
                      <div
                        key={rt.id}
                        className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-[12px]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 font-medium text-ink-900">
                              <span>{rt.name}</span>
                              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10.5px] text-ink-600">
                                {rt.instant ? "Instant" : "Batch only"}
                              </span>
                              <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-600">
                                ≥{rt.minScore}
                              </span>
                              {rt.kinds.length > 0 && (
                                <span className="text-[11px] font-normal text-ink-500">
                                  Kind: {rt.kinds.map((k) => KIND_LABEL[k] ?? k).join("/")}
                                </span>
                              )}
                              {rt.categories.length > 0 && (
                                <span className="text-[11px] font-normal text-ink-500">
                                  Category: {rt.categories.map((c) => categoryLabel(c)).join("/")}
                                </span>
                              )}
                              {rt.keywords.length > 0 && (
                                <span className="text-[11px] font-normal text-ink-500">
                                  Words: {rt.keywords.join("/")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingRouteId(null);
                                  setRouteDraft(null);
                                } else {
                                  setEditingRouteId(rt.id);
                                  setRouteDraft({ ...rt });
                                  setRouteKeywordsInput(rt.keywords.join(", "));
                                  setRoutePriceInput(rt.maxPrice === null ? "" : String(rt.maxPrice));
                                }
                              }}
                              className="rounded border border-ink-200 px-2 py-0.5 text-[11px] text-ink-700 hover:bg-ink-100"
                            >
                              {isEditing ? "Collapse" : "Edit"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                save({
                                  routes: (s.routes ?? []).map((x, i) => (i === idx ? { ...x, enabled: !x.enabled } : x)),
                                })
                              }
                              className={
                                "rounded border px-2 py-0.5 text-[11px] font-medium " +
                                (rt.enabled
                                  ? "border-deal-border bg-deal-subtle text-deal"
                                  : "border-ink-200 bg-ink-100 text-ink-500")
                              }
                            >
                              {rt.enabled ? "Enabled" : "Disabled"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingRouteId(null);
                                  setRouteDraft(null);
                                }
                                void save({
                                  routes: (s.routes ?? []).filter((_, i) => i !== idx),
                                });
                              }}
                              className="rounded border border-ink-200 px-2 py-0.5 text-[11px] text-ink-500 hover:text-alert"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {isEditing && routeDraft && (
                          <div className="mt-3 space-y-2.5 border-t border-ink-100 pt-3">
                            <div className="grid gap-2.5 sm:grid-cols-4">
                              <label className="block">
                                <span className="text-[11px] text-ink-500">Route name</span>
                                <input
                                  value={routeDraft.name}
                                  onChange={(e) => setRouteDraft({ ...routeDraft, name: e.target.value })}
                                  className="mt-1 w-full rounded border border-ink-200 bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-ink-500">Message header prefix (optional)</span>
                                <input
                                  value={routeDraft.header ?? ""}
                                  onChange={(e) => setRouteDraft({ ...routeDraft, header: e.target.value })}
                                  placeholder="e.g. 🖥 VPS Deals"
                                  className="mt-1 w-full rounded border border-ink-200 bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-ink-500">Min score (0-100)</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={routeDraft.minScore}
                                  onChange={(e) =>
                                    setRouteDraft({ ...routeDraft, minScore: Number(e.target.value) || 0 })
                                  }
                                  className="mt-1 w-full rounded border border-ink-200 bg-surface px-2 py-1 font-mono text-[12px] outline-none focus:border-brand"
                                />
                              </label>
                              <label className="block">
                                <span className="text-[11px] text-ink-500">Max price (empty = unlimited, 0 = free only)</span>
                                <input
                                  value={routePriceInput}
                                  onChange={(e) => setRoutePriceInput(e.target.value)}
                                  placeholder="Empty = no limit"
                                  className="mt-1 w-full rounded border border-ink-200 bg-surface px-2 py-1 font-mono text-[12px] outline-none focus:border-brand"
                                />
                              </label>
                            </div>

                            <div className="grid gap-2.5 sm:grid-cols-2">
                              <label className="block">
                                <span className="text-[11px] text-ink-500">Topic keywords (comma-separated; empty = all; any match counts)</span>
                                <input
                                  value={routeKeywordsInput}
                                  onChange={(e) => setRouteKeywordsInput(e.target.value)}
                                  placeholder="e.g. black friday, vps, kvm, claude"
                                  className="mt-1 w-full rounded border border-ink-200 bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand"
                                />
                              </label>
                              <div className="flex items-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setRouteDraft({ ...routeDraft, instant: !routeDraft.instant })}
                                  className={
                                    "rounded border px-2.5 py-1 text-[11.5px] font-medium " +
                                    (routeDraft.instant
                                      ? "border-brand bg-brand-subtle text-brand"
                                      : "border-ink-200 bg-surface text-ink-700")
                                  }
                                >
                                  {routeDraft.instant ? "Mode: instant push when conditions match" : "Mode: scheduled batch digest only"}
                                </button>
                              </div>
                            </div>

                            <div>
                              <span className="text-[11px] text-ink-500">Allowed kinds (none selected = all valid kinds)</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {KIND_ORDER.map((k) => {
                                  const on = routeDraft.kinds.includes(k);
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() =>
                                        setRouteDraft({
                                          ...routeDraft,
                                          kinds: on
                                            ? routeDraft.kinds.filter((x) => x !== k)
                                            : [...routeDraft.kinds, k],
                                        })
                                      }
                                      className={
                                        "rounded border px-2 py-0.5 text-[11px] " +
                                        (on
                                          ? "border-brand bg-brand-subtle font-medium text-brand"
                                          : "border-ink-200 bg-surface text-ink-600")
                                      }
                                    >
                                      {KIND_LABEL[k]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <span className="text-[11px] text-ink-500">Allowed obtain modes (none selected = all)</span>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {OBTAIN_ORDER.map((o) => {
                                  const on = routeDraft.obtainModes.includes(o);
                                  return (
                                    <button
                                      key={o}
                                      type="button"
                                      onClick={() =>
                                        setRouteDraft({
                                          ...routeDraft,
                                          obtainModes: on
                                            ? routeDraft.obtainModes.filter((x) => x !== o)
                                            : [...routeDraft.obtainModes, o],
                                        })
                                      }
                                      className={
                                        "rounded border px-2 py-0.5 text-[11px] " +
                                        (on
                                          ? "border-brand bg-brand-subtle font-medium text-brand"
                                          : "border-ink-200 bg-surface text-ink-600")
                                      }
                                    >
                                      {OBTAIN_LABEL[o]}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-[11px] text-ink-500">Allowed categories (none selected = all)</span>
                                <div className="flex flex-wrap items-center gap-1">
                                  <span className="text-[10.5px] text-ink-400">Apply channel: </span>
                                  {CHANNELS.map((ch) => (
                                    <button
                                      key={ch.key}
                                      type="button"
                                      onClick={() => setRouteDraft({ ...routeDraft, categories: [...ch.categories] })}
                                      className="rounded border border-ink-200 bg-surface px-1.5 py-0.5 text-[10.5px] text-ink-600 hover:border-brand-border hover:text-brand"
                                    >
                                      {ch.label}
                                    </button>
                                  ))}
                                  {routeDraft.categories.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setRouteDraft({ ...routeDraft, categories: [] })}
                                      className="text-[10.5px] font-medium text-brand hover:underline"
                                    >
                                      Clear
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="mt-1 space-y-1">
                                {CATEGORY_GROUPS.map((group) => (
                                  <div key={group.key} className="flex flex-wrap items-center gap-1">
                                    <span className="w-[52px] shrink-0 text-[10.5px] text-ink-400">{group.label}</span>
                                    {group.categories.map((ck) => {
                                      const on = routeDraft.categories.includes(ck);
                                      return (
                                        <button
                                          key={ck}
                                          type="button"
                                          title={CATEGORY_DESC[ck]}
                                          onClick={() =>
                                            setRouteDraft({
                                              ...routeDraft,
                                              categories: on
                                                ? routeDraft.categories.filter((x) => x !== ck)
                                                : [...routeDraft.categories, ck],
                                            })
                                          }
                                          className={
                                            "rounded border px-2 py-0.5 text-[11px] " +
                                            (on
                                              ? "border-brand bg-brand-subtle font-medium text-brand"
                                              : "border-ink-200 bg-surface text-ink-600")
                                          }
                                        >
                                          {CATEGORY_LABEL[ck]}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingRouteId(null);
                                  setRouteDraft(null);
                                }}
                                className="rounded border border-ink-200 px-3 py-1 text-[11.5px] text-ink-600 hover:bg-ink-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const kws = routeKeywordsInput
                                    .split(/[,, ]/)
                                    .map((x) => x.trim())
                                    .filter(Boolean);
                                  const pNum = routePriceInput.trim() === "" ? null : Number(routePriceInput.trim());
                                  const updated: PushRoute = {
                                    ...routeDraft,
                                    name: routeDraft.name.trim() || "Unnamed route",
                                    keywords: kws,
                                    maxPrice: pNum !== null && Number.isFinite(pNum) && pNum >= 0 ? pNum : null,
                                  };
                                  void save({
                                    routes: (s.routes ?? []).map((x, i) => (i === idx ? updated : x)),
                                  }).then(() => {
                                    setEditingRouteId(null);
                                    setRouteDraft(null);
                                  });
                                }}
                                className="rounded bg-brand px-3 py-1 text-[11.5px] font-medium text-white hover:bg-brand-hover"
                              >
                                Save route
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sources范围控制 */}
            <div className="rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-ink-900">Push source scope</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { key: "all" as PushSourceMode, label: "All enabled sources" },
                    { key: "include" as PushSourceMode, label: "Push selected only" },
                    { key: "exclude" as PushSourceMode, label: "Exclude selected sources" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => save({ sourceMode: m.key })}
                      className={
                        "rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors " +
                        (s.sourceMode === m.key
                          ? "border-brand bg-brand text-white"
                          : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {s.sourceMode !== "all" && (
                <div className="mt-2.5 space-y-2">
                  <div className="flex items-center justify-between text-[11.5px] text-ink-500">
                    <span>
                      {s.sourceMode === "include"
                        ? `Push only the ${s.sourceIds.length} selected sources`
                        : `Skip the ${s.sourceIds.length} selected sources (still collected for the web)`}
                    </span>
                    {s.sourceIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => save({ sourceIds: [] })}
                        className="font-medium text-brand hover:underline"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                  <div className="flex max-h-[160px] flex-wrap gap-1.5 overflow-auto rounded-lg border border-ink-200 bg-surface p-2">
                    {enabledSources.map((src) => {
                      const active = s.sourceIds.includes(src.id);
                      return (
                        <button
                          key={src.id}
                          type="button"
                          onClick={() => toggleSourceId(src.id)}
                          className={
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] transition-colors " +
                            (active
                              ? "border-brand bg-brand-subtle font-medium text-brand"
                              : "border-ink-200 bg-surface-hover text-ink-700 hover:bg-ink-100")
                          }
                        >
                          {active && <Check size={11} />}
                          {src.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {subTab === "timing" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* 评分Thresholdsand消息内容自定义 */}
          <section className="panel space-y-3 p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-950">
              <Zap size={15} className="text-brand" /> trigger thresholds & message format
            </div>
            <NumberField
              label="Instant threshold ≥"
              hint="Items at this score are sent immediately as singles, no batching (applies on release or Enter)"
              value={s.instantScore}
              min={0}
              max={100}
              step={5}
              suffix=" pts"
              onCommit={(v) => save({ instantScore: v })}
            />
            <NumberField
              label="Batch threshold ≥"
              hint={`Items below the instant threshold enter the batch queue for scheduled merging (auto ≤ instant threshold of ${s.instantScore})`}
              value={s.batchScore}
              min={0}
              max={s.instantScore}
              step={5}
              suffix=" pts"
              onCommit={(v) => save({ batchScore: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Toggle
                label="Redeem codes instant"
                value={s.instantOnCodes}
                onChange={(v) => save({ instantOnCodes: v })}
              />
              <Toggle
                label="Limited/slot items instant"
                value={s.instantOnUrgent}
                onChange={(v) => save({ instantOnUrgent: v })}
              />
            </div>

            <div className="pt-1">
              <div className="mb-1.5 text-[12px] font-medium text-ink-700">Message elements & dedupe toggles</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Toggle label="Include price" value={s.includePrice} onChange={(v) => save({ includePrice: v })} />
                <Toggle label="Include deadline" value={s.includeDeadline} onChange={(v) => save({ includeDeadline: v })} />
                <Toggle label="Include score" value={s.includeScore} onChange={(v) => save({ includeScore: v })} />
                <Toggle label="Include obtain mode" value={s.includeObtain} onChange={(v) => save({ includeObtain: v })} />
                <Toggle label="Include AI reason" value={s.includeAiReason} onChange={(v) => save({ includeAiReason: v })} />
                <Toggle label="Cross-source dedupe" value={s.dedupeByTitle} onChange={(v) => save({ dedupeByTitle: v })} />
              </div>
            </div>

            <label className="block rounded-lg border border-ink-200 bg-surface-hover px-3.5 py-2.5">
              <span className="text-[12.5px] font-medium text-ink-900">Custom message header prefix (saves on blur; empty = default)</span>
              <input
                value={customHeaderDraft}
                onChange={(e) => setCustomHeaderDraft(e.target.value)}
                onBlur={() => {
                  if (customHeaderDraft.trim() !== s.customHeader) {
                    void save({ customHeader: customHeaderDraft.trim() });
                  }
                }}
                placeholder="e.g. 🛰 Resource Radar · Picks"
                maxLength={60}
                className="mt-1.5 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-brand"
              />
            </label>
          </section>

          {/* 频率限制andquiet hours */}
          <section className="panel space-y-3 p-5">
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-950">
              <Clock size={15} className="text-brand" /> rate limits & quiet hours
            </div>
            <NumberField
              label="Hourly push limit"
              hint="Total of instant + batch items (1-200)"
              value={s.maxPerHour}
              min={1}
              max={200}
              suffix=" items"
              onCommit={(v) => save({ maxPerHour: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Max instant per round"
                value={s.maxPerInstant}
                min={1}
                max={10}
                suffix=" items"
                onCommit={(v) => save({ maxPerInstant: v })}
              />
              <NumberField
                label="Max per batch"
                value={s.maxPerBatch}
                min={1}
                max={20}
                suffix=" items"
                onCommit={(v) => save({ maxPerBatch: v })}
              />
            </div>

            <label className="block rounded-lg border border-ink-200 bg-surface-hover px-3.5 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-ink-900">Batch interval (the timer rebuilds immediately on change)</span>
                <span className="font-mono text-[12px] text-brand">
                  {s.batchIntervalMin === 0 ? "Hidden" : `Every ${s.batchIntervalMin} min`}
                </span>
              </div>
              <select
                value={s.batchIntervalMin}
                onChange={(e) => save({ batchIntervalMin: Number(e.target.value) })}
                className="mt-2 w-full rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-900 outline-none focus:border-brand"
              >
                <option value={0}>Batching off</option>
                <option value={5}>Every 5 min</option>
                <option value={10}>Every 10 min</option>
                <option value={15}>Every 15 min</option>
                <option value={30}>Every 30 min</option>
                <option value={60}>Every 1h</option>
                <option value={120}>Every 2h</option>
              </select>
            </label>

            <div className="space-y-2.5 rounded-lg border border-ink-200 bg-surface-hover p-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-900">
                  <Moon size={13} className="text-ink-500" /> Quiet hours
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11.5px] font-medium ${payload?.quiet ? "text-amber-700" : "text-ink-500"}`}>
                    {!s.quietEnabled ? "Disabled" : payload?.quiet ? "Quiet hours" : "Normal push hours"}
                  </span>
                  <button
                    type="button"
                    onClick={() => save({ quietEnabled: !s.quietEnabled })}
                    className={
                      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors " +
                      (s.quietEnabled ? "bg-brand" : "bg-ink-300")
                    }
                    title={s.quietEnabled ? "Click to turn off quiet hours" : "Click to turn on quiet hours"}
                  >
                    <span
                      className={
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform " +
                        (s.quietEnabled ? "translate-x-4.5" : "translate-x-0.5")
                      }
                    />
                  </button>
                </div>
              </div>

              {s.quietEnabled && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="time"
                      value={quietFrom}
                      onChange={(e) => setQuietFrom(e.target.value)}
                      onBlur={() => {
                        const next = `${quietFrom}-${quietTo}`;
                        if (next !== s.quietHours) void save({ quietHours: next });
                      }}
                      className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 font-mono text-[12.5px] text-ink-900 outline-none focus:border-brand"
                    />
                    <span className="text-ink-400">–</span>
                    <input
                      type="time"
                      value={quietTo}
                      onChange={(e) => setQuietTo(e.target.value)}
                      onBlur={() => {
                        const next = `${quietFrom}-${quietTo}`;
                        if (next !== s.quietHours) void save({ quietHours: next });
                      }}
                      className="rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 font-mono text-[12.5px] text-ink-900 outline-none focus:border-brand"
                    />
                    <select
                      value={s.timezone}
                      onChange={(e) => save({ timezone: e.target.value })}
                      className="ml-auto rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-[12px] text-ink-800 outline-none focus:border-brand"
                    >
                      <option value="Asia/Shanghai">Beijing (UTC+8)</option>
                      <option value="Asia/Tokyo">Tokyo (UTC+9)</option>
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">US Eastern</option>
                      <option value="Europe/London">London</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: "batch" as const, label: "Send in the morning batch" },
                      { key: "drop" as const, label: "Skip during quiet hours" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => save({ quietAction: opt.key })}
                        className={
                          "rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors " +
                          (s.quietAction === opt.key
                            ? "border-brand bg-brand-subtle text-brand"
                            : "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100")
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {subTab === "logs" && (
        <div className="space-y-4">
          {/* 预览and测试 */}
          <section className="panel space-y-3.5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[14px] font-semibold text-ink-950">
                  <Sparkles size={15} className="text-brand" /> live preview (nothing is actually sent)
                </div>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  Dry-runs the latest 180 unpushed DB items against all filters above, showing hits and rejection reasons instantly. 
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setBusy("preview");
                    try {
                      await onPreview();
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover"
                >
                  {busy === "preview" ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} dry-run preview
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBusy("flush");
                    try {
                      await onFlush();
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-ink-100"
                >
                  {busy === "flush" ? <Loader2 size={13} className="animate-spin" /> : <ListOrdered size={13} />} send batch now
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setBusy("test");
                    try {
                      await onTest();
                    } finally {
                      setBusy(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-ink-100"
                >
                  {busy === "test" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} send test message
                </button>
              </div>
            </div>

            {preview && (
              <div className="space-y-3 pt-1">
                {preview.rejectedBy && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-ink-200 bg-surface-hover px-3 py-2 text-[11.5px]">
                    <span className="font-medium text-ink-700">
                      Scanned {preview.scanned} items · matched {preview.matched} items · rejected: 
                    </span>
                    {REJECT_LABELS.filter((r) => (preview.rejectedBy?.[r.key] ?? 0) > 0).map((r) => (
                      <span key={r.key} className="rounded bg-ink-100 px-2 py-0.5 text-ink-600">
                        {r.label} <span className="font-mono font-medium">{preview.rejectedBy?.[r.key]}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg border border-ink-200 bg-surface-hover p-3">
                    <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-deal">
                      <span>⚡ Instant push (eligible {preview.instantTotal ?? preview.instant.length})</span>
                      <span className="font-mono text-[11px] text-ink-500">
                        Actually sending this round: {preview.sendableInstant ?? preview.instant.length} items
                      </span>
                    </div>
                    <pre className="max-h-[220px] overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-700">
                      {preview.instant.length ? preview.instant.join("\n\n") : "(no items trigger an instant push under current conditions)"}
                    </pre>
                  </div>
                  <div className="rounded-lg border border-ink-200 bg-surface-hover p-3">
                    <div className="mb-1.5 text-[12px] font-medium text-brand">
                      📦 Batch queue (eligible {preview.batchTotal ?? preview.batch.length}, already queued in memory {preview.queued})
                    </div>
                    <pre className="max-h-[220px] overflow-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-700">
                      {preview.batch.length ? preview.batch.join("\n\n") : "(no items reach the batch threshold under current conditions)"}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 历史推送记录 */}
          <section className="panel overflow-hidden">
            <div className="border-b border-ink-100 px-5 py-3.5 text-[13.5px] font-semibold text-ink-950">
              Recent push logs ({logs.length})
            </div>
            <div className="max-h-[420px] divide-y divide-ink-100 overflow-auto">
              {logs.length === 0 && (
                <div className="px-5 py-10 text-center text-[12.5px] text-ink-500">No push history yet</div>
              )}
              {logs.map((l) => (
                <div key={l.id} className="px-5 py-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[12px]">
                    <span
                      className={
                        "rounded-md px-2 py-0.5 font-medium " +
                        (l.kind === "instant"
                          ? "bg-code-subtle text-amber-800"
                          : l.kind === "batch"
                            ? "bg-brand-subtle text-brand"
                            : "bg-ink-100 text-ink-700")
                      }
                    >
                      {l.kind === "instant" ? "Instant push" : l.kind === "batch" ? "Batch push" : l.kind}
                    </span>
                    <span className="font-mono text-ink-500">{l.created_at.replace("T", " ").slice(5, 19)}</span>
                    <span className="text-ink-600">{l.count} items</span>
                    {l.ok === 0 && <span className="rounded bg-alert-subtle px-1.5 py-0.5 text-alert">Send failed</span>}
                    {l.reason && <span className="truncate text-ink-500">· reason: {l.reason}</span>}
                  </div>
                  <pre className="max-h-[72px] overflow-hidden font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-ink-600">
                    {(l.text ?? "").slice(0, 240)}
                    {(l.text ?? "").length > 240 ? "…" : ""}
                  </pre>
                  {l.error && <div className="mt-1 font-mono text-[11px] text-alert">{l.error}</div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
