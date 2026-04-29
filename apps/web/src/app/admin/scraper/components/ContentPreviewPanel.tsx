"use client";

import { type CSSProperties } from "react";

export type ContentPreview = {
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

export function ContentPreviewPanel({ preview }: { preview: ContentPreview }) {
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
export function lightenResultForDisplay(data: Record<string, unknown>): Record<string, unknown> {
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
