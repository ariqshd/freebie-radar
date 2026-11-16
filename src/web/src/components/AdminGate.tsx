import { useEffect, useState } from "react";
import { KeyRound, Loader2, Lock, ShieldCheck } from "lucide-react";
import { getToken, setToken, clearToken, verifyToken } from "../lib/auth.ts";

/**
 * AdminLog in门: 拦在 #/admin/* 前面. 
 * 服务端没设 ADMIN_TOKEN 时直接放行 (protectedMode=false). 
 */
export function AdminGate({
  protectedMode,
  onAuthChange,
  children,
}: {
  protectedMode: boolean;
  onAuthChange?: (authed: boolean) => void;
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  // 服务端没开保护时, Log in门形同虚设
  useEffect(() => {
    if (!protectedMode) setAuthed(true);
  }, [protectedMode]);

  if (!protectedMode || authed) {
    return (
      <div className="space-y-3">
        {protectedMode && (
          <div className="panel flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
              <ShieldCheck size={13} className="text-deal" /> logged in as admin
            </span>
            <button
              type="button"
              onClick={() => {
                clearToken();
                setAuthed(false);
                onAuthChange?.(false);
                setInput("");
              }}
              className="text-[12px] font-medium text-accent hover:underline"
            >
              Log out
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="panel space-y-4 p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-subtle text-accent">
            <Lock size={17} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Admin requires a password</h2>
            <p className="text-[11.5px] text-ink-500">The ADMIN_TOKEN set in .env</p>
          </div>
        </div>

        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const v = input.trim();
            if (!v) return;
            setChecking(true);
            setError("");
            try {
              if (await verifyToken(v)) {
                setToken(v);
                setAuthed(true);
                onAuthChange?.(true);
              } else {
                setError("Wrong password");
              }
            } catch {
              setError("Cannot reach the server");
            } finally {
              setChecking(false);
            }
          }}
        >
          <div className="relative">
            <KeyRound size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full rounded-lg border border-ink-200 bg-surface py-2 pl-8 pr-2.5 text-[13px] text-ink-900 outline-none focus:border-brand"
            />
          </div>
          {error && <p className="text-[11.5px] text-alert">{error}</p>}
          <button
            type="submit"
            disabled={checking || !input.trim()}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {checking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Enter admin
          </button>
        </form>

        <p className="text-[11.5px] leading-relaxed text-ink-500">
          The password lives only in browser sessionStorage and dies with the tab. The feed and daily digest need no password. 
        </p>
      </div>
    </div>
  );
}
