import { all, run } from "../db.ts";
import { aiReady, fallbackTarget, getAiSettings, postChat, type AiSettings, type ChatTarget } from "./ai-settings.ts";

/**
 * 中文内容英文翻译：
 * - 只翻译 AI 判 keep=true 的条目（省额度：噪音/被拦截的条目不翻）
 * - 复用 AI 引擎的 OpenAI 兼容端点（Cloudflare Workers AI 免费额度即可覆盖）
 * - 结果写入 title_en / summary_en，前端展示时优先用英文，原始中文保留（搜索/屏蔽/去重仍按原文）
 */

const BATCH_SIZE = 6;
const SUMMARY_MAX = 420;
const TITLE_MAX_OUT = 300;
const SUMMARY_MAX_OUT = 700;

const SYSTEM_PROMPT = [
  "You translate Chinese deal/freebie forum post titles and summaries into concise natural English.",
  "Rules: keep product names, brand names, model names, spec numbers, prices and currency symbols as-is (do not localize them);",
  "drop hashtag noise and forum filler; the translation must read like a short English deal headline.",
  'Return ONLY a JSON array like [{"index":0,"title":"...","summary":"..."}].',
  "If the input summary is empty or null, return summary as null. No extra text, no markdown.",
].join(" ");

type TranslateRow = { id: number; title: string; summary: string | null };

type Translation = { index?: number; title?: string; summary?: string | null };

const CJK = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

function detectZh(text: string): boolean {
  const cjk = (text.match(CJK) ?? []).length;
  if (cjk === 0) return false;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjk / Math.max(cjk + latin, 1) > 0.15;
}

function excerpt(raw: string | null): string | null {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length <= SUMMARY_MAX ? s : `${s.slice(0, SUMMARY_MAX * 0.7)} … ${s.slice(-60)}`;
}

async function callTranslate(
  payload: { index: number; title: string; summary: string | null }[],
  s: AiSettings,
): Promise<Map<number, Translation>> {
  const body = {
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ],
  };
  const primary: ChatTarget = { baseUrl: s.baseUrl, model: s.translateModel || s.model, apiKey: s.apiKey };
  const fb = fallbackTarget(s);
  const attempts: { label: string; target: ChatTarget }[] = [{ label: "primary", target: primary }];
  if (fb) attempts.push({ label: "fallback", target: fb });

  let lastErr: Error | undefined;
  for (const attempt of attempts) {
    try {
      const { content } = await postChat(body, attempt.target, Math.max(s.timeoutSec, 30) * 1000);
      const jsonText = /\[[\s\S]*\]/.exec(content)?.[0];
      if (!jsonText) throw new Error("translate: model did not return a JSON array");
      const arr = JSON.parse(jsonText) as Translation[];
      const map = new Map<number, Translation>();
      arr.forEach((t, i) => {
        if (t && typeof t.title === "string" && t.title.trim()) map.set(typeof t.index === "number" ? t.index : i, t);
      });
      if (!map.size) throw new Error("translate: empty result");
      if (attempt.label === "fallback") console.log("[translate] served by FALLBACK provider");
      return map;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.log(`[translate] ${attempt.label} 失败: ${lastErr.message.slice(0, 120)}`);
    }
  }
  throw lastErr ?? new Error("translate failed");
}

export type TranslateStats = { scanned: number; translated: number; failed: number };

/** 把 AI 判 keep 的中文条目翻译成英文；limit 缺省用设置里的 translatePerRun。 */
export async function translatePendingItems(limit?: number): Promise<TranslateStats> {
  const s = getAiSettings();
  if (!aiReady(s) || !s.translateEnabled) return { scanned: 0, translated: 0, failed: 0 };
  const max = Math.min(Math.max(Math.round(limit ?? s.translatePerRun), 1), 120);
  // 多取一些：英文标题在内存里过滤掉后再截断到 max
  const rows = all<TranslateRow>(
    `SELECT id, title, summary FROM items
      WHERE ai_keep = 1 AND title_en IS NULL AND status = 'active'
      ORDER BY last_seen_at DESC LIMIT ?`,
    max * 4,
  );
  const targets = rows.filter((r) => detectZh(r.title)).slice(0, max);
  if (!targets.length) return { scanned: rows.length, translated: 0, failed: 0 };

  let translated = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const payload = batch.map((r, idx) => ({ index: idx, title: r.title.slice(0, 160), summary: excerpt(r.summary) }));
    try {
      const map = await callTranslate(payload, s);
      let ok = 0;
      for (const [idx, t] of map) {
        const row = batch[idx];
        if (!row) continue;
        const title = (t.title ?? "").trim().slice(0, TITLE_MAX_OUT);
        if (!title) continue;
        const summary = (t.summary ?? "").trim().slice(0, SUMMARY_MAX_OUT) || null;
        run("UPDATE items SET title_en = ?, summary_en = ? WHERE id = ?", title, summary, row.id);
        ok += 1;
      }
      translated += ok;
      failed += batch.length - ok;
    } catch (err) {
      failed += batch.length;
      console.log("[translate] batch failed:", err instanceof Error ? err.message : String(err));
    }
  }
  if (translated) console.log(`[translate] ${translated} items translated to English (${failed} failed)`);
  return { scanned: rows.length, translated, failed };
}

/** 还有多少条 AI 已通过、待翻译的中文条目（给 API/CLI 展示）。 */
export function translatePendingCount(): number {
  return (
    all<{ title: string }>(
      `SELECT title FROM items WHERE ai_keep = 1 AND title_en IS NULL AND status = 'active' LIMIT 500`,
    ).filter((r) => detectZh(r.title)).length
  );
}
