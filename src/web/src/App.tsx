import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlignJustify,
  Bell,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  EyeOff,
  Lock,
  LayoutGrid,
  Loader2,
  Radar,
  RefreshCw,
  Search,
  ShieldBan,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  FolderOpen,
  Wrench,
  X,
  Zap,
  Code,
  CheckCheck,
  Flame,
  Newspaper,
  TrendingUp,
  MapPin,
  User,
  Globe2,
  Github,
  BookOpen,
  LogOut,
} from "lucide-react";
import { CompactRow, ItemCard, ItemDetailDrawer, QuickBlockModal } from "./components/ItemView.tsx";
import { AdminGate } from "./components/AdminGate.tsx";
import { getToken } from "./lib/auth.ts";
import {
  guestAddBlock,
  guestBatch,
  guestBlocks,
  guestPatch,
  importGuestToAccount,
  readGuest,
  useBootstrap,
  type GuestState,
} from "./lib/session.ts";
import { AuthModal } from "./components/AuthModal.tsx";
import { WelcomeModal } from "./components/WelcomeModal.tsx";
import { RssModal } from "./components/RssModal.tsx";
import { KIND_LABEL, KIND_ORDER, OBTAIN_HINT, OBTAIN_LABEL, SOURCE_GROUPS, categoriesForPreset, categoryLabelForPreset, channelExcluded, formatInterval, groupOfSource } from "./lib/sources.ts";

// Admin / 次要 Tab 的大面板按需加载: 首屏只发Feed真正要用的代码
const DigestPanel = lazy(async () => ({ default: (await import("./components/DigestPanel.tsx")).DigestPanel }));
const HotPanel = lazy(async () => ({ default: (await import("./components/HotPanel.tsx")).HotPanel }));
const RulesPanel = lazy(async () => ({ default: (await import("./components/RulesPanel.tsx")).RulesPanel }));
const PushPanel = lazy(async () => ({ default: (await import("./components/PushPanel.tsx")).PushPanel }));
const AiPanel = lazy(async () => ({ default: (await import("./components/AiPanel.tsx")).AiPanel }));
const OpsPanel = lazy(async () => ({ default: (await import("./components/OpsPanel.tsx")).OpsPanel }));
const SiteAdminPanel = lazy(async () => ({ default: (await import("./components/SiteAdminPanel.tsx")).SiteAdminPanel }));
const UserPushPanel = lazy(async () => ({ default: (await import("./components/UserPushPanel.tsx")).UserPushPanel }));
import type {
  BlockPreset,
  BlockRule,
  HotReport,
  HotScope,
  Item,
  PushLogItem,
  AiPayload,
  PushPayload,
  PushPreview,
  PushSettings,
  Run,
  Source,
  Stats,
  Subscription,
} from "./types.ts";

const SOURCE_LABEL: Record<string, string> = {
  "linuxdo-welfare": "LINUX DO · Freebies",
  "linuxdo-resource": "LINUX DO · Resources",
  "v2ex-free": "V2EX · Free Giveaways",
  "github-free-for-dev": "GitHub · free-for-dev",
  "rss-fuliba": "Fuliba",
  "rss-52pojie": "52pojie",
  "rss-smzdm": "SMZDM",
  "zhihu-search": "Zhihu · Freebie Search",
  "xhs-search": "Xiaohongshu · Freebie Search",
  "xiaoheihe-search": "Xiaoheihe · Freebie Search",
  "tg-channels": "Telegram Channels",
  gamerpower: "GamerPower · Free Games",
  "epic-free": "Epic Games · Free Games",
  "rss-reddit-freegames": "Reddit · FreeGameFindings",
  "rss-reddit-efreebies": "Reddit · eFreebies",
  "rss-reddit-gamedeals": "Reddit · GameDeals",
  "rss-slickdeals": "Slickdeals",
  "rss-heyitsfree": "HeyItsFree",
  "rss-keylol": "Keylol",
  "openrouter-free": "OpenRouter · New Free Models",
  "gamerpower-loot": "GamerPower · Free Loot & Keys",
  "rss-itch-free": "itch.io · 100% Off Games",
  "rss-freesteamkeys": "FreeSteamKeys · Steam Freebies",
  "rss-ghxi": "Ghxi · Free Software",
};

let SOURCE_NAMES: Record<string, string> = { ...SOURCE_LABEL };
const sourceName = (id: string) => SOURCE_NAMES[id] ?? SOURCE_LABEL[id] ?? id;

type Tab = "feed" | "hot" | "digest" | "me" | "rules" | "push" | "ai" | "ops";

function useApi<T>(url: string | null): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    setLoading(true);
    fetch(url, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return (await r.json()) as T;
      })
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(String(e));
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [url, nonce]);

  return { data, loading, error, reload };
}

function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="toast-enter fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-ink-800 bg-ink-950 px-3.5 py-2 text-[12.5px] font-medium text-white shadow-lg">
      <Check size={14} className="text-emerald-400" />
      {message}
    </div>
  );
}

type Preset = { key: string; label: string; icon: typeof Sparkles };

const PRIMARY_CHANNELS: Preset[] = [
  { key: "verified", label: "Verified Freebies", icon: Sparkles },
  { key: "pan", label: "Cloud Drives / Courses", icon: FolderOpen },
  { key: "offline", label: "In-person Freebies", icon: MapPin },
  { key: "deal", label: "Black Friday/Deals", icon: Flame },
  { key: "opensource", label: "Open Source", icon: Code },
  { key: "news", label: "Top News", icon: Newspaper },
  { key: "info", label: "Industry News", icon: TrendingUp },
];

const SECONDARY_VIEWS: Preset[] = [
  { key: "codes", label: "Has Codes", icon: Zap },
  { key: "urgent", label: "Ending Today", icon: Bell },
  { key: "starred", label: "Starred", icon: Check },
  { key: "all", label: "All Items", icon: AlignJustify },
  { key: "hidden", label: "Hidden", icon: EyeOff },
];

const PRESETS: Preset[] = [...PRIMARY_CHANNELS, ...SECONDARY_VIEWS];


// 主仓库地址: 顶栏 GitHub 图标跳这里
const REPO_URL = "https://github.com/ZiChuanLan/freebie-radar";
// 移动端顶栏图标按钮统一尺寸, 5 并排也不挤
const ICON_BTN =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-surface text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950";
// 公开区: 任何人不Log in就能看. 其余All归Admin. 
const PUBLIC_TABS = new Set<Tab>(["feed", "digest"]);
const ADMIN_TABS = new Set<Tab>(["rules", "push", "ai", "ops"]);

export function App() {
  const initialTab = (): Tab => {
    if (typeof location === "undefined") return "feed";
    const h = location.hash.replace("#", "");
    return h === "hot" || h === "digest" || h === "me" || h === "rules" || h === "push" || h === "ai" || h === "ops"
      ? (h as Tab)
      : "feed";
  };

  const [tab, setTab] = useState<Tab>(initialTab);
  const [detail, setDetail] = useState<Item | null>(null);
  const [quickBlock, setQuickBlock] = useState<Item | null>(null);
  // Merge组展开: 记录展开的items目 id and其同福利的其他来源
  const [relatedOpen, setRelatedOpen] = useState<number | null>(null);
  const [relatedMap, setRelatedMap] = useState<Record<number, (Item & { sourceName?: string })[]>>({});
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  // 展开Merge组时按需拉取其他来源报道 (同一 title_key 的兄弟items目)
  useEffect(() => {
    const id = relatedOpen;
    if (!id || relatedMap[id]) return;
    let alive = true;
    fetch(`/api/items/${id}/related`, { headers: { accept: "application/json" } })
      .then((r) => r.json())
      .then((d: { items?: (Item & { sourceName?: string })[] }) => {
        if (alive && Array.isArray(d.items)) setRelatedMap((m) => ({ ...m, [id]: d.items! }));
      })
      .catch(() => {
        if (alive) setRelatedMap((m) => ({ ...m, [id]: [] }));
      });
    return () => {
      alive = false;
    };
  }, [relatedOpen, relatedMap]);
  // 服务端是否EnableAdmin password (决定是否拦截Admin)
  const [authChecked, setAuthChecked] = useState(false);
  const [protectedMode, setProtectedMode] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(() => Boolean(getToken()));
  useEffect(() => {
    fetch("/api/auth/check")
      .then((r) => r.json())
      .then((j: { protected?: boolean }) => {
        const prot = Boolean(j.protected);
        setProtectedMode(prot);
        if (!prot) setAdminAuthed(true);
      })
      .catch(() => undefined)
      .finally(() => setAuthChecked(true));
  }, []);
  const adminReady = authChecked && (!protectedMode || adminAuthed);

  const boot = useBootstrap();
  const bootData = boot.data;
  const me = bootData?.user ?? null;
  const isPublicSite = bootData?.siteMode === "public";
  const [authOpen, setAuthOpen] = useState(false);
  const [authHash, setAuthHash] = useState<string | null>(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [rssOpen, setRssOpen] = useState(false);
  const [guest, setGuest] = useState<GuestState>(() => readGuest());

  // 公开站未Log in时, 人StatusAll落 localStorage; Log in后用 /api/me/* 云同步
  const guestMode = isPublicSite && !me;
  const syncGuest = useCallback(() => setGuest(readGuest()), []);

  // Welcome notice: 按 version 记一次, 站长改内容后自增版本号即可重新弹出
  useEffect(() => {
    if (!bootData?.onboarding?.enabled) return;
    const key = "radar_onboarding_seen_v" + bootData.onboarding.version;
    try {
      if (!localStorage.getItem(key)) setWelcomeOpen(true);
    } catch {
      /* 隐私模式下每次都会弹, 可以接受 */
    }
  }, [bootData?.onboarding?.enabled, bootData?.onboarding?.version]);

  // OAuth 回跳带 #invite-required / #login-* 时自动开Log in弹窗并显示对应错误
  useEffect(() => {
    const h = location.hash.replace("#", "");
    if (!h) return;
    if (h === "invite-required" || h.startsWith("login-") || h.startsWith("register-") || h === "invite-invalid") {
      setAuthHash(h);
      setAuthOpen(true);
    }
  }, []);

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    if (bootData?.onboarding) {
      try {
        localStorage.setItem("radar_onboarding_seen_v" + bootData.onboarding.version, "1");
      } catch {
        /* ignore */
      }
    }
  }, [bootData?.onboarding]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    boot.reload();
  }, [boot]);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [source, setSource] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement | null>(null);
  const [lang, setLang] = useState<"all" | "zh" | "en">("all");
  const [sort, setSort] = useState("newest");
  const [range, setRange] = useState("auto");
  const [priceCap, setPriceCap] = useState("auto");
  const [minScore, setMinScore] = useState("all");
  const [obtain, setObtain] = useState("auto");
  const [kindFilter, setKindFilter] = useState("auto");
  const [preset, setPreset] = useState("verified");
  const [viewMode, setViewMode] = useState<"compact" | "grid2" | "grid3">(() => {
    if (typeof localStorage === "undefined") return "compact";
    const saved = localStorage.getItem("radar_view_mode");
    return saved === "grid2" || saved === "grid3" || saved === "compact" ? saved : "compact";
  });
  const updateViewMode = useCallback((m: "compact" | "grid2" | "grid3") => {
    setViewMode(m);
    try {
      localStorage.setItem("radar_view_mode", m);
    } catch {
      /* ignore */
    }
  }, []);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showAllSources, setShowAllSources] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  /** 移动端: 顶部Filters面板 (含Quick views, SourcesandFiltersitems)展开态 */
  const [mobileFilterBar, setMobileFilterBar] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onSlash = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement | null)?.isContentEditable) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1900);
  }, []);

  const copyCode = useCallback(
    (code: string) => {
      void navigator.clipboard?.writeText(code);
      notify("Copied code " + code);
    },
    [notify],
  );

  useEffect(() => {
    if (typeof location === "undefined") return;
    if (tab === "feed") history.replaceState(null, "", location.pathname + location.search);
    else history.replaceState(null, "", "#" + tab);
  }, [tab]);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace("#", "");
      setTab(h === "hot" || h === "digest" || h === "rules" || h === "push" || h === "ai" || h === "ops" ? (h as Tab) : "feed");
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (typeof location === "undefined") return;
    const sp = new URLSearchParams(location.search);
    const site = sp.get("login_ok");
    if (!site) return;
    sp.delete("login_ok");
    const nextSearch = sp.toString();
    history.replaceState(null, "", location.pathname + (nextSearch ? "?" + nextSearch : "") + "#ops");
    setTab("ops");
    notify(`${site} login finished and public freebies were sent back (cookies stay local)`);
  }, [notify]);

  const [, bumpNames] = useState(0);
  useEffect(() => {
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d: { sources: { id: string; name: string }[] }) => {
        const m: Record<string, string> = { ...SOURCE_LABEL };
        for (const s of d.sources) if (s.name) m[s.id] = s.name;
        SOURCE_NAMES = m;
        bumpNames((n) => n + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!catOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [catOpen]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debounced) p.set("search", debounced);
    if (source) p.set("source", source);
    if (categories.length) p.set("category", categories.join(","));
    if (lang !== "all") p.set("lang", lang);
    if (sort) p.set("sort", sort);

    if (preset === "verified") {
      p.set("unexpired", "1");
      p.set("aiOnly", "1");
      if (kindFilter === "auto") p.set("kind", "freebie");
      if (obtain === "auto") p.set("obtain", "free,conditional");
      if (range === "auto") p.set("maxAgeDays", "7");
      // 网盘资源and网课教程属于长期资料型内容, 单独成频道, 不混进"Verified Freebies"
      const excludedCats = channelExcluded("verified");
      if (categories.length === 0 && excludedCats.length) p.set("excludeCategory", excludedCats.join(","));
    } else if (preset === "offline") {
      // In-person Freebies独立频道: 线下/门店/现场领取, 不混进Verified Freebies
      p.set("unexpired", "1");
      p.set("hideRejected", "1");
      if (categories.length === 0) p.set("category", "offline");
    } else if (preset === "pan") {
      p.set("unexpired", "1");
      if (kindFilter === "auto") p.set("kind", "freebie,deal,info");
      if (categories.length === 0) p.set("category", "pan,course");
      p.set("hideRejected", "1");
    } else if (preset === "deal") {
      p.set("unexpired", "1");
      if (kindFilter === "auto") p.set("kind", "deal");
      p.set("hideRejected", "1");
    } else if (preset === "opensource") {
      if (kindFilter === "auto") p.set("kind", "opensource");
      p.set("hideRejected", "1");
    } else if (preset === "news") {
      if (kindFilter === "auto") p.set("kind", "news");
      p.set("hideRejected", "1");
    } else if (preset === "info") {
      if (kindFilter === "auto") p.set("kind", "info");
      p.set("hideRejected", "1");
    } else if (preset === "codes") {
      p.set("unexpired", "1");
      p.set("hasCodes", "1");
    } else if (preset === "urgent") {
      p.set("expiring", "1");
    } else if (preset === "starred") {
      p.set("starred", "1");
    } else if (preset === "hidden") {
      p.set("status", "ignored");
    }
    if (preset === "all") p.set("hideRejected", "1");

    if (kindFilter !== "auto" && kindFilter !== "all") p.set("kind", kindFilter);

    if (priceCap === "free") p.set("freeOnly", "1");
    else if (priceCap !== "auto" && priceCap !== "all") p.set("maxPrice", priceCap);

    if (obtain !== "auto" && obtain !== "all" && obtain) p.set("obtain", obtain);
    if (minScore !== "all") p.set("minScore", minScore);
    if (unreadOnly) p.set("unread", "1");

    const DAYS: Record<string, number> = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 };
    const days = DAYS[range];
    if (days) p.set("since", new Date(Date.now() - days * 86_400_000).toISOString());
    p.set("limit", "100");
    return p.toString();
  }, [debounced, source, categories, lang, sort, range, priceCap, preset, kindFilter, obtain, minScore, unreadOnly]);

  const statsQuery = useMemo(() => {
    const p = new URLSearchParams(query);
    p.delete("category");
    p.delete("sort");
    p.delete("limit");
    return p.toString();
  }, [query]);

  const switchPreset = useCallback((nextKey: string) => {
    setPreset(nextKey);
    setKindFilter("auto");
    setObtain("auto");
    setPriceCap("auto");
    setCategories((cur) => {
      const allowed = new Set(categoriesForPreset(nextKey));
      return cur.filter((c) => allowed.has(c));
    });
  }, []);

  const activeFilterCount =
    [
      source,
      categories.length > 0,
      lang !== "all",
      debounced,
      minScore !== "all",
      unreadOnly,
      kindFilter !== "auto",
      priceCap !== "auto",
      obtain !== "auto",
      range !== "auto",
      sort !== "newest",
    ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setSource("");
    setCategories([]);
    setLang("all");
    setSearch("");
    setDebounced("");
    setMinScore("all");
    setUnreadOnly(false);
    setKindFilter("auto");
    setPriceCap("auto");
    setObtain("auto");
    setRange("auto");
    setSort("newest");
    setPreset("verified");
  }, []);
  const stats = useApi<Stats>(statsQuery ? `/api/stats?${statsQuery}` : "/api/stats");
  const items = useApi<{ total: number; items: Item[] }>(`/api/items?${query}`);
  // 公开站Log in用户读写的是自己的Subscriptions & Blocklistlist; 自建站andAdmin沿用Global接口
  const rulesBase = adminReady ? "/api" : isPublicSite && me ? "/api/me" : null;
  // Push Rules同样分两套: 站长改Global, Log in用户改自己的 (同一套面板, 只是接口不同)
  const pushBase = adminReady ? "/api/push" : isPublicSite && me ? "/api/me/push" : null;
  const subs = useApi<{ subscriptions: Subscription[] }>(rulesBase ? rulesBase + "/subscriptions" : null);
  const sources = useApi<{ sources: Source[] }>("/api/sources");
  const runs = useApi<{ runs: Run[] }>(adminReady ? "/api/runs?limit=40" : null);
  const blockRules = useApi<{ rules: BlockRule[]; totalBlocked: number; presets: BlockPreset[] }>(
    rulesBase ? rulesBase + "/block-rules" : null,
  );
  const digests = useApi<{ digests: { date: string; created_at: string; pushed_at: string | null; kind: string; count: number }[] }>(
    "/api/digests",
  );
  const [hotHours, setHotHours] = useState(24);
  const [hotScope, setHotScope] = useState<HotScope>("all");
  const hot = useApi<HotReport>(tab === "hot" ? `/api/hot?hours=${hotHours}&scope=${hotScope}` : null);
  // Admin接口只在就绪后请求, 避免公开区刷出一堆 401, 也避免无密码模式卡住加载
  const push = useApi<PushPayload>(pushBase);
  const ai = useApi<AiPayload>(adminReady && tab === "ai" ? "/api/ai" : null);
  const pushLogs = useApi<{ logs: PushLogItem[] }>(pushBase && tab === "push" ? pushBase + "/log?limit=40" : null);
  const [pushPreview, setPushPreview] = useState<PushPreview | null>(null);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const activeDate = pickedDate ?? digests.data?.digests?.[0]?.date ?? null;
  const digestDetail = useApi<{
    date: string;
    text: string;
    count: number;
    created_at: string;
    pushed_at: string | null;
    items: Item[];
  }>(activeDate && tab === "digest" ? "/api/digests/" + activeDate : null);

  const [blockedPreview, setBlockedPreview] = useState<Item[] | null>(null);

  const patch = useCallback(
    async (id: number, body: Record<string, unknown>) => {
      // 公开站未Log in: 只改本机 localStorage, 不发请求, 谁也不影响
      if (guestMode) {
        guestPatch(id, body as { starred?: boolean; read?: boolean; status?: string });
        syncGuest();
        if (detail && detail.id === id) {
          const next = readGuest();
          setDetail({
            ...detail,
            starred: next.starred.includes(id),
            read: next.read.includes(id),
          });
        }
        return;
      }
      const url = isPublicSite ? `/api/me/items/${id}` : `/api/items/${id}`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify(err.error ?? "Action failed");
        return;
      }
      items.reload();
      stats.reload();
      if (detail && detail.id === id) {
        const next = await fetch(`/api/items/${id}`).then((r) => r.json());
        setDetail(next as Item);
      }
    },
    [items, stats, detail, guestMode, isPublicSite, syncGuest, notify],
  );

  const addRule = useCallback(
    async (pattern: string, mode: "keyword" | "regex", scope: string) => {
      // 公开站: Log in用户写自己的规则, 访客写本机 localStorage
      if (guestMode) {
        guestAddBlock(pattern);
        syncGuest();
        notify("Blocked locally \"" + pattern + "\"");
        items.reload();
        return;
      }
      const ruleUrl = isPublicSite ? "/api/me/block-rules" : "/api/block-rules";
      const res = await fetch(ruleUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pattern, mode, scope }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        notify(err.error ?? "Failed to add");
        return;
      }
      notify("Blocked \"" + pattern + "\"");
      blockRules.reload();
      items.reload();
      stats.reload();
      setBlockedPreview(null);
      setRelatedMap({});
    },
    [blockRules, items, stats, notify, guestMode, isPublicSite, syncGuest],
  );

  const quickBlockAdd = useCallback(
    async (pattern: string, scope: string) => {
      await addRule(pattern, "keyword", scope);
    },
    [addRule],
  );

  const addSubscription = useCallback(
    async (kw: string) => {
      if (guestMode) {
        notify("Log in to subscribe to keywords (guest preferences stay local)");
        return;
      }
      await fetch(isPublicSite ? "/api/me/subscriptions" : "/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: kw }),
      });
      subs.reload();
      items.reload();
      notify("Subscribed \"" + kw + "\"");
    },
    [subs, items, notify, guestMode, isPublicSite],
  );

  const removeSubscription = useCallback(
    async (id: number) => {
      await fetch((isPublicSite ? "/api/me/subscriptions/" : "/api/subscriptions/") + id, { method: "DELETE" });
      subs.reload();
      items.reload();
    },
    [subs, items, isPublicSite],
  );

  const refreshAll = useCallback(() => {
    items.reload();
    stats.reload();
    sources.reload();
    runs.reload();
    blockRules.reload();
    setRelatedMap({});
  }, [items, stats, sources, runs, blockRules]);

  const markVisibleRead = useCallback(async () => {
    const unreadIds = (items.data?.items ?? []).filter((i) => !i.read).map((i) => i.id);
    if (!unreadIds.length) return;
    if (guestMode) {
      guestBatch(unreadIds, "read");
      syncGuest();
      notify(`Marked ${unreadIds.length} local items as read`);
      return;
    }
    await fetch(isPublicSite ? "/api/me/items/batch" : "/api/items/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: unreadIds, action: "read" }),
    });
    notify(`Marked ${unreadIds.length} items on this page as read`);
    items.reload();
    stats.reload();
  }, [items, stats, notify, guestMode, isPublicSite, syncGuest]);

// 访客本地隐藏 / starred / Readand本地Blocklist在客户端生效; Log in用户由服务端按 user_item_states 过滤
  const visible = (guestMode
    ? (items.data?.items ?? []).map((i) => ({
        ...i,
        starred: guest.starred.includes(i.id),
        read: guest.read.includes(i.id),
      }))
    : (items.data?.items ?? [])
  ).filter((i) => {
    if (!guestMode) return true;
    if (guest.hidden.includes(i.id)) return false;
    if (guestBlocks(i.title, i.summary, guest.blocked)) return false;
    return true;
  });
  const currentIndex = detail ? visible.findIndex((i) => i.id === detail.id) : -1;

  const enabledSources = (sources.data?.sources ?? []).filter((s) => s.enabled || showAllSources);
  const grouped = SOURCE_GROUPS.map((g) => ({
    ...g,
    sources: enabledSources.filter((s) => groupOfSource(s) === g.key),
  })).filter((g) => g.sources.length > 0);

  // 公开区显示"Feed / Today's Hot / Daily Digest", 其余 Tab 只有进Admin后才出现
  const tabs: { key: Tab | "admin"; label: string; icon: typeof Activity; badge?: number }[] = [
    { key: "feed", label: "Feed", icon: Activity },
    { key: "hot", label: "Today's Hot", icon: Flame },
    { key: "digest", label: "Daily Digest", icon: Radar },
    ...(me ? [{ key: "me" as Tab, label: "Me", icon: User }] : []),
    ...(!adminReady && me
      ? [
          { key: "rules" as Tab, label: "My Subscriptions & Blocklist", icon: ShieldBan, badge: stats.data?.totals.blockRules },
          { key: "push" as Tab, label: "My Push Rules", icon: Zap, badge: push.data?.stats.queued },
        ]
      : []),
    ...(adminReady
      ? [
          { key: "rules" as Tab, label: "Subscriptions & Blocklist", icon: ShieldBan, badge: stats.data?.totals.blockRules },
          { key: "push" as Tab, label: "Push Rules", icon: Zap, badge: push.data?.stats.queued },
          { key: "ai" as Tab, label: "AI Engine", icon: Bot },
          { key: "ops" as Tab, label: "Source Ops", icon: Wrench },
        ]
      : me
        ? []
        : [{ key: "admin" as const, label: "Admin", icon: Lock }]),
  ];

  const handleTab = (key: Tab | "admin") => {
    if (key === "admin") {
      setTab("admin" as Tab);
      return;
    }
    setTab(key);
  };


  const exportUrl = "/api/export?format=md&" + query.replace(/limit=\d+/, "limit=300");


  // 说明/RSS 入口: 桌面侧栏and移动端品牌行shared同一份按钮, 避免Copy两份标记
  const helpRssNode = (
    <>
      <button
        type="button"
        onClick={() => setWelcomeOpen(true)}
        className={ICON_BTN}
        title="About this site & tips"
      >
        <BookOpen size={14} />
      </button>
      <button
        type="button"
        onClick={() => setRssOpen(true)}
        className={ICON_BTN}
        title="RSS feed URLs"
      >
        <Globe2 size={14} />
      </button>
    </>
  );

  // 主仓库入口: GitHub 图标, 移动端品牌行and桌面侧栏都用它
  const githubNode = (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={ICON_BTN}
      title="Main repo · GitHub"
      aria-label="GitHub main repo"
    >
      <Github size={14} />
    </a>
  );

  // account态: 移动端放进导航行右侧, 桌面端留在侧栏第二行
  const accountNode = me ? (
    <div className="flex min-w-0 items-center gap-1">
      {me.avatarUrl ? (
        <img src={me.avatarUrl} alt="" className="h-6 w-6 shrink-0 rounded-full border border-ink-200" />
      ) : (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[10px] font-semibold text-ink-600">
          {(me.name ?? me.username).slice(0, 1).toUpperCase()}
        </span>
      )}
      <span
        className="hidden min-w-0 truncate text-[11.5px] font-medium text-ink-800 sm:inline"
        title={`${me.name ?? me.username} · LINUX DO trust level ${me.trustLevel}`}
      >
        {me.name ?? me.username}
      </span>
      <button
        type="button"
        onClick={() => void logout()}
        className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
        title="Log out"
      >
        <LogOut size={12} />
      </button>
    </div>
  ) : bootData?.loginEnabled ? (
    <button
      type="button"
      onClick={() => {
        setAuthHash(null);
        setAuthOpen(true);
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ink-950 px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-white hover:bg-brand-hover"
      title="Log in with LINUX DO"
    >
      <User size={12} /> Log in
    </button>
  ) : null;

  // Quick views + Sources树: 桌面在侧栏常驻, 移动端折进"Filters"面板里
  const sourcePanelNode = (
    <>
      <div className="pt-1">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="text-[11px] font-medium text-ink-400">Quick views</span>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline"
              title="Clear all filters"
            >
              <RotateCcw size={10} /> clear {activeFilterCount}
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {SECONDARY_VIEWS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => switchPreset(p.key)}
              className={
                "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors " +
                (preset === p.key
                  ? "bg-canvas-subtle font-semibold text-ink-950"
                  : "font-medium text-ink-600 hover:bg-canvas-subtle/60 hover:text-ink-950")
              }
            >
              <p.icon size={13} className={preset === p.key ? "text-accent" : "text-ink-400"} />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-ink-200 pt-3">
        <div className="mb-1.5 flex items-center justify-between px-2">
          <span className="text-[11px] font-medium text-ink-400">Sources</span>
          <button
            type="button"
            onClick={() => setShowAllSources((v) => !v)}
            className="text-[11px] text-ink-400 hover:text-ink-700"
          >
            {showAllSources ? "Hide disabled" : "Show all"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setSource("")}
          className={
            "mb-1 w-full rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " +
            (source === ""
              ? "bg-canvas-subtle font-semibold text-ink-950"
              : "font-medium text-ink-600 hover:bg-canvas-subtle/60")
          }
        >
          All sources
        </button>
        {grouped.map((g) => {
          const collapsed = collapsedGroups[g.key];
          const total = g.sources.reduce((n, s) => n + s.items, 0);
          return (
            <div key={g.key} className="mb-1">
              <button
                type="button"
                onClick={() => setCollapsedGroups((m) => ({ ...m, [g.key]: !m[g.key] }))}
                className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-ink-400 hover:text-ink-700"
              >
                {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                <span className="flex-1 text-left">{g.label}</span>
                <span className="font-mono tabular-nums">{total}</span>
              </button>
              {!collapsed && (
                <div className="space-y-0.5">
                  {g.sources.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSource(s.id === source ? "" : s.id)}
                      className={
                        "flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left text-[12px] transition-colors " +
                        (source === s.id
                          ? "bg-canvas-subtle font-semibold text-ink-950"
                          : "text-ink-600 hover:bg-canvas-subtle/60") +
                        (s.enabled ? "" : " opacity-45")
                      }
                      title={s.id + " · interval " + formatInterval(s.interval_sec)}
                    >
                      <span className="truncate">{s.name}</span>
                      <span className="ml-1.5 shrink-0 font-mono text-[11px] tabular-nums text-ink-400">{s.items}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      {/* 左侧连续导轨 (移动端为顶部收拢区) */}
      <aside className="w-full shrink-0 border-b border-ink-200 bg-canvas/70 px-3.5 py-3 lg:flex lg:w-[240px] lg:flex-col lg:gap-4 lg:border-r lg:border-b-0 lg:bg-canvas lg:px-3 lg:py-4">
        {/* 品牌行: 说明/RSS/GitHub/Export/Refresh All收进这一行, 省掉整items第二栏 */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <h1 className="text-[14.5px] font-semibold tracking-tight text-ink-950">Resource Radar</h1>
          </div>
          <span className="hidden font-mono text-[11px] tabular-nums text-ink-400 lg:inline">
            {stats.data?.totals.aiKept ?? "—"} picks
          </span>
          <div className="flex items-center gap-1 lg:hidden">
            {helpRssNode}
            {githubNode}
            <a href={exportUrl} className={ICON_BTN} title="Export current view as Markdown">
              <Download size={14} />
            </a>
            <button type="button" onClick={refreshAll} className={ICON_BTN} title="Refresh data">
              <RefreshCw size={14} className={items.loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* 桌面侧栏第二行: 说明/RSS + account; 移动端这两个入口已分别并入品牌行and导航行 */}
        <div className="mt-2 hidden items-center gap-1 px-1 lg:mt-0 lg:flex">
          {helpRssNode}
          {githubNode}
          <div className="ml-auto min-w-0">{accountNode}</div>
        </div>

        {guestMode && (guest.hidden.length > 0 || guest.starred.length > 0 || guest.read.length > 0) && (
          <div className="mt-2 rounded-md border border-ink-200 bg-surface-hover px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-600">
            Local: starred {guest.starred.length} · read {guest.read.length} · hidden {guest.hidden.length}
            {bootData?.loginEnabled && (
              <button
                type="button"
                onClick={async () => {
                  const r = await importGuestToAccount(guest);
                  if (r.ok) {
                    notify(`Merged ${r.imported} preferences into your account`);
                    syncGuest();
                    items.reload();
                    stats.reload();
                  } else {
                    notify(r.error ?? "Merge failed");
                  }
                }}
                className="ml-1 font-medium text-accent hover:underline"
              >
                Merge after login
              </button>
            )}
          </div>
        )}
        {/* 搜索框 (/ 快捷键聚焦) */}
        <div className="relative mt-2.5 lg:mt-0">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-400" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (search) {
                  setSearch("");
                  setDebounced("");
                } else {
                  e.currentTarget.blur();
                }
              }
            }}
            placeholder="Search freebies, codes…"
            className="h-8 w-full rounded-md border border-ink-200 bg-surface pr-8 pl-8 text-[12.5px] text-ink-950 transition-colors outline-none placeholder:text-ink-400 focus:border-accent"
          />
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setDebounced("");
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              title="Clear search"
            >
              <X size={12} />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-ink-200 bg-canvas px-1.5 py-0.5 font-mono text-[10.5px] text-ink-400 lg:inline">
              /
            </kbd>
          )}
        </div>

        {/* 导航: 手机横向可滚 + 右侧account, 桌面纵列无边框 */}
        <div className="-mx-3.5 mt-2.5 flex items-center gap-1.5 px-3.5 pb-0.5 lg:mx-0 lg:mt-0 lg:block lg:px-0 lg:pb-0">
          <nav className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:block lg:flex-none lg:space-y-0.5 lg:overflow-visible">
          {tabs.slice(0, 3).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTab(t.key)}
              className={
                "flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors lg:w-full " +
                (tab === t.key
                  ? "bg-ink-950 text-white lg:bg-canvas-subtle lg:font-semibold lg:text-ink-950"
                  : "text-ink-600 hover:bg-canvas-subtle/70 hover:text-ink-950")
              }
            >
              <span className="flex items-center gap-2">
                <t.icon size={14} className={tab === t.key ? "lg:text-accent" : "text-ink-400"} />
                {t.label}
              </span>
              {t.key === "feed" && (stats.data?.totals.unread ?? 0) > 0 && (
                <span
                  className={
                    "hidden font-mono text-[11px] tabular-nums lg:inline " +
                    (tab === t.key ? "text-ink-600" : "text-ink-400")
                  }
                >
                  {stats.data?.totals.unread}
                </span>
              )}
            </button>
          ))}
          <div className="mx-1 h-4 w-px shrink-0 self-center bg-ink-200 lg:hidden" />
          <div className="hidden px-2.5 pt-3 pb-1 text-[11px] font-medium text-ink-400 lg:block">
            Admin
          </div>
          {tabs.slice(3).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTab(t.key)}
              className={
                "flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors lg:w-full " +
                (tab === t.key
                  ? "bg-ink-950 text-white lg:bg-canvas-subtle lg:font-semibold lg:text-ink-950"
                  : "text-ink-600 hover:bg-canvas-subtle/70 hover:text-ink-950")
              }
            >
              <span className="flex items-center gap-2">
                <t.icon size={14} className={tab === t.key ? "lg:text-accent" : "text-ink-400"} />
                {t.label}
              </span>
              {typeof t.badge === "number" && t.badge > 0 && (
                <span
                  className={
                    "rounded px-1.5 py-0.5 font-mono text-[11px] tabular-nums " +
                    (tab === t.key
                      ? "bg-white/20 text-white lg:bg-surface lg:text-ink-700"
                      : "bg-ink-200/80 text-ink-600")
                  }
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
          </nav>
          {/* 移动端account入口: 贴着导航右侧, 不单独占一行 */}
          <div className="shrink-0 lg:hidden">{accountNode}</div>
        </div>
        {/* 场景预设 & Sources: 桌面侧栏常驻, 移动端折进主区"Filters"面板 */}
        {tab === "feed" && (
          <div className="mt-3 hidden lg:mt-0 lg:block">
            <div className="space-y-4">{sourcePanelNode}</div>
          </div>
        )}
      </aside>

      {/* 右侧纯白主工作区 */}
      <div className="flex min-w-0 flex-1 flex-col bg-surface">
        {/* 桌面 48px 顶栏 */}
        <header className="sticky top-0 z-20 hidden h-12 items-center justify-between gap-4 border-b border-ink-200 bg-surface/95 px-6 backdrop-blur-sm lg:flex">
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {tab === "feed" ? (
              <div className="flex items-center gap-1">
                {PRIMARY_CHANNELS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => switchPreset(p.key)}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] transition-all active:scale-[0.97] " +
                      (preset === p.key
                        ? "bg-ink-950 font-medium text-white shadow-xs"
                        : "text-ink-600 hover:bg-ink-100 hover:text-ink-950")
                    }
                  >
                    <p.icon size={12} className={preset === p.key ? "text-white/85" : "text-ink-400"} />
                    {p.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="font-semibold text-ink-950">
                {tabs.find((t) => t.key === tab)?.label ?? "Admin"}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-[12px] text-ink-500">
            <span className="font-mono tabular-nums">
              24h <strong className="font-semibold text-ink-900">+{stats.data?.totals.last24h ?? "—"}</strong>
            </span>
            <span className="text-ink-300" aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Codes <strong className="font-semibold text-ink-900">{stats.data?.totals.withCodes ?? "—"}</strong>
            </span>
            {(stats.data?.totals.aiRejected ?? 0) > 0 && (
              <>
                <span className="text-ink-300" aria-hidden="true">·</span>
                <span>Filtered {stats.data?.totals.aiRejected} noise items</span>
              </>
            )}
            <a
              href={exportUrl}
              className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-md border border-ink-200 bg-surface px-2.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-ink-100 hover:text-ink-950"
              title="Export current view as Markdown"
            >
              <Download size={12} /> Export
            </a>
            <button
              type="button"
              onClick={refreshAll}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-surface text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950"
              title="Refresh data"
            >
              <RefreshCw size={13} className={items.loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* 主内容区 */}
        <main className={tab === "feed" ? "min-w-0 flex-1" : "min-w-0 flex-1 px-3.5 py-3.5 sm:px-6 sm:py-5"}>
          {/* 懒加载的面板首次进入时给一个轻量占位, 避免整页闪白 */}
          <Suspense
            fallback={
              <div className="flex items-center justify-center gap-1.5 px-6 py-10 text-[12.5px] text-ink-400">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </div>
            }
          >
          {((tab as string) === "admin" || (ADMIN_TABS.has(tab) && !adminReady && !((tab === "rules" || tab === "push") && me))) && (
            <AdminGate protectedMode={protectedMode} onAuthChange={setAdminAuthed}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { key: "rules" as Tab, label: "Subscriptions & Blocklist", desc: "Keyword subscriptions & blocklist firewall", icon: ShieldBan },
                  { key: "push" as Tab, label: "Push Rules", desc: "Push timing, thresholds, format, and quiet hours", icon: Zap },
                  { key: "ai" as Tab, label: "AI Engine", desc: "Rule pre-filter, review model, prompts, and backfill", icon: Bot },
                  { key: "ops" as Tab, label: "Source Ops", desc: "Collection toggles, intervals, data retention", icon: Wrench },
                ].map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setTab(entry.key)}
                    className="panel flex flex-col items-start gap-1.5 p-4 text-left transition-colors hover:border-ink-400"
                  >
                    <entry.icon size={16} className="text-accent" />
                    <span className="text-[13.5px] font-semibold text-ink-950">{entry.label}</span>
                    <span className="text-[12px] leading-relaxed text-ink-500">{entry.desc}</span>
                  </button>
                ))}
              </div>
            </AdminGate>
          )}

          {tab === "feed" && (
            <>
              {/* 移动端: 频道胶囊 + Filters/视图压成一行, 省掉两items整行按钮 */}
              <div className="flex items-stretch border-b border-ink-100 bg-surface lg:hidden">
                <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3.5 py-1.5">
                  {PRIMARY_CHANNELS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => switchPreset(p.key)}
                      className={
                        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors active:scale-[0.97] " +
                        (preset === p.key
                          ? "bg-ink-950 font-medium text-white"
                          : "bg-ink-100/80 text-ink-600 hover:text-ink-950")
                      }
                    >
                      <p.icon size={11} />
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="relative flex shrink-0 items-center gap-1 border-l border-ink-100 bg-surface px-2">
                  {/* 左侧渐隐, 避免横向滚动的频道胶囊被硬切一半 */}
                  <span className="pointer-events-none absolute inset-y-0 -left-4 w-4 bg-gradient-to-l from-surface to-transparent" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setMobileFilterBar((v) => !v)}
                    className={
                      "relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors " +
                      (mobileFilterBar
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 bg-surface text-ink-600")
                    }
                    title="Filters"
                    aria-label="Filters"
                  >
                    <SlidersHorizontal size={14} />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 font-mono text-[9px] leading-none text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateViewMode(viewMode === "compact" ? "grid2" : "compact")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-ink-200 bg-surface text-ink-600 transition-colors hover:text-ink-950"
                    title={viewMode === "compact" ? "Switch to card grid" : "Switch to compact list"}
                    aria-label="Switch view"
                  >
                    {viewMode === "compact" ? <LayoutGrid size={14} /> : <AlignJustify size={14} />}
                  </button>
                </div>
              </div>
              {/* 快捷子Category胶囊items: 当前频道热门子类目一键直达, 不用再进二级下拉找 */}
              {(() => {
                const countMap = new Map((stats.data?.byCategory ?? []).map((c) => [c.category ?? "other", c.n]));
                const allowed = categoriesForPreset(preset);
                const ordered = [...allowed].sort((a, b) => (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0));
                // 只挂真的有内容的Category (外加已选中的, 方便一键Cancel); 全空时退回频道默认顺序
                const withItems = ordered.filter((key) => (countMap.get(key) ?? 0) > 0 || categories.includes(key));
                const quickCats = (withItems.length ? withItems : ordered).slice(0, 10);
                return (
                  <div className="flex items-stretch border-b border-ink-100 bg-surface">
                    <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-3.5 py-1">
                    <button
                      type="button"
                      onClick={() => setCategories([])}
                      className={
                        "shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-colors active:scale-[0.97] " +
                        (categories.length === 0
                          ? "bg-brand-subtle font-semibold text-accent"
                          : "text-ink-500 hover:bg-ink-100 hover:text-ink-900")
                      }
                    >
                      All{preset === "news" ? "Top News" : preset === "info" ? "News" : "Category"}
                    </button>
                    {quickCats.map((key) => {
                      const n = countMap.get(key) ?? 0;
                      const active = categories.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setCategories((cur) =>
                              cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
                            )
                          }
                          className={
                            "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] transition-colors active:scale-[0.97] " +
                            (active
                              ? "bg-ink-950 font-medium text-white"
                              : n > 0
                                ? "text-ink-600 hover:bg-ink-100 hover:text-ink-950"
                                : "text-ink-400 hover:bg-ink-100")
                          }
                        >
                          <span>{categoryLabelForPreset(key, preset)}</span>
                          {n > 0 && (
                            <span className={"font-mono text-[10.5px] tabular-nums " + (active ? "text-white/75" : "text-ink-400")}>
                              {n}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    </div>
                    {/* 移动端统计并进这一行右端, 不再单占一items */}
                    <div className="relative flex shrink-0 items-center border-l border-ink-100 bg-surface px-2.5 text-[11px] whitespace-nowrap text-ink-500 sm:hidden">
                      <span className="pointer-events-none absolute inset-y-0 -left-4 w-4 bg-gradient-to-l from-surface to-transparent" aria-hidden="true" />
                      Total <strong className="ml-1 font-mono font-semibold tabular-nums text-ink-900">{items.data?.total ?? 0}</strong>
                      <span className="ml-0.5">items</span>
                      {preset === "verified" && <span className="ml-1 font-medium text-deal">· verified</span>}
                    </div>
                  </div>
                );
              })()}

              {/* 40px 细线Filtersitems (根据当前频道自适应隐藏无关的价格/方式Filters) */}
              <div
                className={
                  "border-b border-ink-200 bg-[#FCFCFD] px-3.5 py-2.5 sm:px-6 sm:py-2 " +
                  (mobileFilterBar ? "block" : "hidden sm:block")
                }
              >
                <div className="flex flex-wrap items-center gap-1">
                  {/* Category多选浮层 (展开查看AllCategory) */}
                  <div className="relative" ref={catRef}>
                    <button
                      type="button"
                      onClick={() => setCatOpen((v) => !v)}
                      className={
                        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] transition-colors " +
                        (categories.length
                          ? "border-ink-950 bg-ink-950 font-medium text-white"
                          : "border-ink-200 bg-surface text-ink-700 hover:border-ink-300")
                      }
                    >
                      <span>
                        {categories.length === 0
                          ? "Category"
                          : categories.length === 1
                            ? `Category: ${categoryLabelForPreset(categories[0]!, preset)}`
                            : `Categories: ${categories.length} selected`}
                      </span>
                      <ChevronDown size={12} />
                    </button>
                    {catOpen && (
                      <div className="pop-enter panel absolute top-full left-0 z-40 mt-1.5 w-[260px] p-2.5 shadow-lg">
                        <div className="mb-2 flex items-center justify-between text-[11px] text-ink-500">
                          <span>{preset === "news" ? "Top news sections (multi-select)" : preset === "info" ? "Industry news sections (multi-select)" : preset === "deal" ? "Deal categories (multi-select)" : preset === "opensource" ? "Open-source areas (multi-select)" : "Freebie categories (multi-select)"}</span>
                          {categories.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setCategories([])}
                              className="font-medium text-accent hover:underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="grid max-h-[240px] grid-cols-2 gap-1 overflow-auto">
                          {(() => {
                            const countMap = new Map((stats.data?.byCategory ?? []).map((c) => [c.category ?? "other", c.n]));
                            const allowed = categoriesForPreset(preset);
                            const ordered = [...allowed].sort((a, b) => (countMap.get(b) ?? 0) - (countMap.get(a) ?? 0));
                            return ordered.map((key) => {
                              const n = countMap.get(key) ?? 0;
                              const checked = categories.includes(key);
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() =>
                                    setCategories((cur) =>
                                      cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key],
                                    )
                                  }
                                  className={
                                    "flex items-center justify-between rounded border px-2 py-1 text-left text-[11.5px] transition-colors " +
                                    (checked
                                      ? "border-ink-950 bg-ink-950 font-medium text-white"
                                      : n > 0
                                        ? "border-ink-200 bg-surface text-ink-700 hover:bg-ink-100"
                                        : "border-ink-100 bg-canvas/70 text-ink-400 hover:bg-ink-100")
                                  }
                                >
                                  <span className="truncate">{categoryLabelForPreset(key, preset)}</span>
                                  <span className={"ml-1 font-mono text-[10.5px] " + (checked ? "text-white/70" : "text-ink-400")}>
                                    {n}
                                  </span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* KindFilters */}
                  <select
                    value={kindFilter}
                    onChange={(e) => setKindFilter(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="Kind"
                  >
                    <option value="auto">Kind: {preset === "verified" ? "Verified Freebies" : preset === "deal" ? "Deals" : preset === "opensource" ? "Open Source" : preset === "news" ? "Top News" : preset === "info" ? "News" : "All"}</option>
                    <option value="all">Kind: all (incl. other)</option>
                    {KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>

                  {/* 语言Filters */}
                  <select
                    value={lang}
                    onChange={(e) => setLang(e.target.value as "all" | "zh" | "en")}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="Filter by title language"
                  >
                    <option value="all">Language: all</option>
                    <option value="zh">Chinese only</option>
                    <option value="en">English only</option>
                  </select>

                  {preset !== "news" && preset !== "info" && preset !== "opensource" && (
                    <>
                      <select
                        value={priceCap}
                        onChange={(e) => setPriceCap(e.target.value)}
                        className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                        title="Price cap"
                      >
                        <option value="auto">
                          Price: any
                        </option>
                        <option value="all">Price: any</option>
                        <option value="free">Free only (0)</option>
                        <option value="5">≤ 5</option>
                        <option value="10">≤ 10</option>
                        <option value="30">≤ 30</option>
                        <option value="100">≤ 100</option>
                      </select>

                      <select
                        value={obtain}
                        onChange={(e) => setObtain(e.target.value)}
                        className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                        title={OBTAIN_HINT[obtain] ?? "Obtain mode"}
                      >
                        <option value="auto">
                          Obtain: {preset === "verified" ? "Free+conditional" : "Any"}
                        </option>
                        <option value="all">Obtain: all (incl. giveaways/trials)</option>
                        <option value="free">Free only</option>
                        <option value="conditional">Conditional</option>
                        <option value="lottery">Giveaway</option>
                        <option value="trial">Free trial</option>
                        <option value="promo">Promo</option>
                      </select>
                    </>
                  )}

                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="Published window"
                  >
                    <option value="auto">
                      Time: {preset === "verified" ? "Within 7 days" : "Any"}
                    </option>
                    <option value="all">Time: any</option>
                    <option value="1d">Within 24h</option>
                    <option value="3d">Within 3 days</option>
                    <option value="7d">Within a week</option>
                    <option value="30d">Within a month</option>
                  </select>

                  <select
                    value={minScore}
                    onChange={(e) => setMinScore(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="Min score"
                  >
                    <option value="all">Score: any</option>
                    <option value="50">≥ 50 pts</option>
                    <option value="60">≥ 60 pts</option>
                    <option value="70">≥ 70 pts</option>
                  </select>

                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="h-7 rounded-md border border-ink-200 bg-surface px-1.5 text-[11.5px] text-ink-700 outline-none focus:border-accent"
                    title="Sort by"
                  >
                    <option value="newest">Latest</option>
                    <option value="score">Top score</option>
                    <option value="oldest">Oldest</option>
                    <option value="expiring">Ending soon</option>
                    {preset !== "news" && preset !== "info" && <option value="price_asc">Cheapest</option>}
                  </select>

                  <button
                    type="button"
                    onClick={() => setUnreadOnly((v) => !v)}
                    className={
                      "h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors active:scale-[0.97] " +
                      (unreadOnly
                        ? "border-ink-950 bg-ink-950 text-white"
                        : "border-ink-200 bg-surface text-ink-600 hover:border-ink-300")
                    }
                  >
                    Unread
                  </button>

                  {visible.some((i) => !i.read) && (
                    <button
                      type="button"
                      onClick={() => void markVisibleRead()}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-ink-200 bg-surface px-2 text-[12px] font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-950 active:scale-[0.97]"
                      title="Mark all unread items in the current list as read"
                    >
                      <CheckCheck size={12} /> Mark read
                    </button>
                  )}

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-accent hover:bg-brand-subtle"
                    >
                      <RotateCcw size={11} /> Reset ({activeFilterCount})
                    </button>
                  )}

                  {/* 右端统计and视图切换 */}
                  <div className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
                    <span className="text-[12px] text-ink-500">
                      {items.loading ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" /> Loading…
                        </span>
                      ) : (
                        <>
                          Total <strong className="font-mono font-semibold tabular-nums text-ink-900">{items.data?.total ?? 0}</strong> items
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-0.5 rounded-md border border-ink-200 bg-surface p-0.5">
                      {[
                        { key: "compact" as const, icon: AlignJustify, label: "Compact list", text: "Compact" },
                        { key: "grid2" as const, icon: LayoutGrid, label: "2-column cards", text: "2-col" },
                        { key: "grid3" as const, icon: LayoutGrid, label: "3-column cards", text: "3-col" },
                      ].map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => updateViewMode(v.key)}
                          className={
                            "inline-flex items-center gap-1 rounded px-2 py-1 text-[11.5px] font-medium transition-colors " +
                            (viewMode === v.key ? "bg-ink-950 text-white" : "text-ink-500 hover:text-ink-950")
                          }
                          title={v.label}
                        >
                          <v.icon size={12} />
                          <span>{v.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* 移动端: Quick viewsandSources折进这个面板, 排在Filtersitems之后 */}
                {tab === "feed" && (
                  <div className="mt-2.5 space-y-3 border-t border-ink-200 pt-2.5 lg:hidden">{sourcePanelNode}</div>
                )}

                {activeFilterCount > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-2 text-[11.5px]">
                    <span className="text-ink-400">Current filters: </span>
                    {debounced && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setDebounced("");
                        }}
                        className="rounded bg-ink-100 px-2 py-0.5 text-ink-700 hover:bg-ink-200"
                      >
                        Search: {debounced} ×
                      </button>
                    )}
                    {source && (
                      <button
                        type="button"
                        onClick={() => setSource("")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Source: {sourceName(source)} ×
                      </button>
                    )}
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategories((cur) => cur.filter((x) => x !== cat))}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Category: {categoryLabelForPreset(cat, preset)} ×
                      </button>
                    ))}
                    {lang !== "all" && (
                      <button
                        type="button"
                        onClick={() => setLang("all")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Language: {lang === "zh" ? "Chinese only" : "English only"} ×
                      </button>
                    )}
                    {priceCap !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setPriceCap("auto")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Price: {priceCap === "all" ? "Any" : priceCap === "free" ? "Free only" : `≤${priceCap}`} ×
                      </button>
                    )}
                    {obtain !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setObtain("auto")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Obtain: {obtain === "all" ? "All" : (OBTAIN_LABEL[obtain] ?? obtain)} ×
                      </button>
                    )}
                    {range !== "auto" && (
                      <button
                        type="button"
                        onClick={() => setRange("auto")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Time: {range === "all" ? "Any" : range} ×
                      </button>
                    )}
                    {minScore !== "all" && (
                      <button
                        type="button"
                        onClick={() => setMinScore("all")}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Score: ≥{minScore} ×
                      </button>
                    )}
                    {unreadOnly && (
                      <button
                        type="button"
                        onClick={() => setUnreadOnly(false)}
                        className="rounded bg-brand-subtle px-2 py-0.5 text-accent hover:bg-ink-200/70"
                      >
                        Unread only ×
                      </button>
                    )}
                  </div>
                )}
              </div>


              {items.error && (
                <div className="mx-3.5 my-3 rounded-lg border border-alert-border bg-alert-subtle p-4 text-[13px] text-alert sm:mx-6">
                  Failed to load: {items.error}
                </div>
              )}

              {viewMode === "compact" ? (
                <div key={`compact-${preset}`} className="list-enter">
                  {visible.map((item) => (
                    <Fragment key={item.id}>
                      <CompactRow
                        item={item}
                        sourceName={sourceName}
                        selected={detail?.id === item.id}
                        onPatch={patch}
                        onOpen={setDetail}
                        onQuickBlock={setQuickBlock}
                        onCopyCode={copyCode}
                        expanded={relatedOpen === item.id}
                        onToggleRelated={(id) => setRelatedOpen((cur) => (cur === id ? null : id))}
                      />
                      {relatedOpen === item.id && relatedMap[item.id] ? (
                        <div className="pop-enter border-b border-ink-100 bg-surface-hover px-3.5 py-2 sm:px-6">
                          <div className="mb-1 text-[11px] font-medium text-ink-500">
                            Same event / freebie — {relatedMap[item.id]!.length}  more source reports
                          </div>
                          <ul className="space-y-1">
                            {relatedMap[item.id]!.map((r) => (
                              <li key={r.id} className="flex items-center gap-2 text-[12px]">
                                <span className="w-20 shrink-0 truncate text-ink-500 sm:w-28">{r.sourceName ?? r.source_id}</span>
                                <a
                                  href={r.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate text-ink-700 hover:text-accent hover:underline"
                                >
                                  {r.title}
                                </a>
                                <span className="shrink-0 font-mono text-[11px] text-ink-400">
                                  {String(r.first_seen_at).slice(5, 16).replace("T", " ")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </Fragment>
                  ))}
                </div>
              ) : (
                <div
                  key={`grid-${preset}-${viewMode}`}
                  className={
                    "list-enter " +
                    (viewMode === "grid3"
                      ? "grid grid-cols-1 gap-3.5 px-3.5 py-3 md:grid-cols-2 xl:grid-cols-3 sm:px-6 sm:py-4"
                      : "grid grid-cols-1 gap-3.5 px-3.5 py-3 md:grid-cols-2 sm:px-6 sm:py-4")
                  }
                >
                  {visible.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      sourceName={sourceName}
                      onPatch={patch}
                      onOpen={setDetail}
                      onQuickBlock={setQuickBlock}
                      onCopyCode={copyCode}
                      expanded={relatedOpen === item.id}
                      relatedItems={relatedOpen === item.id ? relatedMap[item.id] : undefined}
                      onToggleRelated={(id) => setRelatedOpen((cur) => (cur === id ? null : id))}
                    />
                  ))}
                </div>
              )}

              {!items.loading && !visible.length && (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <Radar size={28} className="text-ink-300" />
                  <div className="text-[15px] font-medium text-ink-900">No freebies under current filters</div>
                  <p className="max-w-md text-[12.5px] leading-relaxed text-ink-500">
                    Try switching "Quick views" to "All Items" or relaxing the price cap; a blocklist may also be hiding results. 
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      resetFilters();
                      setPreset("all");
                    }}
                    className="mt-1 rounded-md bg-brand px-4 py-2 text-[12.5px] font-medium text-white hover:bg-brand-hover"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}

          {tab === "hot" && (
            <HotPanel
              report={hot.data}
              loading={hot.loading}
              error={hot.error}
              hours={hotHours}
              scope={hotScope}
              onHours={setHotHours}
              onScope={setHotScope}
              onReload={hot.reload}
              onSearchWord={(w) => {
                setSearch(w);
                switchPreset(hotScope === "news" ? "news" : hotScope === "info" ? "info" : hotScope === "deals" ? "verified" : "all");
                setTab("feed");
              }}
              onJumpCategory={(cat) => {
                const targetPreset =
                  hotScope === "news" || cat === "headline" || cat === "world"
                    ? "news"
                    : hotScope === "info" || cat === "stock" || cat === "tech" || cat === "finance"
                      ? "info"
                      : "all";
                switchPreset(targetPreset);
                setCategories([cat]);
                setTab("feed");
              }}
              onOpenItem={async (id) => {
                const found = items.data?.items?.find((it) => it.id === id);
                if (found) {
                  setDetail(found);
                  return;
                }
                try {
                  const res = await fetch("/api/items/" + id);
                  if (res.ok) {
                    const item = (await res.json()) as Item;
                    setDetail(item);
                    return;
                  }
                } catch {
                  /* 回退到Feed */
                }
                setTab("feed");
              }}
              sourceName={sourceName}
            />
          )}

          {tab === "digest" && (
            <DigestPanel
              digests={digests.data?.digests ?? []}
              detail={digestDetail}
              pickedDate={pickedDate}
              onPickDate={setPickedDate}
              canAdmin={adminReady}
              onRunDaily={async () => {
                notify("Generating today's digest…");
                const res = await fetch("/api/digests/run", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { date?: string; count?: number; error?: string };
                if (!res.ok) notify(data.error ?? "Generation failed");
                else notify(`Generated ${data.count ?? 0} digest items`);
                digests.reload();
                setPickedDate(res.ok && data.date ? data.date : null);
                digestDetail.reload();
              }}
              sourceName={sourceName}
              onPatch={patch}
              onOpen={setDetail}
              onQuickBlock={setQuickBlock}
              onCopyCode={copyCode}
              onRunWeekly={async () => {
                notify("Generating this week's digest…");
                const res = await fetch("/api/digests/weekly", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { date?: string; count?: number; error?: string; pushed?: boolean };
                if (!res.ok) notify(data.error ?? "Generation failed");
                else notify(`Weekly digest generated: ${data.count ?? 0} items${data.pushed ? ", sent to Telegram" : ""}`);
                digests.reload();
                setPickedDate(res.ok && data.date ? data.date : null);
                digestDetail.reload();
              }}
            />
          )}

          {(adminReady || me) && tab === "rules" && (
            <RulesPanel
              subscriptions={subs.data?.subscriptions ?? []}
              rules={blockRules.data?.rules ?? []}
              presets={blockRules.data?.presets ?? []}
              totalBlocked={blockRules.data?.totalBlocked ?? 0}
              sources={sources.data?.sources ?? []}
              blockedPreview={blockedPreview}
              sourceName={sourceName}
              onAddSub={addSubscription}
              onRemoveSub={removeSubscription}
              onJumpToSubscribed={(kw) => {
                setSearch(kw);
                setPreset("all");
                setTab("feed");
              }}
              onAddRule={addRule}
              onImportPresets={async () => {
                await fetch("/api/block-rules", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ presets: true }),
                });
                blockRules.reload();
                items.reload();
                stats.reload();
                notify("Imported common noise block words");
              }}
              onToggleRule={async (id, enabled) => {
                await fetch((isPublicSite && !adminReady ? "/api/me/block-rules/" : "/api/block-rules/") + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ enabled }),
                });
                blockRules.reload();
                items.reload();
                setBlockedPreview(null);
              }}
              onDeleteRule={async (id) => {
                await fetch((isPublicSite && !adminReady ? "/api/me/block-rules/" : "/api/block-rules/") + id, { method: "DELETE" });
                blockRules.reload();
                items.reload();
                stats.reload();
                setBlockedPreview(null);
                notify("Rule deleted; affected items are visible again");
              }}
              onLoadBlockedPreview={async () => {
                const res = await fetch("/api/items?includeBlocked=1&limit=80&sort=newest");
                const data = (await res.json()) as { items: Item[] };
                setBlockedPreview(data.items);
              }}
            />
          )}

          {pushBase && tab === "push" && (
            <PushPanel
              payload={push.data}
              preview={pushPreview}
              logs={pushLogs.data?.logs ?? []}
              sources={sources.data?.sources ?? []}
              onSave={async (p: Partial<PushSettings>) => {
                const res = await fetch(pushBase ?? "/api/push", {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(p),
                });
                if (!res.ok) {
                  notify("Save failed");
                  return;
                }
                push.reload();
                setPushPreview(null);
                notify("Push rules saved");
              }}
              onPreview={async () => {
                const res = await fetch((pushBase ?? "/api/push") + "/preview?limit=6");
                setPushPreview((await res.json()) as PushPreview);
              }}
              onFlush={async () => {
                const res = await fetch((pushBase ?? "/api/push") + "/flush", { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as { sent?: number; queued?: number };
                notify(`Sent ${data.sent ?? 0}, ${data.queued ?? 0} left in queue`);
                push.reload();
                pushLogs.reload();
                setPushPreview(null);
              }}
              onTest={async () => {
                const res = await fetch((pushBase ?? "/api/push") + "/test", { method: "POST" });
                notify(res.ok ? "Test message sent to Telegram" : "Push disabled or credentials missing");
                pushLogs.reload();
              }}
            />
          )}

          {adminReady && tab === "ai" && (
            <AiPanel
              data={ai.data}
              sources={sources.data?.sources ?? []}
              reload={ai.reload}
              onNotify={notify}
              sourceName={sourceName}
              onOpenItem={async (id) => {
                const found = items.data?.items?.find((it) => it.id === id);
                if (found) {
                  setDetail(found);
                  return;
                }
                try {
                  const res = await fetch("/api/items/" + id);
                  if (res.ok) {
                    const item = (await res.json()) as Item;
                    setDetail(item);
                  }
                } catch {
                  /* ignore */
                }
              }}
            />
          )}

          {me && tab === "me" && bootData && <UserPushPanel boot={bootData} />}
          {adminReady && tab === "ops" && <SiteAdminPanel />}
          {adminReady && tab === "ops" && (
            <OpsPanel
              sources={sources.data?.sources ?? []}
              runs={runs.data?.runs ?? []}
              sourceName={sourceName}
              onCollectSource={async (id) => {
                const isCookieSite = id === "zhihu-search" || id === "xhs-search" || id === "xiaoheihe-search";
                notify(isCookieSite ? "Collecting via VPS cookies (about 15-40s)…" : "Collecting…");
                const res = await fetch(`/api/sources/${id}/collect`, { method: "POST" });
                const data = (await res.json().catch(() => ({}))) as {
                  ok?: boolean;
                  error?: string;
                  summary?: { inserted: number; fetched: number; status: string };
                };
                if (!res.ok || data.ok === false || data.summary?.status === "failed") {
                  notify(data.error ?? "Collection failed");
                } else {
                  notify(`Done: fetched ${data.summary?.fetched ?? 0}, inserted ${data.summary?.inserted ?? 0}`);
                }
                refreshAll();
              }}
              onToggleSource={async (id, enabled) => {
                await fetch("/api/sources/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ enabled }),
                });
                sources.reload();
                notify(enabled ? "Source enabled" : "Source disabled");
              }}
              onChangeInterval={async (id, sec) => {
                await fetch("/api/sources/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ interval_sec: sec }),
                });
                sources.reload();
                notify("Interval changed to " + formatInterval(sec));
              }}
              onAddRss={async (name, url, intervalSec, kindHint, categoryHint) => {
                notify("Adding and test-collecting…");
                const res = await fetch("/api/sources", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ name, url, intervalSec, kindHint, categoryHint }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  summary?: { fetched: number; inserted: number; status: string; error?: string };
                };
                if (!res.ok) notify(data.error ?? "Failed to add");
                else if (data.summary?.status === "failed") notify("Added, but the first collection failed:" + (data.summary.error ?? ""));
                else notify(`Added — fetched ${data.summary?.fetched ?? 0}, inserted ${data.summary?.inserted ?? 0}`);
                refreshAll();
              }}
              onUpdateSource={async (id, patch) => {
                const res = await fetch("/api/sources/" + id, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify(patch),
                });
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                  notify(data.error ?? "Save failed");
                  return false;
                }
                sources.reload();
                notify("Source config updated");
                return true;
              }}
              onDeleteSource={async (id) => {
                const res = await fetch("/api/sources/" + id, { method: "DELETE" });
                const data = (await res.json().catch(() => ({}))) as { error?: string };
                if (!res.ok) {
                  notify(data.error ?? "Delete failed");
                  return false;
                }
                refreshAll();
                notify("Custom source deleted");
                return true;
              }}
              onNotify={notify}
            />
          )}
          </Suspense>
        </main>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-3.5 py-3 text-[11.5px] text-ink-400 sm:px-6">
          <span>Resource Radar · Multi-source aggregation · AI semantic triage · Your filters are your pushes</span>
          <span className="font-mono tabular-nums">
            {stats.data?.totals.active ?? 0} items in DB · {stats.data?.totals.unread ?? 0}  unread
          </span>
        </footer>
      </div>

      {detail && (
        <ItemDetailDrawer
          item={detail}
          sourceName={sourceName}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex >= 0 && currentIndex < visible.length - 1}
          onPrev={() => currentIndex > 0 && setDetail(visible[currentIndex - 1] ?? null)}
          onNext={() => currentIndex >= 0 && currentIndex < visible.length - 1 && setDetail(visible[currentIndex + 1] ?? null)}
          onClose={() => setDetail(null)}
          onPatch={patch}
          onQuickBlock={setQuickBlock}
          onCopyCode={copyCode}
        />
      )}

      {quickBlock && (
        <QuickBlockModal
          item={quickBlock}
          sourceName={sourceName}
          onClose={() => setQuickBlock(null)}
          onIgnoreOne={(id) => patch(id, { status: "ignored" })}
          onAddRule={quickBlockAdd}
        />
      )}

      <Toast message={toast} />

      {welcomeOpen && bootData && (
        <WelcomeModal
          boot={bootData}
          onClose={closeWelcome}
          onLogin={() => {
            closeWelcome();
            setAuthHash(null);
            setAuthOpen(true);
          }}
        />
      )}

      {authOpen && bootData && (
        <AuthModal
          boot={bootData}
          initialHash={authHash}
          onClose={() => setAuthOpen(false)}
          onDone={() => {
            setAuthOpen(false);
            boot.reload();
            setTimeout(() => {
              items.reload();
              stats.reload();
            }, 300);
          }}
        />
      )}

      {rssOpen && bootData && <RssModal boot={bootData} currentQuery={query} onClose={() => setRssOpen(false)} />}
    </div>
  );
}
