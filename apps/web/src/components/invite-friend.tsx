"use client";

import { useState } from "react";
import { awardPoints } from "@/lib/points";

function getInviteCode(): string {
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(8);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function getInviteLink(): string {
  if (typeof window === "undefined") return "https://liveyapp.com/join";
  const base = window.location.origin;
  const code = getInviteCode();
  return `${base}/join?ref=${code}`;
}

export function InviteFriendButton() {
  const [copied, setCopied] = useState(false);
  const [earned, setEarned] = useState(false);

  async function handleInvite() {
    const link = getInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
      if (!earned) {
        awardPoints("invite_friend");
        window.dispatchEvent(new Event("livey:points"));
        setEarned(true);
      }
    } catch {
      // fallback: prompt
      window.prompt("Copy this invite link:", link);
    }
  }

  return (
    <button
      type="button"
      onClick={handleInvite}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 13,
        fontWeight: 700,
        borderRadius: 10,
        padding: "9px 16px",
        background: copied ? "#efffed" : "linear-gradient(135deg,#8048ff,#6d35ea)",
        color: copied ? "#29a347" : "#fff",
        border: copied ? "1px solid #b8f0c4" : "none",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Link Copied! (+15 pts)" : "👥 Invite a Friend"}
    </button>
  );
}

export function InviteFriendCard() {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid #e0d5ff",
        background: "linear-gradient(135deg,#f8f5ff,#fff)",
        padding: "18px 20px",
      }}
    >
      <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>👥 Invite Friends</h3>
      <p className="meta" style={{ margin: "0 0 14px", fontSize: 13 }}>
        Share LIVEY with your crew and earn <strong>15 points</strong> per invite link copied.
      </p>
      <InviteFriendButton />
    </div>
  );
}
