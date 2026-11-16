# English UI translation glossary (freebie-radar)

Use these exact English terms for consistency. Translate all human-readable Chinese UI text
(JSX text, labels, placeholders, titles, aria-labels, tooltips, toasts, buttons, table headers,
form hints, empty states). Also translate code comments if easy, but comments are optional.

## Rules (IMPORTANT)
- Do NOT change any code, identifier, variable, key, URL, CSS class, model name, API path,
  localStorage key, or any string used in a comparison/logic (e.g. `"wait_ai"`, `"drop"`, `"zh"`).
- Do NOT translate user data (item titles, summaries, URLs, source IDs).
- Keep Chinese brand/site names where they are proper nouns (e.g. "LINUX DO", "V2EX", "Epic Games",
  "OpenRouter", "Telegram", "GitHub", "Reddit", "Bluesky", "GamerPower", "CheapShark", "itch.io",
  "Keylol", "Zhihu", "Xiaohongshu", "Xiaoheihe", "NGA", "Bilibili", "Weibo", "CCTV", "BBC").
- Keep punctuation/style natural in English. Use sentence case for labels, title case for panel titles.
- Preserve all whitespace/indentation and JSX structure exactly.

## Channels / presets
- verified -> Verified Freebies
- free -> All Freebies
- offline -> In-person Freebies
- pan -> Cloud Drives / Courses
- deal -> Deals (App.tsx "黑五/好价" -> "Black Friday / Deals")
- opensource -> Open Source
- news -> Top News
- info -> Industry News
- codes -> Has Codes
- urgent -> Ending Today
- starred -> Starred
- all -> All Items
- hidden -> Hidden

## Main tabs
- feed -> Feed
- hot -> Today's Hot
- digest -> Daily Digest
- me -> Me
- rules -> Subscriptions & Blocklist (personal: My Subscriptions & Blocklist)
- push -> Push Rules (personal: My Push Rules)
- ai -> AI Engine
- ops -> Source Ops
- admin -> Admin

## Source groups (lib/sources.ts)
- community -> Communities & Deal Channels
- news -> Top News & Industry
- game -> Game Giveaways & Deals
- software -> Software · AI · Open Source
- deals -> General Freebies & Deals

## Categories (shared/taxonomy.ts)
- ai -> AI Credits
- cloud -> Cloud Services
- vps -> VPS / Servers
- domain -> Domains / Web Hosting
- opensource -> Open Source
- software -> Software Licenses
- dev -> Dev / Engineering
- design -> Design / Assets
- security -> Security / Network
- hardware -> Hardware / Gadgets
- media -> Media / Streaming
- game -> Games
- carpool -> Carpool / Sharing
- trade -> Secondhand / Trade
- headline -> Top News
- world -> World News
- finance -> Economy / Business
- stock -> Stocks / Markets
- tech -> Tech News
- news -> General News
- goods -> Goods / Deals
- offline -> In-person Freebies
- invite -> Invite Codes
- edu -> Education / Exams
- pan -> Cloud Drive Files
- course -> Courses / Tutorials
- other -> Other

Category descriptions (CATEGORY_DESC) should be short English explanations, e.g.
- ai: "LLM credits / tokens / compute / API trials"
- cloud: "Cloud services other than VMs: object storage / CDN / DB / proxy traffic"
- vps: "Dedicated servers / VPS / bare metal / home broadband"
- domain: "Domains / SSL / DNS / web hosting / site building"
- opensource: "GitHub/GitLab repos and self-hostable projects"
- software: "Licensed software / activation codes / free & buy-once apps"
- dev: "Frameworks / CLI / SDK / plugins / deployment guides"
- design: "Fonts / icons / UI templates / assets / presets"
- security: "Vulnerabilities / VPN / privacy & security tools"
- hardware: "Hardware / routers / NAS / gadgets"
- media: "Streaming memberships / shows / music / anime"
- game: "Free game keys / historical lows / game bundles"
- carpool: "Legit carpool / shared plans / family slots"
- trade: "Secondhand servers / account & device transfers"
- headline: "Domestic politics / policy / livelihood news"
- world: "International affairs / diplomacy / overseas news"
- finance: "Macro economy / earnings / funding & M&A / currency"
- stock: "A-shares / HK / US stocks / ETF / IPO"
- tech: "Tech frontier / chips / internet / space & energy"
- news: "General news and other updates"
- goods: "Everyday freebies / coupons / phone credit / physical goods"
- offline: "In-person events / stores / pop-ups / physical pickups"
- invite: "Invite codes / open registration / beta access"
- edu: "Question banks / past papers / textbooks / ebooks / exam prep"
- pan: "Quark / Aliyun / Baidu netdisk shares and reposts"
- course: "Open courses / bootcamps / video courses / materials"
- other: "Fallback category"

Category groups (CATEGORY_GROUPS)
- freebie -> Freebies & Deals
- tech -> Tech & Tools
- content -> Content & Learning
- news -> News & Information
- other -> Other

## Kinds (shared/taxonomy.ts)
- freebie -> Freebie
- deal -> Deal
- opensource -> Open Source
- news -> Top News
- info -> Industry News
- noise -> Noise

## Obtain modes (shared/taxonomy.ts)
- free -> Free
- conditional -> Conditional
- lottery -> Giveaway
- trial -> Trial
- promo -> Promo
- paid -> Paid

Obtain hints (OBTAIN_HINT)
- free: "Claim instantly — no posts, invites, or draws needed"
- conditional: "Requires posting, following, inviting, or verifying"
- lottery: "Random draw — not guaranteed"
- trial: "Free for N days or the first month, then paid"
- promo: "Marketing hook for a paid service"
- paid: "Requires payment"

## News category labels (NEWS_CATEGORY_LABEL)
- headline -> Top News
- world -> World News
- finance -> Economy / Business
- stock -> Stocks / Markets
- tech -> Tech Frontier
- ai -> AI Frontier
- dev -> Development
- opensource -> Open Source
- security -> Security
- cloud -> Cloud / Architecture
- vps -> Hosting / Network
- hardware -> Hardware
- software -> Software / Apps
- game -> Gaming
- design -> Design / UX
- edu -> Education
- pan -> Cloud Drives
- course -> Courses
- news -> General News
- other -> Other News

## Time labels (lib/sources.ts)
- 刚刚 -> just now
- N 分钟前 -> Nm ago
- N 小时前 -> Nh ago
- N 天前 -> Nd ago
- 已过期 -> Expired
- 今天截止 -> Ends today
- N 天后截止 -> Nd left
- formatInterval: N 秒 -> Ns, N 分钟 -> Nm, N 小时 -> Nh

## Source label overrides (App.tsx SOURCE_LABEL)
- linuxdo-welfare -> LINUX DO · Freebies
- linuxdo-resource -> LINUX DO · Resources
- v2ex-free -> V2EX · Free Giveaways
- rss-fuliba -> Fuliba
- rss-52pojie -> 52pojie
- rss-smzdm -> SMZDM
- zhihu-search -> Zhihu · Freebie Search
- xhs-search -> Xiaohongshu · Freebie Search
- xiaoheihe-search -> Xiaoheihe · Freebie Search
- tg-channels -> Telegram Channels
- gamerpower -> GamerPower · Free Games
- epic-free -> Epic Games · Free Games
- openrouter-free -> OpenRouter · New Free Models
- gamerpower-loot -> GamerPower · Free Loot & Keys
- rss-itch-free -> itch.io · 100% Off Games
- rss-freesteamkeys -> FreeSteamKeys · Steam Freebies
- rss-ghxi -> Ghxi · Free Software

## Common UI words
- 搜索 -> Search
- 刷新 -> Refresh
- 导出 -> Export
- 登录 -> Log in
- 退出登录 -> Log out
- 管理区 -> Admin
- 保存 -> Save
- 取消 -> Cancel
- 删除 -> Delete
- 添加 -> Add
- 启用中 -> Enabled
- 已停用 -> Disabled
- 已关闭 -> Hidden
- 我的收藏 -> Starred
- 全部收录 -> All Items
- 含兑换码 -> Has Codes
- 今日截止 -> Ending Today
- 订阅与屏蔽 -> Subscriptions & Blocklist
- 推送规则 -> Push Rules
- AI 引擎 -> AI Engine
- 数据源运维 -> Source Ops
- 资源流 -> Feed
- 今日热点 -> Today's Hot
- 每日精选 -> Daily Digest
- 暂无 / 空状态 -> "No items yet" style English
