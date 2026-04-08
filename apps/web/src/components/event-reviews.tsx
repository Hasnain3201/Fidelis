"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthChangeEventName, getStoredAuthSession, type AuthSession } from "@/lib/auth";

type Review = {
  id: string;
  rating: number;
  comment: string;
  author: string;
  date: string;
};

const REVIEWS_KEY = "livey.event.reviews";

function getReviews(eventId: string): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Review[]>) : {};
    return all[eventId] ?? [];
  } catch {
    return [];
  }
}

function saveReview(eventId: string, review: Review) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(REVIEWS_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Review[]>) : {};
    if (!all[eventId]) all[eventId] = [];
    all[eventId].unshift(review);
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(all));
  } catch {}
}

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star)}
          onMouseEnter={() => onChange && setHovered(star)}
          onMouseLeave={() => onChange && setHovered(0)}
          style={{
            background: "none",
            border: "none",
            cursor: onChange ? "pointer" : "default",
            fontSize: 22,
            color: star <= (hovered || value) ? "#f59e0b" : "#d1d5e0",
            padding: 0,
            lineHeight: 1,
          }}
          aria-label={`${star} star${star > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function EventReviews({ eventId }: { eventId: string }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    function syncSession() { setSession(getStoredAuthSession()); }
    syncSession();
    const authEvent = getAuthChangeEventName();
    window.addEventListener("storage", syncSession);
    window.addEventListener(authEvent, syncSession);
    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener(authEvent, syncSession);
    };
  }, []);

  useEffect(() => {
    setReviews(getReviews(eventId));
  }, [eventId]);

  function handleSubmit() {
    setError(null);
    if (rating === 0) { setError("Please select a rating."); return; }
    if (!comment.trim()) { setError("Please write a short review."); return; }

    const review: Review = {
      id: `${Date.now()}`,
      rating,
      comment: comment.trim(),
      author: session?.email?.split("@")[0] ?? "Anonymous",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    saveReview(eventId, review);
    setReviews(getReviews(eventId));
    setRating(0);
    setComment("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* Summary */}
      {reviews.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 32, fontWeight: 800, color: "#1c2334" }}>{avgRating}</span>
          <div>
            <StarRating value={Math.round(Number(avgRating))} />
            <p className="meta" style={{ margin: "2px 0 0", fontSize: 12 }}>{reviews.length} review{reviews.length > 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Write a review */}
      {session ? (
        <div style={{ borderRadius: 12, border: "1px solid #e3e7f1", background: "#f9fbff", padding: "14px 16px" }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 14 }}>Leave a Review</h4>
          <StarRating value={rating} onChange={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience..."
            maxLength={300}
            rows={3}
            className="uiTextArea"
            style={{ marginTop: 10, fontSize: 13 }}
          />
          {error && <p className="fieldError" style={{ marginTop: 4 }}>{error}</p>}
          {submitted && <p className="statusBanner success" style={{ marginTop: 6, padding: "6px 10px" }}>Review submitted!</p>}
          <button type="button" className="pageActionLink" style={{ marginTop: 8 }} onClick={handleSubmit}>
            Submit Review
          </button>
        </div>
      ) : (
        <div style={{ borderRadius: 12, border: "1px dashed #dce3f2", background: "#f8faff", padding: "12px 16px" }}>
          <p className="meta" style={{ margin: "0 0 8px", fontSize: 13 }}>
            <Link href="/login" style={{ color: "#7040ef", fontWeight: 700 }}>Log in</Link> or{" "}
            <Link href="/register" style={{ color: "#7040ef", fontWeight: 700 }}>create an account</Link> to leave a review.
          </p>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {reviews.map((r) => (
            <div key={r.id} style={{ borderRadius: 10, border: "1px solid #e3e7f1", background: "#fff", padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #8048ff, #6d35ea)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                    {r.author[0].toUpperCase()}
                  </div>
                  <strong style={{ fontSize: 13 }}>{r.author}</strong>
                </div>
                <StarRating value={r.rating} />
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#5a6278", lineHeight: 1.5 }}>{r.comment}</p>
              <p className="meta" style={{ margin: "6px 0 0", fontSize: 11 }}>{r.date}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyStateCard compact">
          <p className="meta" style={{ margin: 0 }}>No reviews yet. Be the first to share your experience!</p>
        </div>
      )}
    </div>
  );
}
