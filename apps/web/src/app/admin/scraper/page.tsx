"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";

type ScrapeMode = "venues" | "events";
type PersistMode = "print" | "save";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AdminScraperPage() {
  const [mode, setMode] = useState<ScrapeMode>("events");
  const [persistMode, setPersistMode] = useState<PersistMode>("print");
  const [url, setUrl] = useState("");
  const [venueId, setVenueId] = useState("");
  const [loading, setLoading] = useState(false);
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

    const body: Record<string, unknown> = { url: trimmedUrl, enable_render: false };
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

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">Admin</p>
            <h1>Scraper Test</h1>
            <p className="meta">
              Scrape a venue or events page. Choose whether to print would-be inserts or save to Supabase.
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

              <Button type="submit" fullWidth disabled={loading}>
                {loading
                  ? "Scraping..."
                  : `Run ${mode === "venues" ? "Venue" : "Events"} Scrape (${persistMode === "print" ? "Print" : "Save"})`}
              </Button>
            </form>
          </div>

          {error && (
            <div className="card" style={{ padding: 20, border: "2px solid #e74c3c" }}>
              <strong style={{ color: "#e74c3c" }}>Error</strong>
              <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{error}</p>
            </div>
          )}

          {result && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <strong style={{ color: "#14b87d" }}>
                  Scrape Result ({persistMode === "print" ? "Print / Dry Run" : "Saved"})
                </strong>
                <span className="dashboardPill">{mode}</span>
              </div>
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
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
