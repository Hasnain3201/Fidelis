"use client";

type AddToCalendarProps = {
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
};

function toGoogleCalendarUrl({ title, startTime, endTime, location, description }: AddToCalendarProps) {
  function formatTime(iso: string) {
    return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  }
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${formatTime(startTime)}/${formatTime(endTime)}`,
    details: description ?? `Check out ${title} on LIVEY!`,
    location: location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function toOutlookCalendarUrl({ title, startTime, endTime, location, description }: AddToCalendarProps) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: title,
    startdt: new Date(startTime).toISOString(),
    enddt: new Date(endTime).toISOString(),
    body: description ?? `Check out ${title} on LIVEY!`,
    location: location ?? "",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function AddToCalendar(props: AddToCalendarProps) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <a
        href={toGoogleCalendarUrl(props)}
        target="_blank"
        rel="noreferrer"
        className="pageActionLink secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        aria-label="Add to Google Calendar"
      >
        📅 Google Calendar
      </a>
      <a
        href={toOutlookCalendarUrl(props)}
        target="_blank"
        rel="noreferrer"
        className="pageActionLink secondary"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
        aria-label="Add to Outlook Calendar"
      >
        📆 Outlook
      </a>
    </div>
  );
}
