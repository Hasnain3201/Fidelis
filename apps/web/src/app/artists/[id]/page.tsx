import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyLinkButton } from "@/components/copy-link-button";
import { ShareButtons } from "@/components/share-buttons";
import { ArtistFollowButton } from "@/components/artist-follow-button";
import { RecentlyViewedTracker } from "@/components/recently-viewed-tracker";
import { getArtistDetail, getArtistEvents, type ArtistDetailResponse, type ArtistEventSummary } from "@/lib/api";

type ArtistDetailPageProps = {
  params: Promise<{ id: string }>;
};

const ARTIST_DETAIL_IMAGES = [
  "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=1600&q=80",
];

function pickImage(artistId: string): string {
  let hash = 0;
  for (const char of artistId) hash = (hash + char.charCodeAt(0)) % ARTIST_DETAIL_IMAGES.length;
  return ARTIST_DETAIL_IMAGES[hash];
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ArtistDetailPage({ params }: ArtistDetailPageProps) {
  const { id } = await params;

  let artist: ArtistDetailResponse | null = null;
  try {
    artist = await getArtistDetail(id);
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("not found")) {
      notFound();
    } else {
      throw error;
    }
  }

  if (!artist) notFound();

  let events: ArtistEventSummary[] = [];
  try {
    events = await getArtistEvents(id);
  } catch {
    events = [];
  }

  const heroImage = pickImage(artist.id);
  const genreLabel = artist.genre?.trim() || "Genre TBD";

  return (
    <>
      <RecentlyViewedTracker
        id={artist.id}
        kind="artist"
        label={artist.stage_name}
        image={heroImage}
        href={`/artists/${artist.id}`}
      />

      <section className="siteSection">
        <div className="siteContainer eventDetailLayout">
          <div className="eventDetailMain">
            <div className="eventHeroMedia">
              <Image src={heroImage} alt={artist.stage_name} fill priority sizes="(max-width: 920px) 100vw, 68vw" />
            </div>

            <div className="eventDetailCard">
              <p className="eventDetailType">Artist</p>
              <h1>{artist.stage_name}</h1>
              <p className="meta">{artist.bio?.trim() || "No artist bio has been added yet."}</p>

              <div className="eventMetaGrid">
                <div className="eventMetaItem">
                  <strong>Genre</strong>
                  <span>{genreLabel}</span>
                </div>
                <div className="eventMetaItem">
                  <strong>Upcoming Shows</strong>
                  <span>{events.length}</span>
                </div>
                <div className="eventMetaItem">
                  <strong>Media Profile</strong>
                  <span>{artist.media_url ? "Available" : "Not linked"}</span>
                </div>
                <div className="eventMetaItem">
                  <strong>Artist ID</strong>
                  <span>{artist.id}</span>
                </div>
              </div>

              <div className="tagRow">
                <span className="tagPill">Artist</span>
                <span className="tagPill">{genreLabel}</span>
              </div>

              <div className="eventDetailActions">
                {artist.media_url ? (
                  <a href={artist.media_url} target="_blank" rel="noreferrer" className="pageActionLink">
                    Open Media
                  </a>
                ) : null}

                <ArtistFollowButton artistId={artist.id} />
                <CopyLinkButton />
                <ShareButtons title={artist.stage_name} />

                <Link href="/artists" className="pageActionLink secondary">
                  Back to Artists
                </Link>
              </div>
            </div>
          </div>

          <aside className="eventDetailSidebar">
            <div className="eventSidebarCard">
              <h2>About This Artist</h2>
              <p className="meta">Loaded from live backend data through FastAPI `/api/v1/artists/{id}`.</p>
            </div>

            <div className="eventSidebarCard">
              <h2>Linked Events</h2>
              {events.length ? (
                <div className="listStack">
                  {events.map((event) => (
                    <div key={event.id} className="listItemRow">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{event.title || "Untitled Event"}</strong>
                        <p className="meta" style={{ margin: "4px 0 0" }}>
                          {formatDate(event.start_time)} • {formatTime(event.start_time)}
                          {event.venue_name ? ` • ${event.venue_name}` : ""}
                        </p>
                      </div>
                      <Link href={`/events/${event.id}`} className="pageActionLink secondary">
                        View
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="meta">No linked events are currently available for this artist.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}