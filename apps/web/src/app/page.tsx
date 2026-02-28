"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { FilterSidebar } from "@/components/filter-sidebar";
import { EventShowcaseCard } from "@/components/showcase-cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_ITEMS } from "@/lib/mock-content";
import { isValidZipCode, normalizeZipInput, zipMatchesEvent } from "@/lib/zip";

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
  const [isPending, startTransition] = useTransition();
  const [searchText, setSearchText] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState("");
  const [activeQuick, setActiveQuick] = useState(QUICK_FILTERS[0]);

  const featuredEvents = EVENT_ITEMS.slice(0, 4);

  const visibleEvents = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return EVENT_ITEMS.filter((event) => {
      const searchMatch =
        !search ||
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.venue.toLowerCase().includes(search);

      const quickMatch = matchesQuickFilter(event.price, event.tags, event.subtitle, activeQuick);
      const zipMatch = zipMatchesEvent(zipCode, event.zipCode);

      return searchMatch && zipMatch && quickMatch;
    });
  }, [activeQuick, searchText, zipCode]);

  function validateZipInput(value: string): string {
    if (!value.trim()) return "ZIP code is required to search.";
    if (!isValidZipCode(value)) return "Use a valid US ZIP code (e.g., 78701 or 78701-1234).";
    return "";
  }

  function openSearchResults(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const zipValidationMessage = validateZipInput(zipCode);
    if (zipValidationMessage) {
      setZipError(zipValidationMessage);
      return;
    }

    const normalizedQuery = searchText.trim().replace(/\s+/g, " ").slice(0, 120);
    const params = new URLSearchParams();
    if (normalizedQuery) params.set("query", normalizedQuery);
    params.set("zip", zipCode);

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
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

          <form className="heroSearchForm" onSubmit={openSearchResults} noValidate>
            <div className="heroSearchRow">
              <Input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search events, artists, venues"
                maxLength={120}
                aria-label="Search term"
              />
              <Input
                value={zipCode}
                onChange={(event) => {
                  const nextZip = normalizeZipInput(event.target.value);
                  setZipCode(nextZip);
                  if (zipError) {
                    setZipError(validateZipInput(nextZip));
                  }
                }}
                onBlur={() => setZipError(validateZipInput(zipCode))}
                placeholder="ZIP code"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={10}
                aria-label="ZIP code"
                aria-invalid={Boolean(zipError)}
              />
              <Button type="submit" className="heroSearchBtn" disabled={isPending}>
                {isPending ? "Searching..." : "Search"}
              </Button>
            </div>
            {zipError ? (
              <p className="fieldError" role="alert">
                {zipError}
              </p>
            ) : null}
          </form>

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
