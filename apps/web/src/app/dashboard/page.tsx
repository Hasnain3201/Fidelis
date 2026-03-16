"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Profile = {
  id: string
  display_name: string
}

type Favorite = {
  event_id: string
  created_at: string
  title: string
  start_time: string
}

type Follow = {
  artist_id: string
  created_at: string
  stage_name: string
}

export default function UserDashboardPage() {

const [profile, setProfile] = useState<Profile | null>(null);
const [favorites, setFavorites] = useState<Favorite[]>([]);
const [follows, setFollows] = useState<Follow[]>([]);

  useEffect(() => {
    async function loadDashboard() {
      const session = localStorage.getItem("livey.auth.session.v1")

      const token = session ? JSON.parse(session).accessToken : null

      if (!token) {
        console.error("No token found")
        return
      }
      
      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const profileRes = await fetch("http://localhost:8000/api/v1/profiles/me", { headers })
      const favoritesRes = await fetch("http://localhost:8000/api/v1/favorites/", { headers })
      const followsRes = await fetch("http://localhost:8000/api/v1/follows/", { headers })

      const profileData = await profileRes.json();
      const favoritesData = await favoritesRes.json();
      const followsData = await followsRes.json();

      setProfile(profileData);
      setFavorites(favoritesData);
      setFollows(followsData);
      console.log(favoritesData)
    }

    loadDashboard();
  }, []);

  return (
    <section className="siteSection pageUtility">
      <div className="siteContainer">
        <div className="dashboardShell">
          <div className="card dashboardHeroCard">
            <p className="dashboardPill">User Dashboard</p>
            <h1>Welcome back, {profile?.display_name ?? "User"}</h1>
            <p className="meta">Track saved events, followed artists, and your upcoming week in one place.</p>
            <div className="pageActions">
              <Link href="/search" className="pageActionLink">
                Find More Events
              </Link>
              <Link href="/register" className="pageActionLink secondary">
                Manage Account
              </Link>
            </div>
          </div>

          <div className="dashboardGrid">
            <div className="miniCard">
              <strong>Saved Events</strong>
              <p>{favorites.length}</p>
            </div>
            <div className="miniCard">
              <strong>Followed Artists</strong>
              <p>{follows.length}</p>
            </div>
            <div className="miniCard">
              <strong>Unread Alerts</strong>
              <p>0</p>
            </div>
          </div>

          <div className="dashboardContentGrid">
            <div className="card">
              <h2>Saved Events</h2>
              <div className="listStack">
                {Array.isArray(favorites) && favorites.map((fav) => (
                  <div key={fav.event_id} className="listItemRow">
                    <div>
                      <strong>{fav.title ?? "Event"}</strong>
                      <p className="meta">
                        {fav.start_time
                          ? new Date(fav.start_time).toLocaleDateString()
                          : "Saved Event"}
                      </p>
                    </div>
                    <Link className="pageActionLink secondary" href={`/events/${fav.event_id}`}>
                      Open
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Followed Artists</h2>
              <div className="listStack">
                {Array.isArray(follows) && follows.map((artist) => (
                  <div key={artist.artist_id} className="listItemRow">
                    <div>
                      <strong>{artist.stage_name ?? "Artist"}</strong>
                      <p className="meta">Followed artist</p>
                    </div>
                    <button type="button" className="pageActionLink secondary">
                      Unfollow
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Notifications</h2>
              <div className="emptyStateCard compact">
                <h3>No notifications yet.</h3>
                <p className="meta">You will see reminders for upcoming events and artist updates here.</p>
              </div>
            </div>

            <div className="card">
              <h2>Recommended Next Step</h2>
              <p className="meta">Complete your profile preferences to improve event recommendations.</p>
              <div className="pageActions">
                <button type="button" className="pageActionLink">
                  Update Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
