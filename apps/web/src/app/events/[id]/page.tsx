type EventDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: EventDetailPageProps) {
  const { id } = await params;

  return (
    <section className="page grid" style={{ gap: 18 }}>
      <h1>Event Detail</h1>
      <p className="meta">Event ID: {id}</p>

      <div className="card grid" style={{ gap: 10 }}>
        <strong>Event details are scaffolded.</strong>
        <p className="meta">
          Add API fetch for full event data, linked artists, venue profile, RSVP/ticket URL, and favorites action.
        </p>
      </div>
    </section>
  );
}
