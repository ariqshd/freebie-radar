import type { Collector, RawItem } from "./types.ts";

/**
 * freetokeep.gg —— 全平台「免费领取」聚合（Steam / Epic / GOG / Prime / Ubisoft / Stove / itch / Humble / Fanatical）。
 *
 * 用 JSON API 而非 RSS：返回结构化字段（store / 原价 / 上线时间 / 结束时间），
 * 比逐个商店抓 RSS 更完整，且一次性覆盖所有平台。
 *
 * 免额度、无需 key、CORS 已开。
 */
const STORE_LABEL: Record<string, string> = {
  steam: "Steam",
  epic: "Epic Games",
  "epic-pc": "Epic Games (PC)",
  "epic-android": "Epic Games (Android)",
  "epic-ios": "Epic Games (iOS)",
  gog: "GOG",
  prime: "Prime Gaming",
  ubisoft: "Ubisoft",
  stove: "Stove",
  itch: "itch.io",
  freetokeep: "Free To Keep",
};

export const freetokeepCollector: Collector = {
  kind: "freetokeep",
  label: "Free To Keep · 全平台免费领",
  defaults: {
    config: {
      stores: ["steam", "epic", "gog", "prime", "ubisoft", "stove", "itch", "freetokeep"],
      limit: 40,
    },
  },
  async collect(ctx) {
    const stores = (ctx.config.stores as string[] | undefined) ?? [
      "steam", "epic", "gog", "prime", "ubisoft", "stove", "itch", "freetokeep",
    ];
    const limit = Math.min(Math.max(Number(ctx.config.limit ?? 40), 1), 200);
    const items: RawItem[] = [];
    const seen = new Set<string>();

    for (const store of stores) {
      if (items.length >= limit) break;
      try {
        const res = await ctx.http.json<{
          generatedAt?: string;
          count?: number;
          items?: Array<{
            id?: string;
            title?: string;
            store?: string;
            storeLabel?: string;
            url?: string;
            imageUrl?: string;
            originalPrice?: string;
            startsAt?: string | null;
            endsAt?: string | null;
            tags?: string[];
            publishedAt?: string;
          }>;
        }>(`https://freetokeep.gg/api/v1/offers?store=${encodeURIComponent(store)}&limit=${limit}`);
        if (res.status !== 200) throw new Error(`freetokeep HTTP ${res.status}`);
        for (const it of res.data.items ?? []) {
          if (!it?.id || !it?.title) continue;
          const key = `${store}:${it.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const label = it.storeLabel ?? STORE_LABEL[store] ?? store;
          const price = it.originalPrice ? `（原价 ${it.originalPrice}）` : "";
          items.push({
            externalId: key,
            url: it.url || `https://freetokeep.gg/`,
            title: `${label} 免费领：${it.title}`,
            summary:
              [price, it.endsAt ? `截止 ${it.endsAt}` : null]
                .filter(Boolean)
                .join(" · ") || "免费领取，限时",
            author: label,
            publishedAt: it.publishedAt ?? it.startsAt ?? null,
            expiresAt: it.endsAt ?? null,
            tags: ["free", "game", store, ...(it.tags ?? [])],
            categoryHint: "game",
            imageUrl: it.imageUrl ?? null,
            raw: { store, id: it.id, originalPrice: it.originalPrice },
          });
        }
      } catch (err) {
        ctx.log(`freetokeep ${store} 失败: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    ctx.log(`freetokeep fetched=${items.length}`);
    return { items: items.slice(0, limit), cursor: null };
  },
};