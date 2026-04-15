"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const POLL_MS = 3000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TmEventPreview {
  id: string;
  name: string;
  url?: string;
  local_date?: string;
  venue_name?: string;
}

interface FsqVenuePreview {
  name?: string;
  website?: string;
  city?: string;
}

interface OsmVenuePreview {
  name?: string;
  amenity?: string;
  website?: string;
}

interface DebugSource<T> {
  ok: boolean | null;
  error: string | null;
  raw_error?: unknown;
  status_code?: number | null;
  hint?: string | null;
  total_elements?: number | null;
  events_in_response?: number | null;
  venue_count?: number;
  element_count?: number;
  events?: T[];
  venues?: T[];
}

interface DiscoveryResult {
  zip_code: string;
  radius_miles: number;
  coordinates: { lat: number; lng: number };
  batch_id: string | null;
  venue_urls_queued: number;
  venue_urls: string[];
  ticketmaster: { venues_saved: number; events_saved: number };
  sources: { ticketmaster_events: number; foursquare_venues: number; osm_venues: number };
  debug: {
    ticketmaster: DebugSource<TmEventPreview>;
    foursquare: DebugSource<FsqVenuePreview>;
    osm: DebugSource<OsmVenuePreview>;
  };
}

interface BatchStatus {
  batch_id: string;
  total_jobs: number;
  by_status: Record<string, number>;
  jobs: ScrapeJob[];
}

interface ScrapeJob {
  id: string;
  url: string;
  mode: string;
  status: string;
  created_at: string;
  completed_at?: string;
  error?: string;
  result?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Small shared components
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: "#7b8396",
  in_progress: "#e6a817",
  completed: "#14b87d",
  failed: "#e74c3c",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        background: STATUS_COLORS[status] ?? "#7b8396",
        color: "#fff",
      }}
    >
      {status}
    </span>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        padding: "14px 18px",
        borderRadius: 10,
        background: "var(--canvas, #f2f3f8)",
        border: "1px solid var(--line, #e3e7f1)",
        textAlign: "center",
      }}
    >
      <div
        style={{ fontSize: 26, fontWeight: 700, color: color ?? "var(--ink, #1c2334)" }}
      >
        {value}
      </div>
      <div style={{ fontSize: 13, color: "var(--muted, #7b8396)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SourcePanel({
  title,
  ok,
  error,
  hint,
  accentColor,
  children,
}: {
  title: string;
  ok: boolean | null;
  error: string | null;
  hint?: string | null;
  accentColor: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 18,
        borderRadius: 10,
        border: `1px solid ${ok ? accentColor : "#e74c3c"}`,
        background: ok ? `${accentColor}0d` : "#fff5f5",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: error || hint ? 10 : children ? 12 : 0,
        }}
      >
        <strong style={{ fontSize: 15 }}>{title}</strong>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 99,
            background: ok ? accentColor : "#e74c3c",
            color: "#fff",
          }}
        >
          {ok === null ? "—" : ok ? "OK" : "ERROR"}
        </span>
      </div>
      {error && (
        <p style={{ margin: "0 0 10px 0", color: "#e74c3c", fontSize: 13 }}>
          <strong>Error:</strong> {error}
        </p>
      )}
      {hint && (
        <p style={{ margin: "0 0 10px 0", color: "#a65c00", fontSize: 13 }}>
          <strong>Hint:</strong> {hint}
        </p>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDiscoveryPage() {
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState("10");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showUrls, setShowUrls] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBatchStatus = useCallback(async (batchId: string) => {
    const session = getStoredAuthSession();
    if (!session) return;
    try {
      const resp = await fetch(`${API_BASE}/api/v1/discovery/status/${batchId}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!resp.ok) return;
      const data = (await resp.json()) as BatchStatus;
      setBatchStatus(data);
      const pending = (data.by_status.pending ?? 0) + (data.by_status.in_progress ?? 0);
      if (pending === 0 && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    } catch {
      // swallow polling errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleRun() {
    setError(null);
    setResult(null);
    setBatchStatus(null);
    setExpandedJob(null);

    const z = zip.trim();
    if (!z) { setError("Enter a ZIP code."); return; }
    const r = parseInt(radius.trim(), 10);
    if (!r || r < 1 || r > 200) { setError("Radius must be between 1 and 200 miles."); return; }

    const session = getStoredAuthSession();
    if (!session) { setError("You must be logged in. Go to /login first."); return; }
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
        body: JSON.stringify({ zip_code: z, radius_miles: r, upcoming_only: upcomingOnly }),
      });
      const data = (await resp.json()) as Record<string, unknown>;
      if (!resp.ok) {
        setError(typeof data.detail === "string" ? data.detail : `Request failed (${resp.status})`);
        return;
      }
      const discoveryResult = data as unknown as DiscoveryResult;
      setResult(discoveryResult);

      if (discoveryResult.batch_id) {
        void fetchBatchStatus(discoveryResult.batch_id);
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(
          () => void fetchBatchStatus(discoveryResult.batch_id!),
          POLL_MS,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const allDone =
    batchStatus &&
    (batchStatus.by_status.pending ?? 0) === 0 &&
    (batchStatus.by_status.in_progress ?? 0) === 0;

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">

          {/* Hero */}
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">Admin</p>
            <h1>Venue &amp; Event Discovery</h1>
            <p className="meta">
              Enter a ZIP code and radius. Queries Ticketmaster, Foursquare, and OpenStreetMap in
              parallel — Ticketmaster events are saved immediately, discovered venue websites are
              queued for AI scraping. All API responses are shown below so you can see exactly what
              each source returned.
            </p>
          </div>

          {/* Form */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
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
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={upcomingOnly}
                  onChange={(e) => setUpcomingOnly(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Ticketmaster: upcoming events only
                <span className="meta" style={{ fontSize: 12 }}>(uncheck to include past events)</span>
              </label>
              <Button type="button" onClick={() => void handleRun()} fullWidth disabled={loading}>
                {loading ? "Running discovery…" : "Run Discovery"}
              </Button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="card" style={{ padding: 20, border: "2px solid #e74c3c" }}>
              <strong style={{ color: "#e74c3c" }}>Error</strong>
              <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Top-line summary */}
              <div className="card" style={{ padding: 24 }}>
                <strong style={{ fontSize: 17, color: "#14b87d" }}>
                  {result.zip_code} · {result.radius_miles} mi radius &nbsp;
                  <span className="meta" style={{ fontSize: 13, fontWeight: 400 }}>
                    ({result.coordinates.lat.toFixed(4)}, {result.coordinates.lng.toFixed(4)})
                  </span>
                </strong>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
                  <StatBox label="TM events found" value={result.sources.ticketmaster_events} color="#7d3cff" />
                  <StatBox label="FSQ venues found" value={result.sources.foursquare_venues} color="#e6a817" />
                  <StatBox label="OSM venues found" value={result.sources.osm_venues} color="#2196f3" />
                  <StatBox label="TM venues saved" value={result.ticketmaster.venues_saved} color="#14b87d" />
                  <StatBox label="TM events saved" value={result.ticketmaster.events_saved} color="#14b87d" />
                  <StatBox label="URLs queued" value={result.venue_urls_queued} color="#7d3cff" />
                </div>

                {result.batch_id && (
                  <p className="meta" style={{ marginTop: 14, fontSize: 12 }}>
                    Batch ID: <code>{result.batch_id}</code>
                  </p>
                )}
              </div>

              {/* ── Per-source debug panels ── */}
              <div className="card" style={{ padding: 24 }}>
                <h2 style={{ margin: "0 0 16px 0", fontSize: 16 }}>API responses per source</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Ticketmaster */}
                  <SourcePanel
                    title="Ticketmaster Discovery API"
                    ok={result.debug.ticketmaster.ok}
                    error={result.debug.ticketmaster.error}
                    hint={result.debug.ticketmaster.hint}
                    accentColor="#7d3cff"
                  >
                    <p className="meta" style={{ margin: "0 0 8px 0", fontSize: 13 }}>
                      Total in API:{" "}
                      <strong>{result.debug.ticketmaster.total_elements ?? "?"}</strong>
                      &nbsp;·&nbsp; In this response:{" "}
                      <strong>{result.debug.ticketmaster.events_in_response ?? "?"}</strong>
                    </p>
                    {(result.debug.ticketmaster.events ?? []).length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                        {(result.debug.ticketmaster.events ?? []).map((ev) => (
                          <li key={ev.id ?? ev.name} style={{ marginBottom: 4 }}>
                            <strong>{ev.name}</strong>
                            {ev.local_date && (
                              <span className="meta"> — {ev.local_date}</span>
                            )}
                            {ev.venue_name && (
                              <span className="meta"> @ {ev.venue_name}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : result.debug.ticketmaster.ok ? (
                      <p className="meta" style={{ margin: 0, fontSize: 13 }}>
                        No events returned. Try increasing the radius or unchecking
                        upcoming-only in the raw API.
                      </p>
                    ) : null}
                  </SourcePanel>

                  {/* Foursquare */}
                  <SourcePanel
                    title="Foursquare Places API"
                    ok={result.debug.foursquare.ok}
                    error={result.debug.foursquare.error}
                    accentColor="#e6a817"
                  >
                    {result.debug.foursquare.status_code != null && (
                      <p className="meta" style={{ margin: "0 0 8px 0", fontSize: 13 }}>
                        HTTP status: <strong>{result.debug.foursquare.status_code}</strong>
                        &nbsp;·&nbsp; Venues returned:{" "}
                        <strong>{result.debug.foursquare.venue_count ?? 0}</strong>
                      </p>
                    )}
                    {result.debug.foursquare.raw_error != null && (
                      <pre style={{ margin: "0 0 10px 0", fontSize: 12, background: "#fff0f0", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                        {typeof result.debug.foursquare.raw_error === "string"
                          ? result.debug.foursquare.raw_error
                          : JSON.stringify(result.debug.foursquare.raw_error, null, 2)}
                      </pre>
                    )}
                    {(result.debug.foursquare.venues ?? []).length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                        {(result.debug.foursquare.venues ?? []).map((v, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>
                            <strong>{v.name ?? "(no name)"}</strong>
                            {v.city && <span className="meta"> — {v.city}</span>}
                            {v.website ? (
                              <span className="meta">
                                {" "}
                                ·{" "}
                                <a
                                  href={v.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "#e6a817" }}
                                >
                                  {v.website}
                                </a>
                              </span>
                            ) : (
                              <span className="meta" style={{ color: "#e74c3c" }}>
                                {" "}· no website
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : result.debug.foursquare.ok ? (
                      <p className="meta" style={{ margin: 0, fontSize: 13 }}>
                        No venues returned for this location.
                      </p>
                    ) : null}
                  </SourcePanel>

                  {/* OSM */}
                  <SourcePanel
                    title="OpenStreetMap (Overpass API)"
                    ok={result.debug.osm.ok}
                    error={result.debug.osm.error}
                    accentColor="#2196f3"
                  >
                    {result.debug.osm.status_code != null && (
                      <p className="meta" style={{ margin: "0 0 8px 0", fontSize: 13 }}>
                        HTTP status: <strong>{result.debug.osm.status_code}</strong>
                        &nbsp;·&nbsp; Elements returned:{" "}
                        <strong>{result.debug.osm.element_count ?? 0}</strong>
                      </p>
                    )}
                    {(result.debug.osm.venues ?? []).length > 0 ? (
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                        {(result.debug.osm.venues ?? []).map((v, i) => (
                          <li key={i} style={{ marginBottom: 4 }}>
                            <strong>{v.name ?? "(unnamed)"}</strong>
                            <span className="meta"> [{v.amenity}]</span>
                            {v.website ? (
                              <span className="meta">
                                {" "}
                                ·{" "}
                                <a
                                  href={v.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: "#2196f3" }}
                                >
                                  {v.website}
                                </a>
                              </span>
                            ) : (
                              <span className="meta" style={{ color: "#e74c3c" }}>
                                {" "}· no website
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : result.debug.osm.ok ? (
                      <p className="meta" style={{ margin: 0, fontSize: 13 }}>
                        No named elements returned for this location.
                      </p>
                    ) : null}
                  </SourcePanel>

                </div>
              </div>

              {/* Collected venue URLs */}
              {result.venue_urls_queued > 0 && (
                <div className="card" style={{ padding: 20 }}>
                  <button
                    type="button"
                    onClick={() => setShowUrls((v) => !v)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--ink, #1c2334)",
                      padding: 0,
                    }}
                  >
                    {showUrls ? "▲" : "▼"} Queued venue URLs ({result.venue_urls_queued})
                  </button>
                  {showUrls && (
                    <ul style={{ margin: "12px 0 0 0", paddingLeft: 18, fontSize: 13 }}>
                      {(result.venue_urls ?? []).map((url) => (
                        <li key={url} style={{ marginBottom: 4 }}>
                          <a href={url} target="_blank" rel="noreferrer" style={{ color: "#7d3cff" }}>
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Scrape jobs progress */}
              {batchStatus && (
                <div className="card" style={{ padding: 24 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <strong style={{ fontSize: 16 }}>
                      Scrape jobs — {batchStatus.total_jobs} total
                    </strong>
                    {allDone ? (
                      <span style={{ color: "#14b87d", fontWeight: 600, fontSize: 13 }}>
                        ✓ All jobs finished
                      </span>
                    ) : (
                      <span style={{ color: "#e6a817", fontSize: 13 }}>
                        Polling every {POLL_MS / 1000}s…
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
                    {Object.entries(batchStatus.by_status).map(([s, count]) => (
                      <div
                        key={s}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          background: STATUS_COLORS[s] ? `${STATUS_COLORS[s]}18` : "#f2f3f8",
                          border: `1px solid ${STATUS_COLORS[s] ?? "#e3e7f1"}`,
                          fontSize: 14,
                          fontWeight: 600,
                          color: STATUS_COLORS[s] ?? "#7b8396",
                        }}
                      >
                        {count} {s}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {batchStatus.jobs.slice(0, 100).map((job) => (
                      <div
                        key={job.id}
                        style={{
                          border: "1px solid var(--line, #e3e7f1)",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 14px",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <StatusBadge status={job.status} />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "var(--ink, #1c2334)",
                            }}
                          >
                            {job.url}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--muted, #7b8396)",
                              whiteSpace: "nowrap",
                              marginLeft: "auto",
                              paddingLeft: 8,
                            }}
                          >
                            {job.mode} {expandedJob === job.id ? "▲" : "▼"}
                          </span>
                        </button>
                        {expandedJob === job.id && (
                          <div
                            style={{
                              padding: "12px 14px",
                              borderTop: "1px solid var(--line, #e3e7f1)",
                              background: "var(--canvas, #f2f3f8)",
                            }}
                          >
                            {job.error && (
                              <p style={{ color: "#e74c3c", fontSize: 13, margin: "0 0 8px 0" }}>
                                <strong>Error:</strong> {job.error}
                              </p>
                            )}
                            {job.result ? (
                              <pre
                                style={{
                                  background: "#0b1428",
                                  color: "#e0e6f0",
                                  padding: 12,
                                  borderRadius: 6,
                                  fontSize: 12,
                                  overflow: "auto",
                                  maxHeight: 300,
                                  margin: 0,
                                }}
                              >
                                {JSON.stringify(job.result, null, 2)}
                              </pre>
                            ) : (
                              !job.error && (
                                <p className="meta" style={{ margin: 0, fontSize: 13 }}>
                                  No result yet.
                                </p>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {batchStatus.jobs.length > 100 && (
                      <p className="meta" style={{ fontSize: 13, margin: "4px 0 0 0" }}>
                        Showing first 100 of {batchStatus.jobs.length} jobs.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Raw JSON */}
              <div className="card" style={{ padding: 20 }}>
                <button
                  type="button"
                  onClick={() => setShowRawJson((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--muted, #7b8396)",
                    padding: 0,
                  }}
                >
                  {showRawJson ? "▲ Hide full JSON response" : "▼ Show full JSON response"}
                </button>
                {showRawJson && (
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
                      marginTop: 12,
                    }}
                  >
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
