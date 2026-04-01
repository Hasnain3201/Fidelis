"use client";

import { type CSSProperties, type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";

type ScrapeMode = "venues" | "events";
type PersistMode = "print" | "save";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ContentPreview = {
  url?: string;
  title?: string;
  domain?: string;
  description?: string;
  phones?: string[];
  emails?: string[];
  render_used?: boolean;
};

const previewRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(88px, 110px) 1fr",
  gap: "8px 12px",
  alignItems: "start",
  marginBottom: 12,
  maxWidth: "100%",
};

const previewLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#14b87d",
  margin: 0,
};

const previewValueStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  maxWidth: "100%",
};

function ContentPreviewPanel({ preview }: { preview: ContentPreview }) {
  const phones = preview.phones ?? [];
  const emails = preview.emails ?? [];

  return (
    <div
      style={{
        marginBottom: 24,
        padding: 20,
        borderRadius: 12,
        border: "1px solid rgba(20, 184, 125, 0.35)",
        background: "rgba(20, 184, 125, 0.06)",
        maxWidth: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <h2 style={{ margin: "0 0 4px 0", fontSize: "1.1rem" }}>Content preview</h2>
      <p className="meta" style={{ margin: "0 0 16px 0" }}>
        Fetched page summary (before AI).
        {preview.render_used ? " JS render was used." : ""}
      </p>

      <div style={{ maxWidth: "100%" }}>
        <div style={previewRowStyle}>
          <p style={previewLabelStyle}>URL</p>
          <p style={previewValueStyle}>
            {preview.url ? (
              <a href={preview.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                {preview.url}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div style={previewRowStyle}>
          <p style={previewLabelStyle}>Title</p>
          <p style={previewValueStyle}>
            <strong>{preview.title?.trim() ? preview.title : "(no title)"}</strong>
          </p>
        </div>
        <div style={previewRowStyle}>
          <p style={previewLabelStyle}>Description</p>
          <p style={previewValueStyle}>
            {preview.description?.trim() ? preview.description : (
              <span className="meta">No meta description (og:description / description / twitter:description)</span>
            )}
          </p>
        </div>
        <div style={previewRowStyle}>
          <p style={previewLabelStyle}>Domain</p>
          <p style={previewValueStyle}>{preview.domain?.trim() ? preview.domain : "—"}</p>
        </div>
        <div style={previewRowStyle}>
          <p style={previewLabelStyle}>Phone</p>
          <div style={previewValueStyle}>
            {phones.length === 0 ? (
              <span className="meta">No phone patterns detected</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {phones.map((p) => (
                  <li key={p} style={{ marginBottom: 4 }}>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div style={{ ...previewRowStyle, marginBottom: 0 }}>
          <p style={previewLabelStyle}>Email</p>
          <div style={previewValueStyle}>
            {emails.length === 0 ? (
              <span className="meta">No email patterns detected</span>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {emails.map((e) => (
                  <li key={e} style={{ marginBottom: 4 }}>
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Keep the JSON panel narrow: omit huge text_content / structured blobs from API payload. */
function lightenResultForDisplay(data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data };
  const cp = out.content_preview;
  if (cp && typeof cp === "object" && cp !== null) {
    const p = cp as Record<string, unknown>;
    const slim: Record<string, unknown> = {
      url: p.url,
      title: p.title,
      domain: p.domain,
      description: p.description,
      phones: p.phones,
      emails: p.emails,
      render_used: p.render_used,
    };
    if (typeof p.text_content === "string") {
      slim.text_content_omitted_chars = p.text_content.length;
    }
    out.content_preview = slim;
  }
  return out;
}

export default function AdminScraperPage() {
  const [mode, setMode] = useState<ScrapeMode>("events");
  const [persistMode, setPersistMode] = useState<PersistMode>("print");
  const [url, setUrl] = useState("");
  const [venueId, setVenueId] = useState("");
  const [enableRender, setEnableRender] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("URL is required.");
      return;
    }

    const session = getStoredAuthSession();
    if (!session) {
      setError("You must be logged in. Go to /login first.");
      return;
    }

    if (session.role !== "admin") {
      setError(`Your role is "${session.role}". Admin role is required to use the scraper.`);
      return;
    }

    const dryRun = persistMode === "print";
    const endpoint =
      mode === "venues"
        ? `${API_BASE}/api/v1/scraper/scrape/venues?dry_run=${String(dryRun)}`
        : `${API_BASE}/api/v1/scraper/scrape/events?dry_run=${String(dryRun)}`;

    const body: Record<string, unknown> = { url: trimmedUrl, enable_render: enableRender };
    if (mode === "events" && venueId.trim()) {
      body.venue_id = venueId.trim();
    }

    try {
      setLoading(true);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        setError(
          typeof data.detail === "string"
            ? data.detail
            : `Request failed (${response.status})`,
        );
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewOnly() {
    setError(null);
    setResult(null);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("URL is required.");
      return;
    }

    const session = getStoredAuthSession();
    if (!session) {
      setError("You must be logged in. Go to /login first.");
      return;
    }

    if (session.role !== "admin") {
      setError(`Your role is "${session.role}". Admin role is required.`);
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
        body: JSON.stringify({ url: trimmedUrl, enable_render: enableRender }),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        setError(
          typeof data.detail === "string"
            ? data.detail
            : `Request failed (${response.status})`,
        );
        return;
      }

      setResult({
        preview_only: true,
        content_preview: data.content_preview,
        success: data.success,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setPreviewLoading(false);
    }
  }

  const contentPreview =
    result && typeof result.content_preview === "object" && result.content_preview !== null
      ? (result.content_preview as ContentPreview)
      : null;

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">Admin</p>
            <h1>Scraper Test</h1>
            <p className="meta">
              Scrape a venue or events page. A short <strong>content preview</strong> (URL, title, description,
              domain, deduped phones/emails) is shown before the full JSON. Use &quot;Preview page only&quot; to
              fetch HTML without calling the model.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <Button
                  type="button"
                  variant={mode === "venues" ? "primary" : "secondary"}
                  onClick={() => setMode("venues")}
                >
                  Venue Scrape
                </Button>
                <Button
                  type="button"
                  variant={mode === "events" ? "primary" : "secondary"}
                  onClick={() => setMode("events")}
                >
                  Events Scrape
                </Button>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <Button
                  type="button"
                  variant={persistMode === "print" ? "primary" : "secondary"}
                  onClick={() => setPersistMode("print")}
                >
                  Print (Dry Run)
                </Button>
                <Button
                  type="button"
                  variant={persistMode === "save" ? "primary" : "secondary"}
                  onClick={() => setPersistMode("save")}
                >
                  Save to Supabase
                </Button>
              </div>

              <label style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={enableRender}
                  onChange={(e) => setEnableRender(e.target.checked)}
                />
                <span className="meta" style={{ margin: 0 }}>
                  Enable JS rendering (slower; can surface more visible text on SPAs).
                </span>
              </label>

              <Input
                label="URL to scrape"
                type="url"
                placeholder="https://example-venue.com/events"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />

              {mode === "events" && (
                <Input
                  label="Venue ID (optional)"
                  type="text"
                  placeholder="Leave blank to auto-detect venue"
                  value={venueId}
                  onChange={(e) => setVenueId(e.target.value)}
                />
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <Button type="submit" disabled={loading || previewLoading}>
                  {loading
                    ? "Scraping..."
                    : `Run ${mode === "venues" ? "Venue" : "Events"} (${persistMode === "print" ? "Print" : "Save"})`}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || previewLoading}
                  onClick={() => void handlePreviewOnly()}
                >
                  {previewLoading ? "Loading preview…" : "Preview page only (no AI)"}
                </Button>
              </div>
            </form>
          </div>

          {error && (
            <div className="card" style={{ padding: 20, border: "2px solid #e74c3c" }}>
              <strong style={{ color: "#e74c3c" }}>Error</strong>
              <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{error}</p>
            </div>
          )}

          {result && contentPreview && <ContentPreviewPanel preview={contentPreview} />}

          {result && (
            <div
              className="card"
              style={{ padding: 20, maxWidth: "100%", boxSizing: "border-box", overflow: "hidden" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <strong style={{ color: "#14b87d" }}>
                  {result.preview_only === true
                    ? "Preview-only response"
                    : `Full scrape result (${persistMode === "print" ? "Print / Dry Run" : "Saved"})`}
                </strong>
                <span className="dashboardPill">{result.preview_only === true ? "preview" : mode}</span>
              </div>
              <p className="meta" style={{ margin: "0 0 8px 0" }}>
                JSON below omits raw <code>text_content</code> for readability; length is in{" "}
                <code>content_preview.text_content_omitted_chars</code> when present.
              </p>
              <pre
                style={{
                  background: "#0b1428",
                  color: "#e0e6f0",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.6,
                  overflow: "auto",
                  maxHeight: 600,
                  maxWidth: "100%",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(lightenResultForDisplay(result), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
