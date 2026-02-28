"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidZipCode, normalizeZipInput } from "@/lib/zip";

type PublishMode = "draft" | "publish";

type CreateEventFormState = {
  title: string;
  description: string;
  category: string;
  date: string;
  time: string;
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
  category: "Live Music",
  date: "",
  time: "",
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

export default function CreateEventPage() {
  const [form, setForm] = useState<CreateEventFormState>(INITIAL_FORM_STATE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

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
    if (!form.time) nextErrors.time = "Time is required.";
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

    if (mode === "publish") {
      const eventDate = form.date ? new Date(`${form.date}T${form.time || "00:00"}`) : null;
      if (!eventDate || Number.isNaN(eventDate.getTime()) || eventDate.getTime() <= Date.now()) {
        nextErrors.date = "Enter a valid future date and time.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function submitForm(mode: PublishMode) {
    setStatusMessage("");
    if (!validateForm(mode)) return;

    if (mode === "draft") setIsSavingDraft(true);
    if (mode === "publish") setIsPublishing(true);

    await new Promise((resolve) => window.setTimeout(resolve, 700));
    setStatusMessage(mode === "draft" ? "Draft saved (UI only)." : "Event published in UI mode. API wiring is Week 3.");

    if (mode === "draft") setIsSavingDraft(false);
    if (mode === "publish") setIsPublishing(false);
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
          <p className="meta">Complete venue publishing flow (UI only) with validation and staged submit states.</p>

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
                <option value="Live Music">Live Music</option>
                <option value="Concert">Concert</option>
                <option value="Comedy Show">Comedy Show</option>
                <option value="DJ Set">DJ Set</option>
                <option value="Community">Community</option>
              </select>
            </label>

            <div className="inlineFields twoCol">
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
                <span className="uiInputLabel">Time</span>
                <Input
                  type="time"
                  value={form.time}
                  onChange={(event) => updateField("time", event.target.value)}
                  aria-invalid={Boolean(errors.time)}
                  required
                />
              </label>
            </div>
            {errors.date ? (
              <p className="fieldError" role="alert">
                {errors.date}
              </p>
            ) : null}
            {errors.time ? (
              <p className="fieldError" role="alert">
                {errors.time}
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

          {statusMessage ? <p className="statusBanner success">{statusMessage}</p> : null}
        </div>

        <aside className="card createEventPreview">
          <h2>Live Preview</h2>
          {form.title.trim() ? (
            <>
              <h3>{form.title.trim()}</h3>
              <p className="meta">{form.category}</p>
              <p className="meta">
                {form.date || "Date TBD"} {form.time ? `at ${form.time}` : ""}
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
