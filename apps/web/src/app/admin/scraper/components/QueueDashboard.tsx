"use client";

import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getStoredAuthSession } from "@/lib/auth";
import {
  ContentPreviewPanel,
  lightenResultForDisplay,
  type ContentPreview,
} from "./ContentPreviewPanel";

type JobStatus = "pending" | "in_progress" | "completed" | "failed";

type ScrapeJob = {
  id: string;
  batch_id: string | null;
  url: string;
  // Legacy field — older queue rows have "venue"/"events"; new rows are "unified".
  mode: string;
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

// Per-status fetch limits
const LIMITS: Record<JobStatus, number> = {
  in_progress: 10,
  pending: 50,
  completed: 50,
  failed: 50,
};

const PAGE_SIZE = 20;
const RECENT_RESULTS_COUNT = 10;

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

/** Compact summary card for the Recent Results panel. Shows the actual scraped data. */
function ResultSummaryCard({ job }: { job: ScrapeJob }) {
  const [expanded, setExpanded] = useState(false);
  const result = job.result ?? {};

  const isUnreachable = job.status === "completed" && result.unreachable === true;
  const accentColor = job.status === "failed"
    ? "#e74c3c"
    : isUnreachable
      ? "#f59e0b"
      : "#14b87d";

  let headline = "";
  let subline = "";

  if (job.status === "failed") {
    headline = "Failed";
    subline = job.error?.slice(0, 150) ?? "Unknown error";
  } else if (isUnreachable) {
    headline = "Unreachable";
    subline = (result.reason as string)?.slice(0, 200) ?? "Site could not be fetched";
  } else {
    const venueAction = (result.venue_action as string) ?? null;
    const venueId = (result.venue_id as string) ?? null;
    const saved = (result.saved as number) ?? 0;
    const updated = (result.updated as number) ?? 0;
    const skipped = (result.skipped as number) ?? 0;
    const artistsCreated = (result.artists_created as number) ?? 0;
    const artistsMerged = (result.artists_merged as number) ?? 0;
    const linksCreated = (result.links_created as number) ?? 0;

    const venuePart = venueAction
      ? `venue ${venueAction}`
      : venueId
        ? "venue linked"
        : "no venue";
    const eventsPart = `${saved + updated} events`;
    const artistsPart = `${artistsCreated + artistsMerged} artists`;
    headline = `${venuePart} · ${eventsPart} · ${artistsPart}`;

    const events = (result.events as Array<Record<string, unknown>>) ?? [];
    const firstTitle = events[0]?.title as string | undefined;
    const detailBits: string[] = [];
    if (saved || updated || skipped) {
      detailBits.push(`${saved} new / ${updated} merged / ${skipped} skipped`);
    }
    if (linksCreated) detailBits.push(`${linksCreated} event↔artist links`);
    if (firstTitle) detailBits.push(`e.g. "${firstTitle}"`);
    subline = detailBits.join(" · ");
  }

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: 8,
        border: `1px solid ${accentColor}33`,
        background: `${accentColor}08`,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 8,
          cursor: job.status === "completed" ? "pointer" : "default",
        }}
        onClick={() => job.status === "completed" && setExpanded((v) => !v)}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <StatusBadge status={job.status} />
            <span className="meta" style={{ fontSize: 11 }}>{job.mode}</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{headline}</div>
          {subline && (
            <div className="meta" style={{ fontSize: 12, marginTop: 2 }}>{subline}</div>
          )}
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginTop: 3,
            }}
            title={job.url}
          >
            {job.url}
          </div>
          <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
            finished {formatTime(job.completed_at)}
          </div>
        </div>
        {job.status === "completed" && (
          <span className="meta" style={{ fontSize: 11, flexShrink: 0 }}>
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </div>

      {expanded && job.status === "completed" && (
        <div style={{ marginTop: 10 }}>
          {job.content_preview && <ContentPreviewPanel preview={job.content_preview} />}
          <pre
            style={{
              background: "#0b1428",
              color: "#e0e6f0",
              padding: 14,
              borderRadius: 8,
              fontSize: 11,
              lineHeight: 1.6,
              overflow: "auto",
              maxHeight: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              marginTop: 8,
            }}
          >
            {JSON.stringify(
              lightenResultForDisplay({ result: job.result, content_preview: job.content_preview }),
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
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

function RescrapingBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 0.5,
        background: "#f59e0b22",
        color: "#f59e0b",
        border: "1px solid #f59e0b66",
      }}
    >
      <span
        style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#f59e0b",
          animation: "scraperPulse 1.2s ease-in-out infinite",
        }}
      />
      Rescraping
    </span>
  );
}

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

  const activeCardStyle: CSSProperties = rescraping
    ? {
        ...cardStyle,
        border: "1px solid rgba(245, 158, 11, 0.55)",
        background: "rgba(245, 158, 11, 0.06)",
      }
    : cardStyle;

  return (
    <div style={activeCardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          cursor: canExpand && !rescraping ? "pointer" : "default",
        }}
        onClick={() => { if (canExpand && !rescraping) onToggle(); }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {rescraping ? <RescrapingBadge /> : <StatusBadge status={job.status} />}
            <span className="meta" style={{ fontSize: 11 }}>{job.mode}</span>
            {job.dry_run && <span className="meta" style={{ fontSize: 11 }}>· dry-run</span>}
          </div>
          <div
            style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={job.url}
          >
            {job.url}
          </div>
          <div className="meta" style={{ fontSize: 11, marginTop: 2 }}>
            created {formatTime(job.created_at)}
            {job.completed_at && ` · finished ${formatTime(job.completed_at)}`}
          </div>
          {rescraping && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 12px",
                background: "rgba(245, 158, 11, 0.10)",
                border: "1px solid rgba(245, 158, 11, 0.35)",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#f59e0b",
                  animation: "scraperPulse 1.2s ease-in-out infinite",
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", flexShrink: 0 }}>
                Scraping in progress — this can take 30–60s
              </span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {canRescrape && (
            <Button
              type="button"
              variant="secondary"
              disabled={rescraping}
              onClick={(e) => { e.stopPropagation(); onRescrape(); }}
            >
              {rescraping ? "Rescraping…" : "Rescrape"}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            disabled={deleting || job.status === "in_progress" || rescraping}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ color: "#e74c3c" }}
          >
            {deleting ? "..." : "Delete"}
          </Button>
        </div>
      </div>

      {expanded && job.status === "failed" && job.error && (
        <div
          style={{
            marginTop: 12, padding: 12, borderRadius: 6,
            background: "rgba(231, 76, 60, 0.08)", border: "1px solid rgba(231, 76, 60, 0.35)",
            color: "#f5b7b1", fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word",
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
              background: "#0b1428", color: "#e0e6f0", padding: 16, borderRadius: 8,
              fontSize: 12, lineHeight: 1.6, overflow: "auto", maxHeight: 500,
              maxWidth: "100%", whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}
          >
            {JSON.stringify(
              lightenResultForDisplay({ result: job.result, content_preview: job.content_preview }),
              null, 2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function QueueDashboard() {
  // Form state
  const [urlsText, setUrlsText] = useState("");
  const [venueId, setVenueId] = useState("");
  const [enableRender, setEnableRender] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Queue state
  const [jobs, setJobs] = useState<ScrapeJob[]>([]);
  const [counts, setCounts] = useState<Record<JobStatus, number>>({
    in_progress: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rescrapingId, setRescrapingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  // Pagination & filter
  const [currentPage, setCurrentPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");

  // Worker control
  const [workerRunning, setWorkerRunning] = useState<boolean | null>(null);
  const [workerJobsProcessed, setWorkerJobsProcessed] = useState(0);
  const [workerMaxJobs, setWorkerMaxJobs] = useState<number | null>(null);
  const [workerCurrentUrl, setWorkerCurrentUrl] = useState<string | null>(null);
  const [maxJobsInput, setMaxJobsInput] = useState("");
  const [workerActionPending, setWorkerActionPending] = useState(false);

  // Recent results toggle
  const [showResults, setShowResults] = useState(false);

  // In-memory ring buffer: only completions/failures detected during this browser session.
  // Cleared on page refresh (state is local).
  const [recentResults, setRecentResults] = useState<ScrapeJob[]>([]);
  const seenFinishedIds = useRef<Set<string>>(new Set());
  const baselined = useRef(false);

  // Called from fetchJobs after each fetch. On the FIRST fetch, baseline existing
  // finished IDs without populating recentResults — they predate this session.
  // On subsequent fetches, append any newly-finished jobs (cap to last N).
  function ingestForRing(fetched: ScrapeJob[]) {
    const finished = fetched.filter(
      (j) => j.status === "completed" || j.status === "failed",
    );

    if (!baselined.current) {
      finished.forEach((j) => seenFinishedIds.current.add(j.id));
      baselined.current = true;
      return;
    }

    const fresh = finished.filter((j) => !seenFinishedIds.current.has(j.id));
    if (fresh.length === 0) return;
    fresh.forEach((j) => seenFinishedIds.current.add(j.id));
    // Newest first by completed_at
    fresh.sort((a, b) => {
      const aT = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bT = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bT - aT;
    });
    setRecentResults((prev) => [...fresh, ...prev].slice(0, RECENT_RESULTS_COUNT));
  }

  const fetchJobs = useCallback(async () => {
    const session = getStoredAuthSession();
    if (!session) return;
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    try {
      const statuses: JobStatus[] = ["in_progress", "pending", "completed", "failed"];
      const jobFetches = statuses.map((s) =>
        fetch(`${API_BASE}/api/v1/scraper/queue?status=${s}&limit=${LIMITS[s]}`, { headers }),
      );
      const countsFetch = fetch(`${API_BASE}/api/v1/scraper/queue/counts`, { headers });
      const [countsRes, ...jobResponses] = await Promise.all([countsFetch, ...jobFetches]);

      const payloads = await Promise.all(
        jobResponses.map((r) =>
          r.ok
            ? (r.json() as Promise<{ jobs: ScrapeJob[] }>)
            : Promise.resolve({ jobs: [] as ScrapeJob[] }),
        ),
      );
      const fetched = payloads.flatMap((p) => p.jobs ?? []);
      setJobs(fetched);
      ingestForRing(fetched);

      if (countsRes.ok) {
        const data = (await countsRes.json()) as Partial<Record<JobStatus, number>>;
        setCounts({
          in_progress: data.in_progress ?? 0,
          pending: data.pending ?? 0,
          completed: data.completed ?? 0,
          failed: data.failed ?? 0,
        });
      }
    } catch {
      // swallow
    }
  }, []);

  const fetchWorkerStatus = useCallback(async () => {
    const session = getStoredAuthSession();
    if (!session) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/scraper/worker/status`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        is_running: boolean;
        jobs_processed: number;
        max_jobs: number | null;
        current_url: string | null;
      };
      setWorkerRunning(data.is_running);
      setWorkerJobsProcessed(data.jobs_processed);
      setWorkerMaxJobs(data.max_jobs);
      setWorkerCurrentUrl(data.current_url ?? null);
    } catch {
      // swallow
    }
  }, []);

  // Load once on mount.
  useEffect(() => {
    void fetchJobs();
    void fetchWorkerStatus();
  }, [fetchJobs, fetchWorkerStatus]);

  // Smart polling: only while the worker is running. Stopped → no API calls.
  useEffect(() => {
    if (workerRunning !== true) return;
    const id = window.setInterval(() => {
      void fetchJobs();
      void fetchWorkerStatus();
    }, 3000);
    return () => window.clearInterval(id);
  }, [workerRunning, fetchJobs, fetchWorkerStatus]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchJobs(), fetchWorkerStatus()]);
    setRefreshing(false);
  }

  // Queue sort: most recently finished first, then pending/in_progress by created_at desc
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      if (a.completed_at && b.completed_at) {
        return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
      }
      if (a.completed_at) return -1;
      if (b.completed_at) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [jobs]);

  // Pagination helpers
  const filteredJobs = useMemo(
    () => (statusFilter === "all" ? sortedJobs : sortedJobs.filter((j) => j.status === statusFilter)),
    [sortedJobs, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));

  const pagedJobs = useMemo(
    () => filteredJobs.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filteredJobs, currentPage],
  );

  useEffect(() => setCurrentPage(0), [statusFilter]);
  useEffect(() => setCurrentPage((p) => Math.min(p, totalPages - 1)), [totalPages]);

  // Handlers
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitMessage(null);

    const urls = urlsText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) { setError("Add at least one URL."); return; }

    const session = getStoredAuthSession();
    if (!session) { setError("You must be logged in. Go to /login first."); return; }
    if (session.role !== "admin") {
      setError(`Your role is "${session.role}". Admin role is required.`);
      return;
    }

    const body: Record<string, unknown> = { urls, enable_render: enableRender, dry_run: dryRun };
    if (venueId.trim()) body.venue_id = venueId.trim();

    try {
      setSubmitting(true);
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
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

  async function handleWorkerStart() {
    const session = getStoredAuthSession();
    if (!session) return;
    setWorkerActionPending(true);
    const parsed = maxJobsInput.trim() ? parseInt(maxJobsInput.trim(), 10) : null;
    const body: Record<string, unknown> = {};
    if (parsed !== null && !isNaN(parsed) && parsed > 0) body.max_jobs = parsed;
    try {
      await fetch(`${API_BASE}/api/v1/scraper/worker/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify(body),
      });
      await fetchWorkerStatus();
    } catch { /* swallow */ } finally {
      setWorkerActionPending(false);
    }
  }

  async function handleWorkerStop() {
    const session = getStoredAuthSession();
    if (!session) return;
    setWorkerActionPending(true);
    try {
      await fetch(`${API_BASE}/api/v1/scraper/worker/stop`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      await fetchWorkerStatus();
    } catch { /* swallow */ } finally {
      setWorkerActionPending(false);
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
      } else {
        void fetchJobs();
      }
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
      } else {
        void fetchJobs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearCompleted() {
    if (!window.confirm("Delete all completed jobs? This cannot be undone.")) return;
    const session = getStoredAuthSession();
    if (!session) return;
    setClearing(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue?status=completed`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        setError(typeof data.detail === "string" ? data.detail : `Clear failed (${response.status})`);
      } else {
        void fetchJobs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setClearing(false);
    }
  }

  async function handleClearAll() {
    if (!window.confirm("Clear the entire queue? This cannot be undone.")) return;
    const session = getStoredAuthSession();
    if (!session) return;
    setClearing(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/scraper/queue`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        setError(typeof data.detail === "string" ? data.detail : `Clear failed (${response.status})`);
      } else {
        void fetchJobs();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setClearing(false);
    }
  }

  function toggleExpanded(jobId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  const completedCount = useMemo(() => jobs.filter((j) => j.status === "completed").length, [jobs]);

  const workerStatusText = workerRunning === null ? "..." : workerRunning ? "Running" : "Stopped";
  const workerDotColor = workerRunning === null ? "#94a3b8" : workerRunning ? "#14b87d" : "#94a3b8";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Card 1: Add to queue */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 4px 0" }}>Add to scrape queue (manual)</h2>
        <p className="meta" style={{ margin: "0 0 16px 0" }}>
          Paste one URL per line to enqueue specific sites. For automated bulk discovery by ZIP code
          and radius, use the Discover panel above.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
                fontSize: 13, padding: 12, borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit", resize: "vertical",
              }}
            />
          </label>

          <Input
            label="Venue ID (optional)"
            type="text"
            placeholder="Leave blank to auto-detect from the page"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
          />

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={enableRender} onChange={(e) => setEnableRender(e.target.checked)} />
              <span className="meta" style={{ margin: 0 }}>Enable JS rendering</span>
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
              <span className="meta" style={{ margin: 0 }}>Dry run (don&apos;t write to Supabase)</span>
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

      {/* Card 2: Worker Controls + Recent Results */}
      <div className="card" style={{ padding: 24 }}>
        {/* Worker status row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ margin: "0 0 6px 0" }}>Worker</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  display: "inline-block", width: 10, height: 10,
                  borderRadius: "50%", background: workerDotColor, flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{workerStatusText}</span>
              {workerRunning !== null && (
                <span className="meta" style={{ fontSize: 12 }}>
                  · {workerJobsProcessed} processed
                  {workerMaxJobs !== null ? ` / ${workerMaxJobs} max` : ""}
                </span>
              )}
            </div>
            {workerRunning && workerCurrentUrl && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 12px",
                  background: "rgba(20, 184, 125, 0.08)",
                  border: "1px solid rgba(20, 184, 125, 0.25)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  maxWidth: 600,
                }}
              >
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: "#14b87d", flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#14b87d", flexShrink: 0 }}>
                  Scraping:
                </span>
                <span
                  style={{
                    fontSize: 12,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                  title={workerCurrentUrl}
                >
                  {workerCurrentUrl}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>
                Max websites
              </span>
              <input
                type="number"
                min={1}
                value={maxJobsInput}
                onChange={(e) => setMaxJobsInput(e.target.value)}
                placeholder="no limit"
                disabled={workerRunning === true}
                style={{
                  width: 150, padding: "8px 12px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: workerRunning === true
                    ? "rgba(255,255,255,0.02)"
                    : "rgba(255,255,255,0.06)",
                  color: "inherit", fontSize: 13,
                  opacity: workerRunning === true ? 0.5 : 1,
                }}
              />
            </label>
            <Button
              type="button"
              variant={workerRunning ? "secondary" : "primary"}
              disabled={workerRunning === null || workerActionPending}
              onClick={() => void (workerRunning ? handleWorkerStop() : handleWorkerStart())}
              style={workerRunning ? { color: "#e74c3c" } : undefined}
            >
              {workerActionPending
                ? (workerRunning ? "Stopping..." : "Starting...")
                : (workerRunning ? "Stop Scraping" : "Start Scraping")}
            </Button>
          </div>
        </div>

        {workerRunning === false && (
          <p className="meta" style={{ margin: "10px 0 0 0", fontSize: 12 }}>
            Worker is stopped. Leave Max websites blank to scrape every job in the queue, or set a number to auto-stop after that many.
          </p>
        )}

        {/* Recent results section */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showResults ? 14 : 0 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Recent Scrape Results</span>
              <span className="meta" style={{ fontSize: 12, marginLeft: 8 }}>
                last {RECENT_RESULTS_COUNT} finished
                {recentResults.length > 0 && ` · ${recentResults.length} shown`}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowResults((v) => !v)}
              style={{ fontSize: 12 }}
            >
              {showResults ? "Hide" : "Show"}
            </Button>
          </div>

          {showResults && recentResults.length === 0 && (
            <p className="meta" style={{ margin: 0, fontSize: 12 }}>
              No finished scrapes yet. Click Refresh after jobs complete.
            </p>
          )}

          {showResults && recentResults.map((job) => (
            <ResultSummaryCard key={job.id} job={job} />
          ))}
        </div>
      </div>

      {/* Card 3: Scrape Queue */}
      <div className="card" style={{ padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 2px 0" }}>Scrape queue</h2>
            <div className="meta" style={{ fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(["in_progress", "pending", "completed", "failed"] as JobStatus[]).map((s) => {
                const total = counts[s];
                const fetched = jobs.filter((j) => j.status === s).length;
                const truncated = total > fetched;
                return (
                  <span key={s} style={{ color: STATUS_COLOR[s] }}>
                    {STATUS_LABEL[s]}: {total}
                    {truncated && (
                      <span style={{ color: "#64748b" }}> (showing {fetched})</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button
              type="button"
              variant="secondary"
              disabled={refreshing}
              onClick={() => void handleRefresh()}
              style={{ fontSize: 12 }}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh"}
            </Button>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | "all")}
              style={{
                padding: "5px 10px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit", fontSize: 12, cursor: "pointer",
              }}
            >
              <option value="all">All statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
            {completedCount > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={clearing}
                onClick={() => void handleClearCompleted()}
                style={{ fontSize: 12 }}
              >
                {clearing ? "Clearing..." : `Clear completed (${completedCount})`}
              </Button>
            )}
            {jobs.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                disabled={clearing}
                onClick={() => void handleClearAll()}
                style={{ color: "#e74c3c", fontSize: 12 }}
              >
                {clearing ? "Clearing..." : "Clear all"}
              </Button>
            )}
          </div>
        </div>

        {jobs.length === 0 && (
          <p className="meta" style={{ margin: 0 }}>No jobs yet. Add some URLs above or click Refresh.</p>
        )}

        {filteredJobs.length === 0 && jobs.length > 0 && (
          <p className="meta" style={{ margin: 0 }}>No {statusFilter} jobs.</p>
        )}

        {pagedJobs.map((job) => (
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

        {filteredJobs.length > PAGE_SIZE && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 16 }}>
            <Button
              type="button"
              variant="secondary"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((p) => p - 1)}
              style={{ fontSize: 12 }}
            >
              ← Prev
            </Button>
            <span className="meta" style={{ fontSize: 12 }}>
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              type="button"
              variant="secondary"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setCurrentPage((p) => p + 1)}
              style={{ fontSize: 12 }}
            >
              Next →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
