import { config } from "../config.ts";
import { all, get, run } from "../db.ts";
import type { RawItem } from "../collectors/types.ts";
import { NOISE_TITLE } from "./noise.ts";
import { FREEBIE_ONLY_SOURCES } from "./index.ts";
import type { ObtainMode } from "./obtain.ts";
import { isContentKind, type ContentKind } from "./kind.ts";
import { finishAiJob, recordAiBatch, startAiJob } from "./ai-telemetry.ts";

import { CATEGORY_DESC, CATEGORY_KEYS } from "../../shared/taxonomy.ts";

export type AiVerdict = {
  index: number;
  keep: boolean;
  /** 内容形态：freebie=白嫖福利 | deal=特价好价 | opensource=开源项目 | info=实用指南 | noise=噪音 */
  kind?: ContentKind;
  category: string;
  reason: string;
  /** 获取方式：AI 判断；缺失时由规则兜底 */
  obtain?: ObtainMode;
  /** 1-5 分质量评估：5=高价值必看/必抢，4=明确好内容，3=普通，2=鸡肋，1=噪音 */
  quality?: number;
};

export type AiSourceMode = "all" | "exclude" | "only";

export type AiSettings = {
  /** 总开关：关掉后采集不再自动送审 */
  enabled: boolean;
  /** OpenAI 兼容端点，带 /v1 */
  baseUrl: string;
  /** 密钥；界面只显示末四位 */
  apiKey: string;
  /** 模型名 */
  model: string;
  /** 每轮最多送审多少条（20-500） */
  maxItems: number;
  /** 每批发送条数（2-20，默认 6） */
  batchSize: number;
  /** 并发批数（1-8，默认 4） */
  concurrency: number;
  /** 单批请求超时秒数（5-60，默认 15） */
  timeoutSec: number;
  /** 第一道规则初筛开关：开启后自动跳过求助/问价/版本更新等硬噪音，不浪费 AI 额度 */
  preFilterEnabled: boolean;
  /** 用户自定义入口拦截关键词：命中直接跳过送审且不主动直推 */
  customNoiseKeywords: string[];
  /** 纯白嫖专源（Epic/Steam/GamerPower 等）免送 AI，直接视作真福利 */
  skipFreebieSources: boolean;
  /** 送审数据源范围：all 全部 / exclude 排除指定源 / only 仅审指定源 */
  sourceMode: AiSourceMode;
  /** 配合 sourceMode 使用的数据源 ID 列表 */
  sourceIds: string[];
  /** 补充审核规则（追加在系统默认口径后，不破坏 JSON 输出要求） */
  extraPrompt: string;
  /** 高级：完全自定义主提示词；留空用内置默认 */
  systemPrompt: string;
  /** true = 自动从用户收藏（正例）与手动关闭（负例）学习偏好 */
  learnFromFeedback: boolean;
  /** 正负样本各抽取最近几条（1-15，默认 6） */
  feedbackLimit: number;
  /** 是否启用 AI 语义去重（审核入库后 & Telegram 推送前防重复） */
  aiDedupEnabled: boolean;
  /** AI 语义去重对比窗口（小时，6-168，默认 48） */
  aiDedupWindowHours: number;
  /** 中文标题/摘要自动翻译成英文（写入 title_en / summary_en，仅翻译 AI 判 keep 的条目） */
  translateEnabled: boolean;
  /** 每轮最多翻译多少条（0-120，默认 24） */
  translatePerRun: number;
  /** 翻译专用模型（省额度用小模型）；留空 = 复用主模型 */
  translateModel: string;
};

const SETTINGS_KEY = "ai";
const DEFAULT_MAX_ITEMS = 60;

/** 分类清单与说明由 shared/taxonomy.ts 生成，加分类不用再改提示词 */
const CATEGORY_PROMPT_LINE = `分类 category 只能是：${CATEGORY_KEYS.join(" | ")}`;
const CATEGORY_DESC_LINE = `细分类参考：${CATEGORY_KEYS.map((k) => `${k}=${CATEGORY_DESC[k]}`).join("；")}。`;
const DEFAULT_PROMPT = [
  "You are the content reviewer and tagger for a multi-topic community \"Resource Radar\". Filter low-signal posts and classify valuable items accurately into \"freebie / deal / open source / top news / industry news\". Do not mistakenly kill open-source projects, Black Friday deals, legit carpools, or high-value major news / finance / tech updates as noise.",
  "",
  "Five kinds of valid content with keep=true (always set kind):",
  "1. freebie (free giveaways): free games / genuine software licenses, redeem codes / CDKs / public-utility credits / free tokens, free cloud VMs / domains / GPUs / compute / student packs, actionable freebie guides you can actually claim, and newly launched :free models on OpenRouter.",
  "2. deal (deals / carpool / secondhand): clear high-value paid promotions, historical-low discounts (e.g. Black Friday VPS sales, yearly cheap VPS, Steam record lows, big software lifetime deals), clearly priced legit carpools / shared subscriptions (e.g. ChatGPT/Claude/Netflix family slots), and clearly priced secondhand server transfers. Do not block good deals just because they cost money.",
  "3. opensource (open-source projects): must have a clear GitHub/GitLab repo, source code, or a deployable self-hosted tool / MCP / Agent / Docker project release or recommendation. Pure tech news (no repo/source release) must not be tagged opensource.",
  "4. news (top news): only authoritative news outlets (CCTV, China News Service, BBC, Deutsche Welle, etc.) covering politics/policy, government announcements, international affairs, diplomatic summits, and major livelihood news. Consumer deal guides from deal sites / IT media / communities, e-commerce gossip, or gadget news must not be tagged news (tag deal or info instead).",
  "5. info (industry news): macro economy & finance, stock/fund/IPO/earnings market moves, big-tech / chip / AI frontier news, hardware reviews, and developer tech weeklies / in-depth guides.",
  "",
  "Noise with keep=false (also kind='noise') — only intercept what is truly worthless:",
  "- Help requests / questions / recommendation asks / carpool wants / pure buying requests (e.g. \"any coupons?\", \"recommend a cheap VPS\", \"want a ChatGPT carpool slot\", \"error 429 how to fix\")",
  "- Vague drop-shipping lead-gen, course selling, or disguised ads (especially titles that look free but require adding WeChat / DM / commenting \"1\" / following / rebate links / paid unlock)",
  "- Routine game patch notes with no highlight (e.g. \"fixed some crashes\") while the game still costs full price",
  "- Gossip / flame wars / pure musing or discussion posts (e.g. \"what do you think of freebies\") or vague promos with no actual claim path",
  "- Regular full-price promotions with no discount highlight",
  "",
  CATEGORY_PROMPT_LINE,
  CATEGORY_DESC_LINE,
  "Also judge the \"obtain\" mode, which must be one of:",
  "- free: claim it directly for free, no lottery / signup-gated payment",
  "- conditional: requires registration, real-name verification, forms, check-ins, replying, or new-user conditions",
  "- lottery: sweepstakes / random giveaway",
  "- trial: short commercial SaaS trial, stops unless paid after expiry",
  "- promo: purely a marketing hook",
  "- paid: requires actual payment (e.g. Black Friday VPS, record-low games, lifetime software)",
  "",
  "Also give a 1-5 quality score: 5 = extremely valuable (AAA game giveaway / insane Black Friday VPS / hit open-source project / large token giveaway / major headline), 4 = clearly good (new :free model / high-value yearly VPS / useful open-source tool / important finance or tech news), 3 = average or conditional, 2 = heavy restrictions / marginal, 1 = noise.",
  'Return a JSON array, elements like {"index":0,"keep":true,"kind":"deal","category":"vps","obtain":"paid","quality":5,"reason":"Black Friday $10.99/yr KVM VPS"}.',
  "Write reason as ONE short English sentence (max 90 characters) explaining the highlight or rejection reason, with no extra text.",
].join("\n");

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: Boolean(config.aiBaseUrl && config.aiModel),
  baseUrl: config.aiBaseUrl,
  apiKey: config.aiApiKey,
  model: config.aiModel,
  maxItems: Math.min(Math.max(config.aiMaxItems, 20), 500),
  batchSize: 6,
  concurrency: 4,
  timeoutSec: 15,
  preFilterEnabled: true,
  customNoiseKeywords: [],
  skipFreebieSources: false,
  sourceMode: "all",
  sourceIds: [],
  extraPrompt: "",
  systemPrompt: "",
  learnFromFeedback: true,
  feedbackLimit: 6,
  aiDedupEnabled: true,
  aiDedupWindowHours: 48,
  translateEnabled: true,
  translatePerRun: 24,
  translateModel: "@cf/meta/llama-3.1-8b-instruct-fp8",
};

function numOr(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

function normalizeStringList(v: unknown, maxLen = 40, maxCount = 80): string[] {
  if (!Array.isArray(v)) return [];
  return [
    ...new Set(
      v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, maxLen))
        .filter(Boolean),
    ),
  ].slice(0, maxCount);
}

function normalizeSourceMode(v: unknown): AiSourceMode {
  return v === "exclude" || v === "only" ? v : "all";
}

function normalizeSettings(raw: Partial<AiSettings>, base: AiSettings): AiSettings {
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled,
    baseUrl: typeof raw.baseUrl === "string" ? raw.baseUrl.trim() : base.baseUrl,
    apiKey:
      typeof raw.apiKey === "string" && raw.apiKey.trim() && !raw.apiKey.startsWith("••••")
        ? raw.apiKey.trim()
        : base.apiKey,
    model: typeof raw.model === "string" ? raw.model.trim() : base.model,
    maxItems: numOr(raw.maxItems, base.maxItems, 20, 500),
    batchSize: numOr(raw.batchSize, base.batchSize, 2, 20),
    concurrency: numOr(raw.concurrency, base.concurrency, 1, 8),
    timeoutSec: numOr(raw.timeoutSec, base.timeoutSec, 5, 60),
    preFilterEnabled: typeof raw.preFilterEnabled === "boolean" ? raw.preFilterEnabled : base.preFilterEnabled,
    customNoiseKeywords: "customNoiseKeywords" in raw ? normalizeStringList(raw.customNoiseKeywords) : base.customNoiseKeywords,
    skipFreebieSources: typeof raw.skipFreebieSources === "boolean" ? raw.skipFreebieSources : base.skipFreebieSources,
    sourceMode: "sourceMode" in raw ? normalizeSourceMode(raw.sourceMode) : base.sourceMode,
    sourceIds: "sourceIds" in raw ? normalizeStringList(raw.sourceIds, 60, 200) : base.sourceIds,
    extraPrompt: typeof raw.extraPrompt === "string" ? raw.extraPrompt : base.extraPrompt,
    systemPrompt: typeof raw.systemPrompt === "string" ? raw.systemPrompt : base.systemPrompt,
    learnFromFeedback: typeof raw.learnFromFeedback === "boolean" ? raw.learnFromFeedback : base.learnFromFeedback,
    feedbackLimit: numOr(raw.feedbackLimit, base.feedbackLimit, 1, 15),
    aiDedupEnabled: typeof raw.aiDedupEnabled === "boolean" ? raw.aiDedupEnabled : base.aiDedupEnabled,
    aiDedupWindowHours: numOr(raw.aiDedupWindowHours, base.aiDedupWindowHours, 6, 168),
    translateEnabled: typeof raw.translateEnabled === "boolean" ? raw.translateEnabled : base.translateEnabled,
    translatePerRun: numOr(raw.translatePerRun, base.translatePerRun, 0, 120),
    translateModel: typeof raw.translateModel === "string" ? raw.translateModel.trim() : base.translateModel,
  };
}

export function getAiSettings(): AiSettings {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", SETTINGS_KEY);
  if (!row) return { ...DEFAULT_AI_SETTINGS };
  try {
    const raw = JSON.parse(row.value) as Partial<AiSettings>;
    return normalizeSettings(raw, DEFAULT_AI_SETTINGS);
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export function saveAiSettings(patch: Partial<AiSettings>): AiSettings {
  const cur = getAiSettings();
  const next = normalizeSettings(patch, cur);
  run(
    "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    SETTINGS_KEY,
    JSON.stringify(next),
    new Date().toISOString(),
  );
  return next;
}

/** 运行时是否真的能调 AI（开关开、端点与模型都有）。 */
export function aiReady(s = getAiSettings()): boolean {
  return s.enabled && Boolean(s.baseUrl && s.model);
}

/** 是否命中入口噪音初筛（求助/问价/版本更新补丁 + 用户自定义噪音词）。 */
export function matchesEntryNoise(title: string, s = getAiSettings()): boolean {
  if (!s.preFilterEnabled) return false;
  if (NOISE_TITLE.test(title)) return true;
  if (s.customNoiseKeywords.length) {
    const lower = title.toLowerCase();
    if (s.customNoiseKeywords.some((kw) => lower.includes(kw.toLowerCase()))) return true;
  }
  return false;
}

/** 该数据源是否需要送入 AI 审核。返回 false 且非噪音时，纯白嫖源可视作自动通过。 */
export function shouldPassSourceToAi(sourceId: string, s = getAiSettings()): boolean {
  if (s.skipFreebieSources && FREEBIE_ONLY_SOURCES.has(sourceId)) return false;
  if (s.sourceMode === "exclude" && s.sourceIds.includes(sourceId)) return false;
  if (s.sourceMode === "only" && !s.sourceIds.includes(sourceId)) return false;
  return true;
}

export function feedbackStats(limit = 6): {
  positive: number;
  negative: number;
  positiveSamples: string[];
  negativeSamples: string[];
} {
  const n = Math.min(Math.max(Math.round(limit), 1), 15);
  try {
    const pos = get<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE starred = 1")?.n ?? 0;
    const neg = get<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE status = 'ignored'")?.n ?? 0;
    const positiveSamples = all<{ title: string }>(
      "SELECT title FROM items WHERE starred = 1 ORDER BY last_seen_at DESC LIMIT ?",
      n,
    ).map((r) => r.title.slice(0, 80));
    const negativeSamples = all<{ title: string }>(
      "SELECT title FROM items WHERE status = 'ignored' ORDER BY last_seen_at DESC LIMIT ?",
      n,
    ).map((r) => r.title.slice(0, 80));
    return { positive: pos, negative: neg, positiveSamples, negativeSamples };
  } catch {
    return { positive: 0, negative: 0, positiveSamples: [], negativeSamples: [] };
  }
}

/** 给前端的安全视图：密钥打码。 */
export function publicAiSettings(s = getAiSettings()) {
  return {
    apiKey: "",
    enabled: s.enabled,
    baseUrl: s.baseUrl,
    model: s.model,
    maxItems: s.maxItems,
    batchSize: s.batchSize,
    concurrency: s.concurrency,
    timeoutSec: s.timeoutSec,
    preFilterEnabled: s.preFilterEnabled,
    customNoiseKeywords: s.customNoiseKeywords,
    skipFreebieSources: s.skipFreebieSources,
    sourceMode: s.sourceMode,
    sourceIds: s.sourceIds,
    extraPrompt: s.extraPrompt,
    systemPrompt: s.systemPrompt,
    learnFromFeedback: s.learnFromFeedback,
    feedbackLimit: s.feedbackLimit,
    aiDedupEnabled: s.aiDedupEnabled,
    aiDedupWindowHours: s.aiDedupWindowHours,
    translateEnabled: s.translateEnabled,
    translatePerRun: s.translatePerRun,
    translateModel: s.translateModel,
    hasKey: Boolean(s.apiKey),
    keyHint: s.apiKey ? "••••" + s.apiKey.slice(-4) : "",
    ready: aiReady(s),
    promptIsDefault: !s.systemPrompt.trim(),
    defaultPrompt: DEFAULT_PROMPT,
  };
}

function buildSystemPrompt(s: AiSettings): string {
  const parts: string[] = [s.systemPrompt.trim() || DEFAULT_PROMPT];
  if (s.extraPrompt.trim()) {
    parts.push("", "补充审核规则（务必优先遵守）：", s.extraPrompt.trim());
  }
  if (!s.learnFromFeedback) return parts.join("\n");
  try {
    const fb = feedbackStats(s.feedbackLimit);
    if (!fb.positiveSamples.length && !fb.negativeSamples.length) return parts.join("\n");
    parts.push("", "以下来自用户近期真实操作（优先贴合这些偏好）：");
    if (fb.positiveSamples.length) {
      parts.push("用户收藏的正样本（类似应判 keep=true）：" + fb.positiveSamples.map((t) => `「${t}」`).join("、"));
    }
    if (fb.negativeSamples.length) {
      parts.push("用户手动关闭的负样本（类似应判 keep=false）：" + fb.negativeSamples.map((t) => `「${t}」`).join("、"));
    }
  } catch {
    /* ignore */
  }
  return parts.join("\n");
}

type CallResult = { map: Map<number, AiVerdict>; ttfbMs: number };

async function callOnce(
  payload: { index: number; title: string; summary: string }[],
  s: AiSettings,
): Promise<CallResult> {
  const endpoint = s.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  const timeoutMs = s.timeoutSec * 1000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = Date.now();
  const tag = `[ai] batch n=${payload.length} idx=${payload[0]?.index ?? "-"}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(s.apiKey ? { authorization: "Bearer " + s.apiKey } : {}),
      },
      body: JSON.stringify({
        model: s.model,
        temperature: 0,
        messages: [
          { role: "system", content: buildSystemPrompt(s) },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
      signal: ac.signal,
    });
    const ttfb = Date.now() - t0;
    if (!res.ok) throw new Error("AI HTTP " + res.status + " " + (await res.text()).slice(0, 120));
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    console.log(`${tag} 完成 ${Date.now() - t0}ms（响应头 ${ttfb}ms）`);
    const content = data.choices?.[0]?.message?.content ?? "";
    const jsonText = /\[[\s\S]*\]/.exec(content)?.[0];
    if (!jsonText) throw new Error("AI 未返回 JSON 数组");
    const arr = JSON.parse(jsonText) as AiVerdict[];
    const map = new Map<number, AiVerdict>();
    for (const v of arr) {
      if (typeof v?.index === "number") map.set(v.index, v);
    }
    return { map, ttfbMs: ttfb };
  } finally {
    clearTimeout(timer);
  }
}

export type ReviewBatchEvent = {
  start: number;
  count: number;
  items: RawItem[];
  verdicts: Map<number, AiVerdict> | null;
  ttfbMs: number | null;
  error?: string;
};

function aiSummaryExcerpt(it: { summary?: string | null; content?: string | null }): string {
  const raw = (it.content || it.summary || "").replace(/\s+/g, " ").trim();
  if (raw.length <= 420) return raw;
  return `${raw.slice(0, 240)} … ${raw.slice(-170)}`;
}

/**
 * 送审并返回 index → verdict 的映射。未启用或全部失败返回 null。
 * 条目多于 maxItems 时按 maxItems 截断送审，按 batchSize / concurrency 并发执行。
 */
export async function reviewItems(
  items: RawItem[],
  settings?: AiSettings,
  hooks?: { onBatch?: (ev: ReviewBatchEvent) => void },
): Promise<Map<number, AiVerdict> | null> {
  const s = settings ?? getAiSettings();
  if (!aiReady(s) || !items.length) return null;

  const total = Math.min(items.length, s.maxItems);
  const merged = new Map<number, AiVerdict>();
  let ok = 0;

  type Job = { start: number; chunk: RawItem[]; payload: { index: number; title: string; summary: string }[] };
  const jobs: Job[] = [];
  for (let start = 0; start < total; start += s.batchSize) {
    const chunk = items.slice(start, Math.min(start + s.batchSize, total));
    jobs.push({
      start,
      chunk,
      payload: chunk.map((it, i) => ({
        index: start + i,
        title: (it.title ?? "").slice(0, 140),
        summary: aiSummaryExcerpt(it),
      })),
    });
  }

  const runJob = async (job: Job): Promise<CallResult | null> => {
    let lastErr: string | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await callOnce(job.payload, s);
        hooks?.onBatch?.({
          start: job.start,
          count: job.chunk.length,
          items: job.chunk,
          verdicts: res.map,
          ttfbMs: res.ttfbMs,
        });
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastErr = msg;
        if (attempt === 0) {
          console.log(`[ai] 重试 n=${job.payload.length} idx=${job.start}：${msg.slice(0, 60)}`);
          continue;
        }
        console.log(`[ai] 放弃 n=${job.payload.length} idx=${job.start}：${msg.slice(0, 60)}`);
      }
    }
    hooks?.onBatch?.({
      start: job.start,
      count: job.chunk.length,
      items: job.chunk,
      verdicts: null,
      ttfbMs: null,
      error: lastErr,
    });
    return null;
  };

  for (let i = 0; i < jobs.length; i += s.concurrency) {
    const wave = jobs.slice(i, i + s.concurrency);
    const results = await Promise.all(wave.map(runJob));
    for (const res of results) {
      if (!res) continue;
      for (const [k, v] of res.map) merged.set(k, v);
      ok += 1;
    }
  }

  return ok > 0 ? merged : null;
}

/** 连通性测试：支持传入表单草稿直接测试（无需先保存），返回完整判定维度与耗时。 */
export async function testAiConnection(draft?: Partial<AiSettings>): Promise<{
  ok: boolean;
  ms: number;
  model: string;
  results: { title: string; keep: boolean; kind: string; category: string; obtain: string; quality: number | null; reason: string }[];
  error?: string;
}> {
  const cur = getAiSettings();
  const s: AiSettings = {
    ...normalizeSettings(draft ?? {}, cur),
    enabled: true, // 测试接口允许在开启总开关前先验证连通性
  };
  if (!s.baseUrl || !s.model) {
    return { ok: false, ms: 0, model: s.model, results: [], error: "请先填写 API 端点与模型名" };
  }

  const samples: RawItem[] = [
    { externalId: "t1", url: "https://example.com/1", title: "【福利】送 5 个 500M 动态IP测试，先到先得", summary: "回复即可" },
    { externalId: "t2", url: "https://example.com/2", title: "[黑五特惠] RackNerd 2核2G KVM VPS 年付 $10.99", summary: "黑五促销" },
    { externalId: "t3", url: "https://example.com/3", title: "开源自托管轻量状态监控面板 v2.1 发布 (Docker/MIT)", summary: "GitHub 开源" },
    { externalId: "t4", url: "https://example.com/4", title: "谁有 ovh 年付 10% 优惠券哇", summary: "求优惠券" },
  ] as RawItem[];

  const t0 = Date.now();
  const jobId = startAiJob({
    stage: "test",
    label: "草稿配置连通测试",
    model: s.model,
    total: samples.length,
    totalBatches: Math.ceil(samples.length / s.batchSize),
  });
  try {
    const map = await reviewItems(samples, s, {
      onBatch: (ev) => {
        let kept = 0;
        let rejected = 0;
        const events = [];
        for (let i = 0; i < ev.items.length; i += 1) {
          const v = ev.verdicts?.get(ev.start + i);
          if (!v) continue;
          const keep = Boolean(v.keep);
          if (keep) kept += 1;
          else rejected += 1;
          events.push({
            title: ev.items[i]!.title,
            keep,
            kind: isContentKind(v.kind) ? v.kind : keep ? "freebie" : "noise",
            category: v.category ?? "-",
            quality: typeof v.quality === "number" ? v.quality : null,
            reason: v.reason ?? "",
            at: new Date().toISOString(),
          });
        }
        recordAiBatch(jobId, {
          events,
          kept,
          rejected,
          failed: ev.verdicts ? 0 : ev.count,
          ttfbMs: ev.ttfbMs,
        });
      },
    });
    const ms = Date.now() - t0;
    if (!map) {
      finishAiJob(jobId, { error: "模型未返回有效结论" });
      return { ok: false, ms, model: s.model, results: [], error: "模型未返回有效结论（请检查端点/Key/模型名或超时设置）" };
    }
    finishAiJob(jobId);
    return {
      ok: true,
      ms,
      model: s.model,
      results: samples.map((it, i) => {
        const v = map.get(i);
        const keep = v?.keep ?? false;
        const kind = isContentKind(v?.kind) ? v.kind : keep ? "freebie" : "noise";
        return {
          title: it.title,
          keep,
          kind,
          category: v?.category ?? "-",
          obtain: v?.obtain ?? "-",
          quality: typeof v?.quality === "number" ? v.quality : null,
          reason: v?.reason ?? "（无结论）",
        };
      }),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    finishAiJob(jobId, { error: msg });
    return {
      ok: false,
      ms: Date.now() - t0,
      model: s.model,
      results: [],
      error: msg,
    };
  }
}

export { DEFAULT_PROMPT };
