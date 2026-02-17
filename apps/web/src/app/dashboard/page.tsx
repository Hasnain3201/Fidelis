"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export default function UserDashboardPage() {
  const [open, setOpen] = useState(false);

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="card">
          <h1>User Dashboard</h1>
          <p className="meta">Week 1 placeholder for saved events, followed artists, and account preferences.</p>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Saved Events</strong>
              <p>0</p>
            </div>
            <div className="miniCard">
              <strong>Followed Artists</strong>
              <p>0</p>
            </div>
            <div className="miniCard">
              <strong>Notifications</strong>
              <p>Off</p>
            </div>
          </div>

          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            Open Placeholder Modal
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        title="Dashboard Placeholder"
        onClose={() => setOpen(false)}
        actions={
          <Button type="button" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="meta">This modal is part of Week 1 reusable UI components and will be reused for flows.</p>
      </Modal>
    </section>
  );
}
