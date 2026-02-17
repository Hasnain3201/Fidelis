"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { FilterSidebar } from "@/components/filter-sidebar";
import { EventShowcaseCard } from "@/components/showcase-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_ITEMS } from "@/lib/mock-content";

const QUICK_FILTERS = ["This Weekend", "Free Events", "Live Music", "Comedy Shows", "DJ Sets"];

function matchesQuickFilter(price: string, tags: string[], subtitle: string, activeQuick: string): boolean {
  if (activeQuick === "This Weekend") return true;
  if (activeQuick === "Free Events") return price.toLowerCase().includes("free") || price.includes("$0");
  if (activeQuick === "Live Music") return tags.some((tag) => tag.toLowerCase().includes("live"));
  if (activeQuick === "Comedy Shows") return subtitle.toLowerCase().includes("comedy");
  if (activeQuick === "DJ Sets") return subtitle.toLowerCase().includes("dj");
  return true;
}

export default function HomePage() {
  const router = useRouter();
  const [searchText, setSearchText] = useState("");
  const [locationText, setLocationText] = useState("");
  const [activeQuick, setActiveQuick] = useState(QUICK_FILTERS[0]);

  const featuredEvents = EVENT_ITEMS.slice(0, 4);

  const visibleEvents = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    const location = locationText.trim().toLowerCase();

    return EVENT_ITEMS.filter((event) => {
      const searchMatch =
        !search ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.venue.toLowerCase().includes(search);

      const locationMatch = !location || event.location.toLowerCase().includes(location);
      const quickMatch = matchesQuickFilter(event.price, event.tags, event.subtitle, activeQuick);

      return searchMatch && locationMatch && quickMatch;
    });
  }, [activeQuick, locationText, searchText]);

  function openSearchResults() {
    const params = new URLSearchParams();
    if (searchText.trim()) params.set("query", searchText.trim());
    if (locationText.trim()) params.set("location", locationText.trim());
    router.push(`/search?${params.toString()}`);
  }

  return (
    <>
      <section className="heroBand">
        <div className="siteContainer heroContent">
          <div className="heroBadge">Discover local events in your area</div>

          <h1 className="heroTitle">
            Find Your Next
            <span> Unforgettable Experience</span>
          </h1>

          <p className="heroCopy">
            Connect with local venues, discover amazing artists, and never miss a show. Your community&apos;s
            entertainment scene, all in one place.
          </p>

          <div className="heroSearchRow">
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search events, artists, venues"
            />
            <Input
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              placeholder="City, State or ZIP"
            />
            <Button type="button" className="heroSearchBtn" onClick={openSearchResults}>
              Search
            </Button>
          </div>

          <FilterBar items={QUICK_FILTERS} activeItem={activeQuick} onSelect={setActiveQuick} />

          <div className="heroStats">
            <div className="heroStat">
              <strong>500+</strong>
              <span>Events Monthly</span>
            </div>
            <div className="heroStat">
              <strong>200+</strong>
              <span>Local Venues</span>
            </div>
            <div className="heroStat">
              <strong>1,000+</strong>
              <span>Artists</span>
            </div>
          </div>
        </div>
      </section>

      <section className="siteSection">
        <div className="siteContainer">
          <div className="sectionHeader">
            <div>
              <h2>Featured Events</h2>
              <p>Hand-picked experiences you&apos;ll love</p>
            </div>
            <a className="sectionLink" href="/search">
              View All
            </a>
          </div>

          <div className="cardsGrid four">
            {featuredEvents.map((item) => (
              <EventShowcaseCard key={item.id} item={item} />
            ))}
          </div>

          <div className="discoveryLayout">
            <FilterSidebar />

            <div>
              <div className="sectionHeader listHeader">
                <div>
                  <h2>All Events</h2>
                  <p>{visibleEvents.length} events found</p>
                </div>
              </div>

              <div className="cardsGrid eventsDense">
                {visibleEvents.map((item) => (
                  <EventShowcaseCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
