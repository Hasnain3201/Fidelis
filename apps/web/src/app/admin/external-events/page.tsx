"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";

type ApiProvider = "ticketmaster" | "eventbrite" | "both";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function AdminExternalEventsPage() {
  const [zip, setZip] = useState("");
  const [countryCode, setCountryCode] = useState("US");
  const [provider, setProvider] = useState<ApiProvider>("ticketmaster");
  const [ticketmasterUpcomingOnly, setTicketmasterUpcomingOnly] = useState(true);
  const [includeEventbriteOrgEvents, setIncludeEventbriteOrgEvents] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setError(null);
    setResult(null);

    const z = zip.trim();
    if (!z) {
      setError("Enter a ZIP or postal code.");
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

    const params = new URLSearchParams({
      zip_code: z,
      provider,
      country_code: countryCode.trim().toUpperCase() || "US",
      ticketmaster_upcoming_only: String(ticketmasterUpcomingOnly),
      include_eventbrite_org_events: String(includeEventbriteOrgEvents),
    });
    const url = `${API_BASE}/api/v1/external-events/nearby-preview?${params.toString()}`;

    try {
      setLoading(true);
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        cache: "no-store",
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
            <h1>Nearby events (API preview)</h1>
            <p className="meta">
              Calls Ticketmaster Discovery and/or Eventbrite with your server API keys. Shows a short
              summary plus full JSON — nothing is saved to the database. Ticketmaster often returns 200
              with <code>page.totalElements: 0</code> (no <code>_embedded.events</code>); use the summary
              and try turning off “upcoming only” if you expect older or TBA rows.
            </p>
          </div>

          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <Button
                  type="button"
                  variant={provider === "ticketmaster" ? "primary" : "secondary"}
                  onClick={() => setProvider("ticketmaster")}
                >
                  Ticketmaster
                </Button>
                <Button
                  type="button"
                  variant={provider === "eventbrite" ? "primary" : "secondary"}
                  onClick={() => setProvider("eventbrite")}
                >
                  Eventbrite
                </Button>
                <Button
                  type="button"
                  variant={provider === "both" ? "primary" : "secondary"}
                  onClick={() => setProvider("both")}
                >
                  Both
                </Button>
              </div>

              <Input
                label="ZIP / postal code"
                type="text"
                placeholder="90210"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                autoComplete="postal-code"
              />

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  cursor: "pointer",
                  opacity: provider === "eventbrite" ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={ticketmasterUpcomingOnly}
                  disabled={provider === "eventbrite"}
                  onChange={(e) => setTicketmasterUpcomingOnly(e.target.checked)}
                />
                <span className="meta" style={{ margin: 0 }}>
                  Ticketmaster: upcoming only (start ≥ now UTC). Uncheck if you get zero events.
                </span>
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  cursor: "pointer",
                  opacity: provider === "ticketmaster" ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={includeEventbriteOrgEvents}
                  disabled={provider === "ticketmaster"}
                  onChange={(e) => setIncludeEventbriteOrgEvents(e.target.checked)}
                />
                <span className="meta" style={{ margin: 0 }}>
                  Also fetch Eventbrite org events (needs <code>EVENTBRITE_ORGANIZATION_ID</code> on the
                  API). Useful when public search is dead.
                </span>
              </label>

              <Input
                label="Ticketmaster country code (ISO alpha-2)"
                type="text"
                placeholder="US"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.slice(0, 2).toUpperCase())}
                disabled={provider === "eventbrite"}
              />
              {provider === "eventbrite" ? (
                <p className="meta" style={{ margin: 0 }}>
                  Country code applies to Ticketmaster only; Eventbrite uses the address string you enter
                  above.
                </p>
              ) : null}

              <Button type="button" onClick={() => void handleFetch()} fullWidth disabled={loading}>
                {loading ? "Fetching…" : `Fetch ${provider === "both" ? "both APIs" : provider}`}
              </Button>
            </div>
          </div>

          {error && (
            <div className="card" style={{ padding: 20, border: "2px solid #e74c3c" }}>
              <strong style={{ color: "#e74c3c" }}>Error</strong>
              <p style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{error}</p>
            </div>
          )}

          {result && (
            <div className="card" style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <strong style={{ color: "#14b87d" }}>Summary + raw JSON</strong>
                <span className="dashboardPill">{String(result.provider_requested ?? provider)}</span>
              </div>

              {"ticketmaster" in result && result.ticketmaster && typeof result.ticketmaster === "object" ? (
                <div
                  style={{
                    marginBottom: 20,
                    padding: 16,
                    borderRadius: 8,
                    background: "#f4fbf8",
                    border: "1px solid #14b87d",
                  }}
                >
                  <strong>Ticketmaster</strong>
                  {typeof (result.ticketmaster as { hint?: string }).hint === "string" ? (
                    <p className="meta" style={{ marginTop: 8, color: "#a65c00" }}>
                      {(result.ticketmaster as { hint: string }).hint}
                    </p>
                  ) : null}
                  {typeof (result.ticketmaster as { summary?: unknown }).summary === "object" &&
                  (result.ticketmaster as { summary: { events?: unknown[]; total_elements?: number } })
                    .summary !== null ? (
                    <div style={{ marginTop: 10 }}>
                      <p className="meta" style={{ margin: "0 0 8px 0" }}>
                        Total (API):{" "}
                        <strong>
                          {String(
                            (result.ticketmaster as { summary: { total_elements?: number } }).summary
                              .total_elements ?? "?",
                          )}
                        </strong>
                        ; in this page:{" "}
                        <strong>
                          {String(
                            (result.ticketmaster as { summary: { events_in_response?: number } }).summary
                              .events_in_response ?? "?",
                          )}
                        </strong>
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                        {(
                          (result.ticketmaster as { summary: { events?: Array<Record<string, unknown>> } })
                            .summary.events ?? []
                        )
                          .slice(0, 15)
                          .map((ev) => (
                            <li key={String(ev.id ?? ev.name ?? Math.random())} style={{ marginBottom: 6 }}>
                              <strong>{String(ev.name ?? "(no name)")}</strong>
                              {ev.local_date ? (
                                <span className="meta"> — {String(ev.local_date)}</span>
                              ) : null}
                              {ev.venue_name ? (
                                <span className="meta"> @ {String(ev.venue_name)}</span>
                              ) : null}
                            </li>
                          ))}
                      </ul>
                      {((
                        (result.ticketmaster as { summary: { events?: unknown[] } }).summary.events ?? []
                      ).length === 0 ? (
                        <p className="meta" style={{ margin: "8px 0 0 0" }}>
                          No events in this response. Raw <code>data</code> below may still show{" "}
                          <code>page.totalElements: 0</code>.
                        </p>
                      ) : null)}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {"eventbrite" in result && result.eventbrite && typeof result.eventbrite === "object" ? (
                <div
                  style={{
                    marginBottom: 20,
                    padding: 16,
                    borderRadius: 8,
                    background: "#fff8f0",
                    border: "1px solid #e67e22",
                  }}
                >
                  <strong>Eventbrite (search)</strong>
                  <p className="meta" style={{ marginTop: 8 }}>
                    Public location search is often deprecated; the API is still useful for orgs you own,
                    orders, and webhooks — see{" "}
                    <a href="https://www.eventbrite.com/platform/api" target="_blank" rel="noreferrer">
                      Eventbrite Platform API
                    </a>
                    . Event schedule APIs apply to events you control, not global discovery.
                  </p>
                  {(result.eventbrite as { ok?: boolean }).ok &&
                  typeof (result.eventbrite as { summary?: unknown }).summary === "object" &&
                  (result.eventbrite as { summary: { events?: unknown[] } }).summary ? (
                    <div style={{ marginTop: 10 }}>
                      <p className="meta" style={{ margin: "0 0 8px 0" }}>
                        In this page:{" "}
                        <strong>
                          {String(
                            (result.eventbrite as { summary: { events_in_response?: number } }).summary
                              .events_in_response ?? "?",
                          )}
                        </strong>
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
                        {(
                          (result.eventbrite as { summary: { events?: Array<Record<string, unknown>> } })
                            .summary.events ?? []
                        )
                          .slice(0, 15)
                          .map((ev) => (
                            <li key={String(ev.id ?? ev.name ?? Math.random())} style={{ marginBottom: 6 }}>
                              <strong>{String(ev.name ?? "(no name)")}</strong>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                  {(result.eventbrite as { ok?: boolean }).ok === false ? (
                    <p className="meta" style={{ marginTop: 8, color: "#c0392b" }}>
                      Search failed; check <code>organization_preview</code> in JSON if org fallback ran, or
                      enable “Also fetch Eventbrite org events”.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {"eventbrite_organization" in result &&
              result.eventbrite_organization &&
              typeof result.eventbrite_organization === "object" ? (
                <div
                  style={{
                    marginBottom: 20,
                    padding: 16,
                    borderRadius: 8,
                    background: "#f5f0ff",
                    border: "1px solid #7d3cff",
                  }}
                >
                  <strong>Eventbrite (organization)</strong>
                  {(result.eventbrite_organization as { summary?: { events?: Array<Record<string, unknown>> } })
                    .summary?.events ? (
                    <ul style={{ margin: "10px 0 0 0", paddingLeft: 20, fontSize: 14 }}>
                      {(
                        (result.eventbrite_organization as { summary: { events: Array<Record<string, unknown>> } })
                          .summary.events ?? []
                      )
                        .slice(0, 15)
                        .map((ev) => (
                          <li key={String(ev.id ?? ev.name ?? Math.random())} style={{ marginBottom: 6 }}>
                            <strong>{String(ev.name ?? "(no name)")}</strong>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="meta" style={{ marginTop: 8 }}>
                      {(result.eventbrite_organization as { ok?: boolean }).ok === false
                        ? String(
                            (result.eventbrite_organization as { error?: string }).error ??
                              "Could not load org events.",
                          )
                        : "No summary events."}
                    </p>
                  )}
                </div>
              ) : null}

              <pre
                style={{
                  background: "#0b1428",
                  color: "#e0e6f0",
                  padding: 16,
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.6,
                  overflow: "auto",
                  maxHeight: 700,
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
