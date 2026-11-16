/**
 * Single source of truth for categories / content kinds / obtain modes / channels (presets).
 *
 * These definitions used to be duplicated in 5 places (enrich rules, push whitelist validation,
 * AI prompts, frontend label tables, source-ops dropdowns); adding a category meant hand-syncing
 * all of them and missing one caused drift. Server and frontend both import from here now.
 */

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */

export const CATEGORY_KEYS = [
  "ai",
  "cloud",
  "vps",
  "domain",
  "opensource",
  "software",
  "dev",
  "design",
  "security",
  "hardware",
  "media",
  "game",
  "carpool",
  "trade",
  "headline",
  "world",
  "finance",
  "stock",
  "tech",
  "news",
  "goods",
  "offline",
  "invite",
  "edu",
  "pan",
  "course",
  "other",
] as const;

export type Category = (typeof CATEGORY_KEYS)[number];

const CATEGORY_LABEL_BY_KEY = {
  ai: "AI Credits",
  cloud: "Cloud Services",
  vps: "VPS / Servers",
  domain: "Domains / Web Hosting",
  opensource: "Open Source",
  software: "Software Licenses",
  dev: "Dev / Engineering",
  design: "Design / Assets",
  security: "Security / Network",
  hardware: "Hardware / Gadgets",
  media: "Media / Streaming",
  game: "Games",
  carpool: "Carpool / Sharing",
  trade: "Secondhand / Trade",
  headline: "Top News",
  world: "World News",
  finance: "Economy / Business",
  stock: "Stocks / Markets",
  tech: "Tech News",
  news: "General News",
  goods: "Goods / Deals",
  offline: "In-person Freebies",
  invite: "Invite Codes",
  edu: "Education / Exams",
  pan: "Cloud Drive Files",
  course: "Courses / Tutorials",
  other: "Other",
} satisfies Record<Category, string>;

/** Loose index type for external callers: the value may be any string (from DB / AI). */
export const CATEGORY_LABEL: Record<string, string> = CATEGORY_LABEL_BY_KEY;

/** One-line explanation of what each category collects, for dropdowns / tooltips. */
export const CATEGORY_DESC: Record<Category, string> = {
  ai: "LLM credits / tokens / compute / API trials",
  cloud: "Cloud services beyond VMs: object storage / CDN / DB / proxy traffic",
  vps: "Dedicated servers / VPS / bare metal / home broadband",
  domain: "Domains / SSL / DNS / web hosting / site building",
  opensource: "GitHub & GitLab repos and self-hostable projects",
  software: "Licensed software / activation keys / free & buy-once apps",
  dev: "Frameworks / CLI / SDK / plugins / deployment guides",
  design: "Fonts / icons / UI templates / assets / presets",
  security: "Vulnerabilities / VPN / privacy & security tools",
  hardware: "Hardware / routers / NAS / gadgets",
  media: "Streaming memberships / shows / music / anime",
  game: "Free game keys / historical lows / game bundles",
  carpool: "Legit carpooling / shared plans / family slots",
  trade: "Secondhand servers / account & device transfers",
  headline: "Domestic politics / policy / livelihood news",
  world: "International affairs / diplomacy / overseas news",
  finance: "Macro economy / earnings / funding & M&A / currency",
  stock: "A-shares / HK / US stocks / ETF / IPO",
  tech: "Tech frontier / chips / internet / space & energy",
  news: "General news and other updates",
  goods: "Everyday freebies / coupons / phone credit / physical goods",
  offline: "In-person events / stores / pop-ups / physical giveaways (must be claimable on site; pure news, spot checks, or roommate hunting do not count)",
  invite: "Invite codes / open registration / beta access",
  edu: "Question banks / past papers / textbooks / ebooks / exam prep",
  pan: "Quark / Aliyun / Baidu netdisk shares and reposts",
  course: "Open courses / bootcamps / video courses / lecture notes",
  other: "Fallback category",
};

/** Top-level groups: the frontend dropdowns and the push whitelist use the same grouping. */
export type CategoryGroupKey = "freebie" | "tech" | "content" | "news" | "other";

export const CATEGORY_GROUPS: { key: CategoryGroupKey; label: string; categories: Category[] }[] = [
  {
    key: "freebie",
    label: "Freebies & Deals",
    categories: ["ai", "cloud", "vps", "domain", "software", "media", "game", "carpool", "trade", "goods", "offline", "invite"],
  },
  {
    key: "tech",
    label: "Tech & Tools",
    categories: ["opensource", "dev", "design", "security", "hardware"],
  },
  {
    key: "content",
    label: "Content & Learning",
    categories: ["pan", "course", "edu"],
  },
  {
    key: "news",
    label: "News & Information",
    categories: ["headline", "world", "finance", "stock", "tech", "news"],
  },
  {
    key: "other",
    label: "Other",
    categories: ["other"],
  },
];

export const CATEGORY_SET: ReadonlySet<string> = new Set<string>(CATEGORY_KEYS);

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function categoryLabel(category: string | null | undefined): string {
  const key = (category ?? "other") as Category;
  return CATEGORY_LABEL[key] ?? category ?? "Other";
}

/** Column names in news/info contexts (so tech news does not show as "AI Credits"). */
export const NEWS_CATEGORY_LABEL: Record<string, string> = {
  headline: "Top News",
  world: "World News",
  finance: "Economy / Business",
  stock: "Stocks / Markets",
  tech: "Tech Frontier",
  ai: "AI Frontier",
  dev: "Development",
  opensource: "Open Source",
  security: "Security",
  cloud: "Cloud / Architecture",
  vps: "Hosting / Network",
  hardware: "Hardware",
  software: "Software / Apps",
  game: "Gaming",
  design: "Design / UX",
  edu: "Education",
  pan: "Cloud Drives",
  course: "Courses",
  news: "General News",
  other: "Other News",
};

/* ------------------------------------------------------------------ *
 * Channels (homepage presets)
 * ------------------------------------------------------------------ */

/** Categories in the verified/all-freebies channels: cloud drives, courses, and in-person have their own channels */
export const FREEBIE_CATEGORY_KEYS: Category[] = [
  "ai", "software", "game", "cloud", "vps", "domain", "media", "design", "dev", "edu", "goods", "invite", "opensource", "security", "hardware", "other",
];

/**
 * A channel = one of the big homepage tabs; its category whitelist doubles as the default set,
 * and push rules can apply it in one click. Categories in `exclude` are removed from the channel
 * even if listed in `categories` (homepage query and category pills both honor it).
 */
export const CHANNELS: { key: string; label: string; categories: Category[]; exclude?: Category[] }[] = [
  { key: "verified", label: "Verified Freebies", categories: FREEBIE_CATEGORY_KEYS, exclude: ["pan", "course", "offline"] },
  { key: "free", label: "All Freebies", categories: FREEBIE_CATEGORY_KEYS },
  { key: "offline", label: "In-person Freebies", categories: ["offline"] },
  { key: "pan", label: "Cloud Drives / Courses", categories: ["pan", "course"] },
  { key: "deal", label: "Deals", categories: ["vps", "carpool", "trade", "game", "software", "cloud", "domain", "ai", "media", "pan", "course", "hardware", "goods", "design", "dev", "security", "edu", "other"] },
  { key: "opensource", label: "Open Source", categories: ["ai", "dev", "opensource", "security", "cloud", "vps", "software", "tech", "design", "hardware", "course", "edu", "other"] },
  { key: "news", label: "Top News", categories: ["headline", "world", "finance", "tech", "stock", "news", "security", "other"] },
  { key: "info", label: "Industry News", categories: ["finance", "stock", "tech", "ai", "dev", "hardware", "security", "cloud", "software", "game", "opensource", "design", "course", "edu", "news", "other"] },
];

/** Categories a channel excludes (the homepage query uses it to build excludeCategory). */
export function channelExcluded(preset: string): Category[] {
  return CHANNELS.find((c) => c.key === preset)?.exclude ?? [];
}

/** Unknown preset (codes / urgent / starred) returns all categories. */
export function categoriesForPreset(preset: string): string[] {
  const channel = CHANNELS.find((c) => c.key === preset);
  if (!channel) return [...CATEGORY_KEYS];
  const excluded = new Set<string>(channel.exclude ?? []);
  return channel.categories.filter((key) => !excluded.has(key));
}
export function categoryLabelForPreset(category: string, preset: string): string {
  if (preset === "news" || preset === "info") {
    return NEWS_CATEGORY_LABEL[category] ?? categoryLabel(category);
  }
  return categoryLabel(category);
}

export function categoryLabelForKind(
  category: string | null | undefined,
  kind: string | null | undefined,
): string {
  const key = category || "other";
  if (kind === "news" || kind === "info") {
    return NEWS_CATEGORY_LABEL[key] ?? categoryLabel(key);
  }
  return categoryLabel(key);
}

/* ------------------------------------------------------------------ *
 * Content kinds
 * ------------------------------------------------------------------ */

export const CONTENT_KIND_KEYS = ["freebie", "deal", "opensource", "news", "info", "noise"] as const;

export type ContentKind = (typeof CONTENT_KIND_KEYS)[number];

const KIND_LABEL_BY_KEY = {
  freebie: "Freebie",
  deal: "Deal",
  opensource: "Open Source",
  news: "Top News",
  info: "Industry News",
  noise: "Noise",
} satisfies Record<ContentKind, string>;

export const KIND_LABEL: Record<string, string> = KIND_LABEL_BY_KEY;

/** Kinds that can be assigned / filtered (noise is a rejection result, not a filter option). */
export const KIND_ORDER = ["freebie", "deal", "opensource", "news", "info"] as const;

export const KIND_SET: ReadonlySet<string> = new Set<string>(CONTENT_KIND_KEYS);

export function isContentKind(v: unknown): v is ContentKind {
  return typeof v === "string" && KIND_SET.has(v);
}

/* ------------------------------------------------------------------ *
 * Obtain modes
 * ------------------------------------------------------------------ */

export const OBTAIN_KEYS = ["free", "conditional", "lottery", "trial", "promo", "paid"] as const;

export type ObtainMode = (typeof OBTAIN_KEYS)[number];

const OBTAIN_LABEL_BY_KEY = {
  free: "Free",
  conditional: "Conditional",
  lottery: "Giveaway",
  trial: "Trial",
  promo: "Promo",
  paid: "Paid",
} satisfies Record<ObtainMode, string>;

export const OBTAIN_LABEL: Record<string, string> = OBTAIN_LABEL_BY_KEY;

const OBTAIN_HINT_BY_KEY = {
  free: "Claim instantly — no posts, invites, or draws needed",
  conditional: "Requires posting, following, inviting, or verifying",
  lottery: "Random draw — not guaranteed",
  trial: "Free for N days or the first month, then paid",
  promo: "Marketing hook for a paid service",
  paid: "Requires payment",
} satisfies Record<ObtainMode, string>;

export const OBTAIN_HINT: Record<string, string> = OBTAIN_HINT_BY_KEY;

export const OBTAIN_ORDER = ["free", "conditional", "lottery", "trial", "promo", "paid"] as const;

export const OBTAIN_SET: ReadonlySet<string> = new Set<string>(OBTAIN_KEYS);

export function isObtainMode(v: unknown): v is ObtainMode {
  return typeof v === "string" && OBTAIN_SET.has(v);
}

/* ------------------------------------------------------------------ *
 * Dropdown options (shared by source ops / push rules)
 * ------------------------------------------------------------------ */

/** Category options grouped by top-level group, for <optgroup> or multi-column panels. */
export function categoryOptionGroups(): { label: string; options: { value: Category; label: string; desc: string }[] }[] {
  return CATEGORY_GROUPS.map((g) => ({
    label: g.label,
    options: g.categories.map((key) => ({ value: key, label: CATEGORY_LABEL_BY_KEY[key], desc: CATEGORY_DESC[key] })),
  }));
}
