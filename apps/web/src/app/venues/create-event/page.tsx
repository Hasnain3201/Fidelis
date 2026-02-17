import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CreateEventPlaceholderPage() {
  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card">
          <h1>Create Event</h1>
          <p className="meta">Week 1 placeholder route for venue event publishing flow.</p>

          <div className="createEventForm">
            <Input label="Event Name" placeholder="Friday Jazz Session" />
            <Input label="Date" placeholder="2026-03-22" />
            <Input label="Time" placeholder="20:00" />
            <Input label="ZIP Code" placeholder="07732" />
            <Input label="Category" placeholder="Live Music" />
            <Button type="button">Save Draft</Button>
          </div>
        </div>
      </div>
    </section>
  );
}
