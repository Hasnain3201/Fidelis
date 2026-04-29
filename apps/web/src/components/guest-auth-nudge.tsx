"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";
import { Modal } from "@/components/ui/modal";

const PROMPT_DELAY_MS = 45000;

function shouldSuppressOnPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/register");
}

export function GuestAuthNudge() {
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [open, setOpen] = useState(false);
  const hasShownThisRunRef = useRef(false);

  const suppressForPath = useMemo(() => shouldSuppressOnPath(pathname), [pathname]);

  useEffect(() => {
    function syncSession() {
      setSession(getStoredAuthSession());
    }

    syncSession();
    const authChangeEvent = getAuthChangeEventName();

    window.addEventListener("storage", syncSession);
    window.addEventListener(authChangeEvent, syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(authChangeEvent, syncSession);
    };
  }, []);

  useEffect(() => {
    if (session || suppressForPath) {
      setOpen(false);
      return;
    }

    if (hasShownThisRunRef.current) return;

    const timer = window.setTimeout(() => {
      setOpen(true);
      hasShownThisRunRef.current = true;
    }, PROMPT_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [session, suppressForPath, pathname]);

  function dismissPrompt() {
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      title="Join LIVEY"
      onClose={dismissPrompt}
      cardClassName="authNudgeCard"
      headerClassName="authNudgeHeader"
      bodyClassName="authNudgeBody"
      actionsClassName="authNudgeFooter"
      actions={
        <div className="authNudgeActions">
          <Link href="/register" className="uiButton uiButtonPrimary authNudgeAction" onClick={dismissPrompt}>
            Create Account
          </Link>
          <Link href="/login" className="uiButton uiButtonSecondary authNudgeAction" onClick={dismissPrompt}>
            Sign In
          </Link>
          <button type="button" className="authNudgeLater" onClick={dismissPrompt}>
            Keep Browsing
          </button>
        </div>
      }
    >
      <p className="authNudgeEyebrow">Guest Mode</p>
      <p className="authNudgeLead">Save your picks.</p>
      <p className="authNudgeSub">Favorites, follows, and tailored recommendations.</p>
    </Modal>
  );
}
