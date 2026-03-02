"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVenueEvent } from "@/lib/api";
import { getStoredAuthSession, type AuthSession } from "@/lib/auth";
import { isValidZipCode, normalizeZipInput } from "@/lib/zip";

type PublishMode = "draft" | "publish";

type CreateEventFormState = {
  title: string;
  description: string;
  category: string;
  date: string;
  startTime: string;
  endTime: string;
  zipCode: string;
  venueName: string;
  ticketUrl: string;
  priceType: "free" | "paid";
  price: string;
  ageRequirement: string;
  capacity: string;
};

const INITIAL_FORM_STATE: CreateEventFormState = {
  title: "",
  description: "",
  category: "live-music",
  date: "",
  startTime: "",
  endTime: "",
  zipCode: "",
  venueName: "",
  ticketUrl: "",
  priceType: "free",
  price: "",
  ageRequirement: "all-ages",
  capacity: "",
};

function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function buildDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const combined = new Date(`${date}T${time}:00`);
  if (Number.isNaN(combined.getTime())) return null;
  return combined;
}

function toCategoryLabel(value: string): string {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CreateEventPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [form, setForm] = useState<CreateEventFormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setSession(getStoredAuthSession());
  }, []);

  function updateField<K extends keyof CreateEventFormState>(field: K, value: CreateEventFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function validateForm(mode: PublishMode) {
    const nextErrors: Record<string, string> = {};

    if (!form.title.trim() || form.title.trim().length < 3) {
      nextErrors.title = "Event title must be at least 3 characters.";
    }

    if (!form.description.trim() || form.description.trim().length < 20) {
      nextErrors.description = "Description should be at least 20 characters.";
    }

    if (!form.date) nextErrors.date = "Date is required.";
    if (!form.startTime) nextErrors.startTime = "Start time is required.";
    if (!form.endTime) nextErrors.endTime = "End time is required.";
    if (!form.venueName.trim()) nextErrors.venueName = "Venue name is required.";

    if (!form.zipCode) {
      nextErrors.zipCode = "ZIP code is required.";
    } else if (!isValidZipCode(form.zipCode)) {
      nextErrors.zipCode = "Enter a valid ZIP code.";
    }

    if (form.ticketUrl.trim() && !isSafeHttpUrl(form.ticketUrl.trim())) {
      nextErrors.ticketUrl = "Ticket URL must start with http:// or https://";
    }

    if (form.priceType === "paid") {
      const price = Number(form.price);
      if (!form.price.trim() || Number.isNaN(price) || price <= 0) {
        nextErrors.price = "Paid events require a valid ticket price.";
      }
    }

    if (form.capacity.trim()) {
      const capacity = Number(form.capacity);
      if (Number.isNaN(capacity) || capacity <= 0 || !Number.isInteger(capacity)) {
        nextErrors.capacity = "Capacity must be a positive whole number.";
      }
    }

    const startDate = buildDateTime(form.date, form.startTime);
    const endDate = buildDateTime(form.date, form.endTime);

    if (!startDate) nextErrors.startTime = "Enter a valid start time.";
    if (!endDate) nextErrors.endTime = "Enter a valid end time.";
    if (startDate && endDate && endDate.getTime() <= startDate.getTime()) {
      nextErrors.endTime = "End time must be after start time.";
    }

    if (mode === "publish" && startDate && startDate.getTime() <= Date.now()) {
      nextErrors.startTime = "Event start must be in the future.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitForm(mode: PublishMode) {
    setStatusMessage(null);
    if (!validateForm(mode)) return;

    if (mode === "draft") {
      setIsSavingDraft(true);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      setStatusMessage({ type: "success", text: "Draft saved locally (UI only)." });
      setIsSavingDraft(false);
      return;
    }

    if (!session) {
      setStatusMessage({ type: "error", text: "Sign in first to publish events." });
      return;
    }

    if (session.role !== "venue") {
      setStatusMessage({ type: "error", text: "Venue role is required to publish events." });
      return;
    }

    const startDate = buildDateTime(form.date, form.startTime);
    const endDate = buildDateTime(form.date, form.endTime);
    if (!startDate || !endDate) {
      setStatusMessage({ type: "error", text: "Invalid date/time values." });
      return;
    }

    try {
      setIsPublishing(true);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        zip_code: form.zipCode.slice(0, 5),
        ticket_url: form.ticketUrl.trim() || null,
      };

      const result = await createVenueEvent(payload, session);
      setStatusMessage({ type: "success", text: `Event published (id: ${result.id}).` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to publish event.";
      setStatusMessage({ type: "error", text: message });
    } finally {
      setIsPublishing(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitForm("publish");
  }

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer createEventLayout">
        <div className="card">
          <h1>Create Event</h1>
          <p className="meta">Week 3 integration: publishes to backend `POST /api/v1/venues/events`.</p>
          {!session ? (
            <p className="fieldHint">
              Sign in as a venue account before publishing. <Link href="/login">Go to login</Link>.
            </p>
          ) : (
            <p className="fieldHint">Signed in as role: {session.role}</p>
          )}

          <form className="createEventForm" onSubmit={onSubmit} noValidate>
            <Input
              label="Event Name"
              placeholder="Friday Jazz Session"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value.slice(0, 120))}
              aria-invalid={Boolean(errors.title)}
              required
            />
            {errors.title ? (
              <p className="fieldError" role="alert">
                {errors.title}
              </p>
            ) : null}

            <label className="uiInputWrap">
              <span className="uiInputLabel">Description</span>
              <textarea
                className="uiTextArea"
                placeholder="Describe the atmosphere, performers, and why attendees should join."
                value={form.description}
                onChange={(event) => updateField("description", event.target.value.slice(0, 800))}
                aria-invalid={Boolean(errors.description)}
                rows={5}
                required
              />
            </label>
            {errors.description ? (
              <p className="fieldError" role="alert">
                {errors.description}
              </p>
            ) : null}

            <label className="uiInputWrap">
              <span className="uiInputLabel">Category</span>
              <select className="uiSelect" value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                <option value="live-music">Live Music</option>
                <option value="comedy">Comedy</option>
                <option value="dance">Dance</option>
                <option value="arts">Arts</option>
                <option value="festival">Festival</option>
              </select>
            </label>

            <div className="inlineFields threeCol">
              <label className="uiInputWrap">
                <span className="uiInputLabel">Date</span>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField("date", event.target.value)}
                  aria-invalid={Boolean(errors.date)}
                  required
                />
              </label>
              <label className="uiInputWrap">
                <span className="uiInputLabel">Start Time</span>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(event) => updateField("startTime", event.target.value)}
                  aria-invalid={Boolean(errors.startTime)}
                  required
                />
              </label>
              <label className="uiInputWrap">
                <span className="uiInputLabel">End Time</span>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => updateField("endTime", event.target.value)}
                  aria-invalid={Boolean(errors.endTime)}
                  required
                />
              </label>
            </div>
            {errors.date ? (
              <p className="fieldError" role="alert">
                {errors.date}
              </p>
            ) : null}
            {errors.startTime ? (
              <p className="fieldError" role="alert">
                {errors.startTime}
              </p>
            ) : null}
            {errors.endTime ? (
              <p className="fieldError" role="alert">
                {errors.endTime}
              </p>
            ) : null}

            <div className="inlineFields twoCol">
              <Input
                label="Venue Name"
                value={form.venueName}
                onChange={(event) => updateField("venueName", event.target.value.slice(0, 120))}
                aria-invalid={Boolean(errors.venueName)}
                required
              />
              <Input
                label="ZIP Code"
                value={form.zipCode}
                onChange={(event) => updateField("zipCode", normalizeZipInput(event.target.value))}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={10}
                aria-invalid={Boolean(errors.zipCode)}
                required
              />
            </div>
            {errors.venueName ? (
              <p className="fieldError" role="alert">
                {errors.venueName}
              </p>
            ) : null}
            {errors.zipCode ? (
              <p className="fieldError" role="alert">
                {errors.zipCode}
              </p>
            ) : null}

            <Input
              label="Ticket URL (optional)"
              placeholder="https://tickets.example.com/event"
              value={form.ticketUrl}
              onChange={(event) => updateField("ticketUrl", event.target.value.slice(0, 300))}
              type="url"
              inputMode="url"
              aria-invalid={Boolean(errors.ticketUrl)}
            />
            {errors.ticketUrl ? (
              <p className="fieldError" role="alert">
                {errors.ticketUrl}
              </p>
            ) : (
              <p className="fieldHint">Only HTTP/HTTPS URLs are accepted.</p>
            )}

            <div className="inlineFields twoCol">
              <label className="uiInputWrap">
                <span className="uiInputLabel">Pricing</span>
                <select
                  className="uiSelect"
                  value={form.priceType}
                  onChange={(event) => updateField("priceType", event.target.value as CreateEventFormState["priceType"])}
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </label>
              <Input
                label="Ticket Price"
                placeholder="25"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value.replace(/[^\d.]/g, "").slice(0, 8))}
                disabled={form.priceType === "free"}
                aria-invalid={Boolean(errors.price)}
              />
            </div>
            {errors.price ? (
              <p className="fieldError" role="alert">
                {errors.price}
              </p>
            ) : null}

            <div className="inlineFields twoCol">
              <label className="uiInputWrap">
                <span className="uiInputLabel">Age Restriction</span>
                <select
                  className="uiSelect"
                  value={form.ageRequirement}
                  onChange={(event) => updateField("ageRequirement", event.target.value)}
                >
                  <option value="all-ages">All ages</option>
                  <option value="18-plus">18+</option>
                  <option value="21-plus">21+</option>
                </select>
              </label>
              <Input
                label="Capacity (optional)"
                placeholder="250"
                value={form.capacity}
                onChange={(event) => updateField("capacity", event.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                aria-invalid={Boolean(errors.capacity)}
              />
            </div>
            {errors.capacity ? (
              <p className="fieldError" role="alert">
                {errors.capacity}
              </p>
            ) : null}

            <div className="createEventActions">
              <Button type="button" variant="secondary" onClick={() => void submitForm("draft")} disabled={isSavingDraft || isPublishing}>
                {isSavingDraft ? "Saving..." : "Save Draft"}
              </Button>
              <Button type="submit" disabled={isPublishing || isSavingDraft}>
                {isPublishing ? "Publishing..." : "Publish Event"}
              </Button>
            </div>
          </form>

          {statusMessage ? (
            <p className={`statusBanner ${statusMessage.type === "success" ? "success" : "error"}`}>{statusMessage.text}</p>
          ) : null}
        </div>

        <aside className="card createEventPreview">
          <h2>Live Preview</h2>
          {form.title.trim() ? (
            <>
              <h3>{form.title.trim()}</h3>
              <p className="meta">{toCategoryLabel(form.category)}</p>
              <p className="meta">
                {form.date || "Date TBD"} {form.startTime ? `at ${form.startTime}` : ""}
                {form.endTime ? ` - ${form.endTime}` : ""}
              </p>
              <p className="meta">
                {form.venueName || "Venue TBD"} {form.zipCode ? `• ${form.zipCode}` : ""}
              </p>
              <p className="meta">{form.description || "Description will appear here."}</p>
            </>
          ) : (
            <div className="emptyStateCard compact">
              <h3>Preview will appear here.</h3>
              <p className="meta">Start filling the form to review the final event summary before publishing.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
