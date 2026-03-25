import Image from "next/image";
import Link from "next/link";
import { ArtistFollowButton } from "@/components/artist-follow-button";
import { VenueFollowButton } from "@/components/venue-follow-button";
import type { ArtistItem, EventItem, VenueItem } from "@/lib/mock-content";

export function EventShowcaseCard({ item }: { item: EventItem }) {
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
          {item.badge ? <span className="pillTop">{item.badge}</span> : null}
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

export function VenueCard({ item }: { item: VenueItem }) {
  return (
    <article className="showCard compactCard">
      <div className="mediaWrap">
        <Image src={item.image} alt={item.name} fill sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw" />
        {item.badge ? <span className="pillTop">{item.badge}</span> : null}
        <VenueFollowButton venueId={item.id} />
      </div>

      <div className="cardBody">
        <h3>{item.name}</h3>
        <p className="subline">{item.tagline}</p>
        <p>{item.description}</p>

        <div className="cardMeta">{item.location}</div>

        <div className="tagRow">
          {item.tags.map((tag) => (
            <span key={tag} className="tagPill soft">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function ArtistCard({ item }: { item: ArtistItem }) {
  return (
    <article className="showCard compactCard">
      <div className="mediaWrap">
        <Image src={item.image} alt={item.name} fill sizes="(max-width: 760px) 100vw, (max-width: 1080px) 50vw, 33vw" />
        {item.badge ? <span className="pillTop">{item.badge}</span> : null}
        <ArtistFollowButton artistId={item.id} />
      </div>

      <div className="cardBody">
        <h3>{item.name}</h3>
        <div className="cardMeta">{item.location}</div>
        <p>{item.description}</p>

        <div className="tagRow">
          {item.tags.map((tag) => (
            <span key={tag} className="tagPill">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
