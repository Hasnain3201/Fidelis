"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";
import { ContentPreviewPanel, type ContentPreview } from "./components/ContentPreviewPanel";
import DiscoveryPanel from "./components/DiscoveryPanel";
import QueueDashboard from "./components/QueueDashboard";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AdminScraperPage() {
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewEnableRender, setPreviewEnableRender] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ContentPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function handlePreviewSubmit(e: FormEvent) {
    e.preventDefault();
    setPreviewError(null);
    setPreviewResult(null);

    const trimmed = previewUrl.trim();
    if (!trimmed) {
      setPreviewError("URL is required.");
      return;
    }
    const session = getStoredAuthSession();
    if (!session) {
      setPreviewError("You must be logged in. Go to /login first.");
      return;
    }
    if (session.role !== "admin") {
      setPreviewError(`Your role is "${session.role}". Admin role is required.`);
      return;
    }

    try {
      setPreviewLoading(true);
      const response = await fetch(`${API_BASE}/api/v1/scraper/scrape/preview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ url: trimmed, enable_render: previewEnableRender }),
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setPreviewError(
          typeof data.detail === "string" ? data.detail : `Request failed (${response.status})`,
        );
        return;
      }
      setPreviewResult((data.content_preview as ContentPreview) ?? null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">Admin</p>
            <h1>Scraper</h1>
            <p className="meta">
              Queue a list of URLs to be scraped one-by-one in the background. Click any completed job to
              inspect its result, or use <strong>Rescrape</strong> to re-run it. The preview tool below
              fetches a single page without calling the AI.
            </p>
          </div>

          <DiscoveryPanel />

          <QueueDashboard />

          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ margin: "0 0 4px 0" }}>Preview a single page (no AI, no DB)</h2>
            <p className="meta" style={{ margin: "0 0 16px 0" }}>
              Useful for quickly inspecting what HTML the scraper sees before queuing a real job.
            </p>
            <form onSubmit={handlePreviewSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Input
                label="URL"
                type="url"
                placeholder="https://example.com"
                value={previewUrl}
                onChange={(e) => setPreviewUrl(e.target.value)}
                required
              />
              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={previewEnableRender}
                  onChange={(e) => setPreviewEnableRender(e.target.checked)}
                />
                <span className="meta" style={{ margin: 0 }}>
                  Enable JS rendering (slower; can surface more visible text on SPAs).
                </span>
              </label>
              <div>
                <Button type="submit" disabled={previewLoading}>
                  {previewLoading ? "Loading preview…" : "Preview page"}
                </Button>
              </div>
            </form>

            {previewError && (
              <div style={{ marginTop: 14, color: "#e74c3c" }}>
                <strong>Error:</strong> {previewError}
              </div>
            )}

            {previewResult && (
              <div style={{ marginTop: 18 }}>
                <ContentPreviewPanel preview={previewResult} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
