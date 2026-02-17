"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/filter-bar";
import { EventShowcaseCard } from "@/components/showcase-cards";
import { Input } from "@/components/ui/input";
import { EVENT_ITEMS } from "@/lib/mock-content";

const CATEGORY_FILTERS = ["All", "Live Music", "Comedy", "DJ", "Arts", "Community"];

export function SearchResultsClient() {
  const params = useSearchParams();
  const initialQuery = params.get("query") ?? "";
  const initialLocation = params.get("location") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [location, setLocation] = useState(initialLocation);
  const [activeCategory, setActiveCategory] = useState("All");

  const results = useMemo(() => {
    return EVENT_ITEMS.filter((item) => {
      const queryMatch =
        !query ||
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase()) ||
        item.venue.toLowerCase().includes(query.toLowerCase());

      const locationMatch = !location || item.location.toLowerCase().includes(location.toLowerCase());

      const categoryMatch =
        activeCategory === "All" ||
        item.tags.some((tag) => tag.toLowerCase().includes(activeCategory.toLowerCase())) ||
        item.subtitle.toLowerCase().includes(activeCategory.toLowerCase());

      return queryMatch && locationMatch && categoryMatch;
    });
  }, [activeCategory, location, query]);

  return (
    <>
      <div className="sectionHeader listHeader">
        <div>
          <h1>Search Results</h1>
          <p>{results.length} events found</p>
        </div>
      </div>

      <div className="searchControls">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events..." />
        <Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="City, State or ZIP" />
      </div>

      <FilterBar items={CATEGORY_FILTERS} activeItem={activeCategory} onSelect={setActiveCategory} />

      <div className="cardsGrid eventsDense" style={{ marginTop: 16 }}>
        {results.map((item) => (
          <EventShowcaseCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
}
