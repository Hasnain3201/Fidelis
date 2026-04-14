"use client";

import { type CSSProperties, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";
import {
  ContentPreviewPanel,
  lightenResultForDisplay,
  type ContentPreview,
} from "./ContentPreviewPanel";

type ScrapeMode = "venue" | "events";
type JobStatus = "pending" | "in_progress" | "completed" | "failed";

type ScrapeJob = {
  id: string;
  batch_id: string | null;
  url: string;
  mode: ScrapeMode;
  status: JobStatus;
  enable_render: boolean;
  dry_run: boolean;
  venue_id_hint: string | null;
  attempts: number;
  result: Record<string, unknown> | null;
  content_preview: ContentPreview | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const POLL_MS = 3000;

const STATUS_ORDER: JobStatus[] = ["in_progress", "pending", "completed", "failed"];

const STATUS_LABEL: Record<JobStatus, string> = {
  in_progress: "In progress",
  pending: "Pending",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_COLOR: Record<JobStatus, string> = {
  in_progress: "#f59e0b",
  pending: "#94a3b8",
  completed: "#14b87d",
  failed: "#e74c3c",
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        background: `${STATUS_COLOR[status]}22`,
        color: STATUS_COLOR[status],
        border: `1px solid ${STATUS_COLOR[status]}55`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const cardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
  marginBottom: 10,
  maxWidth: "100%",
  boxSizing: "border-box",
};

function JobCard({
  job,
  expanded,
  onToggle,
  onRescrape,
  rescraping,
  onDelete,
  deleting,
}: {
  job: ScrapeJob;
  expanded: boolean;
  onToggle: () => void;
  onRescrape: () => void;
  rescraping: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const canExpand = job.status === "completed" || job.status === "failed";
  const canRescrape = job.status === "completed" || job.status === "failed";

  return (
    <div style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          cursor: canExpand ? "pointer" : "default",
        }}
        onClick={() => {
          if (canExpand) onToggle();
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <StatusBadge status={job.status} />
            <span className="meta" style={{ fontSize: 11 }}>
              {job.mode}
            </span>
            {job.dry_run && (
              <span className="meta" style={{ fontSize: 11 }}>
                · dry-run
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={job.url}
          >
            {job.url}
          </div>
          <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
            created {formatTime(job.created_at)}
            {job.completed_at && ` · finished ${formatTime(job.completed_at)}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {canRescrape && (
            <Button
              type="button"
              variant="secondary"
              disabled={rescraping}
              onClick={(e) => {
                e.stopPropagation();
                onRescrape();
              }}
            >
              {rescraping ? "..." : "Rescrape"}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={deleting || job.status === "in_progress"}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{ color: "#e74c3c" }}
          >
            {deleting ? "..." : "Delete"}
          </Button>
        </div>
      </div>

      {expanded && job.status === "failed" && job.error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 6,
            background: "rgba(231, 76, 60, 0.08)",
            border: "1px solid rgba(231, 76, 60, 0.35)",
            color: "#f5b7b1",
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {job.error}
        </div>
      )}

      {expanded && job.status === "completed" && (
        <div style={{ marginTop: 12 }}>
          {job.content_preview && <ContentPreviewPanel preview={job.content_preview} />}
          <pre
            style={{
              background: "#0b1428",
              color: "#e0e6f0",
              padding: 16,
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
              overflow: "auto",
              maxHeight: 500,
              maxWidth: "100%",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {JSON.stringify(
              lightenResultForDisplay({
                result: job.result,
                content_preview: job.content_preview,
              }),
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function QueueDashboard() {
  const [mode, setMode] = useState<ScrapeMode>("events");
  const [urlsText, setUrlsText] = useState("");
  const [venueId, setVenueId] = useState("");
  const [enableRender, setEnableRender] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const fetchJobs = useCallback(async () => {
    const session = getStoredAuthSession();
    if (!session) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue?limit=100`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) return;
      const data = (await response.json()) as { jobs: ScrapeJob[] };
      setJobs(data.jobs ?? []);
    } catch {
      // swallow polling errors
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    const id = window.setInterval(() => void fetchJobs(), POLL_MS);
    return () => window.clearInterval(id);
  }, [fetchJobs]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitMessage(null);

    const urls = urlsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setError("Add at least one URL.");
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

    const body: Record<string, unknown> = {
      urls,
      mode,
      enable_render: enableRender,
      dry_run: dryRun,
    };
    if (mode === "events" && venueId.trim()) {
      body.venue_id = venueId.trim();
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        setError(typeof data.detail === "string" ? data.detail : `Request failed (${response.status})`);
        return;
      }
      const jobIds = Array.isArray(data.job_ids) ? (data.job_ids as string[]) : [];
      setSubmitMessage(`Queued ${jobIds.length} job(s).`);
      setUrlsText("");
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRescrape(jobId: string) {
    const session = getStoredAuthSession();
    if (!session) return;
    setRescrapingId(jobId);
    try {
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue/${jobId}/rescrape`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        setError(typeof data.detail === "string" ? data.detail : `Rescrape failed (${response.status})`);
        return;
      }
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setRescrapingId(null);
    }
  }

  async function handleDelete(jobId: string) {
    const session = getStoredAuthSession();
    if (!session) return;
    setDeletingId(jobId);
    try {
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue/${jobId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        setError(typeof data.detail === "string" ? data.detail : `Delete failed (${response.status})`);
        return;
      }
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearQueue(status?: string) {
    const msg = status
      ? `Clear all ${status} jobs? This cannot be undone.`
      : "Clear the entire queue? This cannot be undone.";
    if (!window.confirm(msg)) return;

    const session = getStoredAuthSession();
    if (!session) return;
    setClearing(true);
    try {
      const qs = status ? `?status=${status}` : "";
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue${qs}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        setError(typeof data.detail === "string" ? data.detail : `Clear failed (${response.status})`);
        return;
      }
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setClearing(false);
    }
  }

  function toggleExpanded(jobId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  }

  const grouped = useMemo(() => {
    const out: Record<JobStatus, ScrapeJob[]> = {
      pending: [],
      in_progress: [],
      completed: [],
      failed: [],
    };
    for (const job of jobs) {
      out[job.status]?.push(job);
    }
    return out;
  }, [jobs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Submit panel */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 4px 0" }}>Add to scrape queue</h2>
        <p className="meta" style={{ margin: "0 0 16px 0" }}>
          Paste one URL per line. The worker scrapes them sequentially.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button type="button" variant={mode === "venue" ? "primary" : "secondary"} onClick={() => setMode("venue")}>
              Venue mode
            </Button>
            <Button type="button" variant={mode === "events" ? "primary" : "secondary"} onClick={() => setMode("events")}>
              Events mode
            </Button>
          </div>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>URLs (one per line)</span>
            <textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              rows={6}
              placeholder={"https://example-venue.com/events\nhttps://another-venue.com/calendar"}
              style={{
                width: "100%",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
                padding: 12,
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
                resize: "vertical",
              }}
            />
          </label>

          {mode === "events" && (
            <Input
              label="Venue ID (optional)"
              type="text"
              placeholder="Leave blank to auto-detect"
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
            />
          )}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={enableRender} onChange={(e) => setEnableRender(e.target.checked)} />
              <span className="meta" style={{ margin: 0 }}>
                Enable JS rendering
              </span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              <span className="meta" style={{ margin: 0 }}>
                Dry run (don&apos;t write to Supabase)
              </span>
            </label>
          </div>

          <div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Queuing..." : "Add to queue"}
            </Button>
          </div>
        </form>

        {error && (
          <div style={{ marginTop: 14, color: "#e74c3c", fontSize: 13 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        {submitMessage && (
          <div style={{ marginTop: 14, color: "#14b87d", fontSize: 13 }}>{submitMessage}</div>
        )}
      </div>

      {/* Queue list */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Scrape queue</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="meta" style={{ fontSize: 12 }}>
              polling every {Math.round(POLL_MS / 1000)}s · {jobs.length} job(s)
            </span>
            {jobs.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={clearing}
                onClick={() => void handleClearQueue()}
                style={{ color: "#e74c3c", fontSize: 12 }}
              >
                {clearing ? "Clearing..." : "Clear all"}
              </Button>
            )}
          </div>
        </div>

        {jobs.length === 0 && (
          <p className="meta" style={{ margin: 0 }}>
            No jobs yet. Add some URLs above.
          </p>
        )}

        {STATUS_ORDER.map((status) => {
          const list = grouped[status];
          if (!list || list.length === 0) return null;
          return (
            <section key={status} style={{ marginBottom: 18 }}>
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: STATUS_COLOR[status],
                }}
              >
                {STATUS_LABEL[status]} ({list.length})
              </h3>
              {list.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  expanded={expanded.has(job.id)}
                  onToggle={() => toggleExpanded(job.id)}
                  onRescrape={() => void handleRescrape(job.id)}
                  rescraping={rescrapingId === job.id}
                  onDelete={() => void handleDelete(job.id)}
                  deleting={deletingId === job.id}
                />
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}
