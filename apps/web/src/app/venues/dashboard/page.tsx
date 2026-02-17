export default function VenueDashboardPage() {
  return (
    <section className="page grid" style={{ gap: 18 }}>
      <h1>Venue Dashboard</h1>
      <p className="meta">Foundation for verified venue workflows: create/edit/delete events and analytics.</p>

      <div className="card grid" style={{ gap: 10 }}>
        <strong>Phase Beta target</strong>
        <p className="meta">Hook this page to protected API routes and role checks.</p>
      </div>
    </section>
  );
}
