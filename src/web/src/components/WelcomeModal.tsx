import { BookOpen, Globe2, Send, ShieldCheck, X } from "lucide-react";
import type { Bootstrap } from "../lib/session.ts";

/**
 * 入站提示: 首次访问 (or站长把版本号 +1 后)弹一次. 
 * 内容由后台可Edit, 这里的引导卡片按站点Kind动态决定显示哪几items. 
 */
export function WelcomeModal({
  boot,
  onClose,
  onLogin,
}: {
  boot: Bootstrap;
  onClose: () => void;
  onLogin: () => void;
}) {
  const ob = boot.onboarding;
  const isPublic = boot.siteMode === "public";
  const cards = [
    isPublic && {
      icon: ShieldCheck,
      title: "No login needed — users never affect each other",
      body: "Hidden, starred, read, and quick-block stay in your own browser; they sync across devices only after you log in.",
    },
    boot.loginEnabled && {
      icon: Send,
      title: "Bind your own Telegram Bot",
      body: "After logging in you can set your own Bot Token and Chat ID to get personal pushes without bothering anyone else.",
    },
    {
      icon: Globe2,
      title: "RSS feeds supported",
      body: "The \u201cRSS\u201d button in the top bar creates a public feed link; logged-in users also get a personal link that respects their blocklist.",
    },
  ].filter(Boolean) as { icon: typeof ShieldCheck; title: string; body: string }[];

  return (
    <div className="backdrop-enter fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/35 px-4">
      <div className="sheet-enter panel w-full max-w-[520px] overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-accent" />
            <h2 className="text-[15px] font-semibold text-ink-950">{ob.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="max-h-[62vh] space-y-3 overflow-auto px-5 py-4">
          <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-700">{ob.content}</p>

          {ob.showGuideCards && (
            <div className="space-y-2 pt-1">
              {cards.map((c) => (
                <div key={c.title} className="flex items-start gap-2.5 rounded-lg border border-ink-200 bg-surface-hover px-3 py-2.5">
                  <c.icon size={14} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <div className="text-[12.5px] font-medium text-ink-900">{c.title}</div>
                    <div className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{c.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3">
          {boot.loginEnabled && !boot.user && (
            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-ink-100"
            >
              Log in first
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-ink-950 px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-brand-hover"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}