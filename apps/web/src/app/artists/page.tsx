import { FilterSidebar } from "@/components/filter-sidebar";
import { ArtistCard } from "@/components/showcase-cards";
import { ARTIST_ITEMS } from "@/lib/mock-content";

export default function ArtistsPage() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="sectionHeader listHeader">
          <div>
            <h1>Discover Artists</h1>
            <p>Find talented performers in your area</p>
          </div>
        </div>

        <div className="discoveryLayout">
          <FilterSidebar />

          <div className="cardsGrid three">
            {ARTIST_ITEMS.map((item) => (
              <ArtistCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
