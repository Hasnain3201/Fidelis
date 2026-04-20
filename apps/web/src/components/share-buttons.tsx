"use client";

import { awardPoints } from "@/lib/points";

type ShareButtonsProps = {
  title: string;
  url?: string;
};

export function ShareButtons({ title, url }: ShareButtonsProps) {
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`Check out "${title}" on LIVEY 🎵`);

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`;
  const whatsappHref = `https://wa.me/?text=${encodedText}%20${encodedUrl}`;

  function handleShare() {
    awardPoints("share_event");
    window.dispatchEvent(new Event("livey:points"));
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a
        href={twitterHref}
        target="_blank"
        rel="noreferrer"
        onClick={handleShare}
        className="pageActionLink secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        aria-label="Share on X (Twitter)"
      >
        <span style={{ fontWeight: 800 }}>𝕏</span> Share
      </a>
      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        onClick={handleShare}
        className="pageActionLink secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        aria-label="Share on WhatsApp"
      >
        <span>💬</span> WhatsApp
      </a>
    </div>
  );
}
