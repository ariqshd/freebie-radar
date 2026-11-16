import { useState } from "react";
import { Check, Copy, Globe2, Lock, X } from "lucide-react";
import type { Bootstrap } from "../lib/session.ts";

function CopyRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-ink-200 bg-surface-hover p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-900">{label}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* 剪贴板不可用时用户可手动选中 */
            }
          }}
          className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-ink-100"
        >
          {copied ? <Check size={12} className="text-deal" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{hint}</p>
      <code className="mt-1.5 block overflow-x-auto rounded border border-ink-200 bg-surface px-2 py-1.5 font-mono text-[11px] whitespace-nowrap text-ink-700">
        {url}
      </code>
    </div>
  );
}

/**
 * RSS feeds助手: 把"current filters"直接变成一items订阅地址, 
 * Log in用户还能拿到带个人Block规则的专属地址. 
 */
export function RssModal({
  boot,
  currentQuery,
  onClose,
}: {
  boot: Bootstrap;
  currentQuery: string;
  onClose: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qs = currentQuery.replace(/^\?/, "").replace(/&?limit=\d+/, "");
  const publicUrl = origin + "/rss.xml" + (qs ? "?" + qs : "");
  const user = boot.user;

  return (
    <div className="backdrop-enter fixed inset-0 z-[70] flex items-center justify-center bg-ink-950/35 px-4">
      <div className="sheet-enter panel w-full max-w-[520px] overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Globe2 size={15} className="text-accent" />
            <div>
              <h2 className="text-[15px] font-semibold text-ink-950">RSS feeds</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-500">Drop it into any reader; the public feed needs no login</p>
            </div>
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

        <div className="max-h-[62vh] space-y-2.5 overflow-auto px-5 py-4">
          <CopyRow label="Public feed (current filters)" hint="Applies the site-wide blocklist and cross-source dedupe; anyone can subscribe" url={publicUrl} />
          <CopyRow
            label="Public feed (verified freebies)"
            hint="Always outputs the \u201cVerified Freebies\u201d channel, ignoring current filters"
            url={origin + "/rss.xml?preset=verified&limit=50"}
          />

          {user ? (
            <>
              <div className="pt-1 text-[11.5px] font-medium text-ink-500">My personal feed</div>
              <CopyRow
                label="Personal feed (standard)"
                hint="Automatically excludes items you hid and applies your personal blocklist"
                url={origin + "/rss/u/" + user.rssToken + ".xml"}
              />
              <CopyRow
                label="Personal feed (push rules)"
                hint="Filters strictly by the score, categories, and obtain modes you set in \u201cMy Push\u201d"
                url={origin + "/rss/u/" + user.rssToken + ".xml?mode=push"}
              />
              <CopyRow
                label="Personal feed (watched keywords only)"
                hint="Outputs only items matching your watched keywords"
                url={origin + "/rss/u/" + user.rssToken + ".xml?mode=subs"}
              />
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500">
                <Lock size={11} className="mt-0.5 shrink-0" />
                This link is itself a credential — don't post it publicly; if it leaks, reset the token under "Me". 
              </p>
            </>
          ) : (
            <p className="rounded-md border border-ink-200 bg-surface-hover px-3 py-2 text-[11.5px] leading-relaxed text-ink-600">
              After logging in you also get a personal feed link that respects your blocklist. 
            </p>
          )}
        </div>
      </div>
    </div>
  );
}