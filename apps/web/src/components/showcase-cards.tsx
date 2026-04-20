import Image from "next/image";
import Link from "next/link";
import { ArtistFollowButton } from "@/components/artist-follow-button";
import { VenueFollowButton } from "@/components/venue-follow-button";

export type EventCardItem = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  dateLabel: string;
  timeLabel: string;
  zipCode: string;
  location: string;
  venue: string;
  price: string;
  image: string;
  tags: string[];
  badge?: string;
  isSponsored?: boolean;
};

export type VenueCardItem = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  location: string;
  image: string;
  tags?: string[];
  badge?: string;
};

export type ArtistCardItem = {
  id: string;
  name: string;
  location: string;
  description: string;
  image: string;
  tags?: string[];
  badge?: string;
};

export function EventShowcaseCard({ item }: { item: EventCardItem }) {
  return (
    <article className="showCard">
      <Link href={`/events/${item.id}`} className="showCardLink" aria-label={`Open ${item.title} details`}>
        <div className="mediaWrap">
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 25vw"
          />
          {item.isSponsored ? (
            <span className="pillTop" style={{ background: "linear-gradient(135deg,#f5b942,#e88c1a)", color: "#fff" }}>
              ⭐ Sponsored
            </span>
          ) : item.badge ? (
            <span className="pillTop">{item.badge}</span>
          ) : null}
        </div>

        <div className="cardBody">
          <div className="timeChip">
            <span>{item.dateLabel}</span>
            <strong>{item.timeLabel}</strong>
          </div>

          <div className="tagRow">
            {item.tags.map((tag) => (
              <span key={tag} className="tagPill">
                {tag}
              </span>
            ))}
          </div>

          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <div className="cardMeta">{item.location}</div>
        </div>
      </Link>
    </article>
  );
}

export function VenueCard({ item }: { item: VenueCardItem }) {
  return (
    <article className="showCard compactCard">
      <div className="mediaWrap">
        <Link href={`/venues/${item.id}`} className="showCardLink" aria-label={`Open ${item.name} details`}>
          <Image src={item.image} alt={item.name} fill sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw" />
          {item.badge ? <span className="pillTop">{item.badge}</span> : null}
        </Link>
        <VenueFollowButton venueId={item.id} />
      </div>

      <Link href={`/venues/${item.id}`} className="showCardLink" aria-label={`Open ${item.name} details`}>
        <div className="cardBody">
          <h3>{item.name}</h3>
          <p className="subline">{item.tagline}</p>
          <p>{item.description}</p>

          <div className="cardMeta">{item.location}</div>

          <div className="tagRow">
            {(item.tags ?? []).map((tag) => (
              <span key={tag} className="tagPill soft">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function ArtistCard({ item }: { item: ArtistCardItem }) {
  return (
    <article className="showCard compactCard">
      <div className="mediaWrap">
        <Link href={`/artists/${item.id}`} className="showCardLink" aria-label={`Open ${item.name} details`}>
          <Image src={item.image} alt={item.name} fill sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw" />
          {item.badge ? <span className="pillTop">{item.badge}</span> : null}
        </Link>
        <ArtistFollowButton artistId={item.id} />
      </div>

      <Link href={`/artists/${item.id}`} className="showCardLink" aria-label={`Open ${item.name} details`}>
        <div className="cardBody">
          <h3>{item.name}</h3>
          <div className="cardMeta">{item.location}</div>
          <p>{item.description}</p>

          <div className="tagRow">
            {(item.tags ?? []).map((tag) => (
              <span key={tag} className="tagPill">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </Link>
    </article>
  );
}