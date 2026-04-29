"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface DiscoveryResult {
  zip_code: string;
  radius_miles: number;
  coordinates: { lat: number; lng: number };
  batch_id: string | null;
  venue_urls_queued: number;
  venue_urls: string[];
  ticketmaster: { venues_saved: number; events_saved: number };
  sources: {
    ticketmaster_events: number;
    foursquare_venues: number;
    osm_venues: number;
  };
}

const SAMPLE_SIZE = 8;

export default function DiscoveryPanel() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("10");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);

  async function handleRun() {
    setError(null);
    setResult(null);

    const z = zip.trim();
    if (!z) {
      setError("Enter a ZIP code.");
      return;
    }
    const r = parseInt(radius.trim(), 10);
    if (!r || r < 1 || r > 200) {
      setError("Radius must be between 1 and 200 miles.");
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
      setLoading(true);
      const resp = await fetch(`${API_BASE}/api/v1/discovery/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          zip_code: z,
          radius_miles: r,
          upcoming_only: upcomingOnly,
        }),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      if (!resp.ok) {
        setError(
          typeof data.detail === "string" ? data.detail : `Request failed (${resp.status})`,
        );
        return;
      }
      setResult(data as unknown as DiscoveryResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h2 style={{ margin: "0 0 4px 0" }}>Discover venues (automated)</h2>
      <p className="meta" style={{ margin: "0 0 16px 0" }}>
        Enter a ZIP code and radius. Queries Ticketmaster, Foursquare, and OpenStreetMap to find
        venues nearby. Discovered venue websites are added to the scrape queue below — they will not
        be scraped until you click <strong>Start Scraping</strong> in the Worker section.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <div style={{ flex: "1 1 160px" }}>
            <Input
              label="ZIP code"
              type="text"
              placeholder="10004"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              autoComplete="postal-code"
            />
          </div>
          <div style={{ flex: "1 1 120px" }}>
            <Input
              label="Radius (miles)"
              type="number"
              placeholder="10"
              value={radius}
              onChange={(e) => setRadius(e.target.value)}
              min={1}
              max={200}
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={upcomingOnly}
            onChange={(e) => setUpcomingOnly(e.target.checked)}
          />
          <span className="meta" style={{ margin: 0 }}>
            Ticketmaster: upcoming events only (uncheck to include past)
          </span>
        </label>

        <div>
          <Button type="button" onClick={() => void handleRun()} disabled={loading}>
            {loading ? "Discovering…" : "Discover"}
          </Button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 14, color: "#e74c3c", fontSize: 13 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div
          style={{
            marginTop: 18,
            padding: 16,
            borderRadius: 10,
            border: "1px solid rgba(20, 184, 125, 0.35)",
            background: "rgba(20, 184, 125, 0.06)",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#14b87d", marginBottom: 6 }}>
            Discovery complete · {result.zip_code} ({result.radius_miles} mi radius)
          </div>
          <p className="meta" style={{ margin: "0 0 12px 0", fontSize: 13 }}>
            Found <strong>{result.sources.ticketmaster_events}</strong> Ticketmaster events,{" "}
            <strong>{result.sources.foursquare_venues}</strong> Foursquare venues,{" "}
            <strong>{result.sources.osm_venues}</strong> OSM venues.
            {result.ticketmaster.venues_saved > 0 || result.ticketmaster.events_saved > 0 ? (
              <>
                {" "}Saved{" "}
                <strong>{result.ticketmaster.venues_saved}</strong> venues and{" "}
                <strong>{result.ticketmaster.events_saved}</strong> events from Ticketmaster
                directly.
              </>
            ) : null}
          </p>
          <p style={{ margin: "0 0 10px 0", fontSize: 13 }}>
            <strong>{result.venue_urls_queued}</strong> venue website URL
            {result.venue_urls_queued === 1 ? "" : "s"} added to the scrape queue. Click{" "}
            <strong>Start Scraping</strong> below to begin processing.
          </p>

          {result.venue_urls.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#94a3b8",
                  userSelect: "none",
                }}
              >
                Sample of queued URLs (showing {Math.min(SAMPLE_SIZE, result.venue_urls.length)} of{" "}
                {result.venue_urls.length})
              </summary>
              <ul
                style={{
                  margin: "8px 0 0 0",
                  paddingLeft: 18,
                  fontSize: 12,
                  color: "#cbd5e1",
                }}
              >
                {result.venue_urls.slice(0, SAMPLE_SIZE).map((url) => (
                  <li key={url} style={{ marginBottom: 3 }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#7d3cff" }}
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
