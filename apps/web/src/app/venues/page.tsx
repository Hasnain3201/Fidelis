import { FilterSidebar } from "@/components/filter-sidebar";
import { VenueCard } from "@/components/showcase-cards";
import { VENUE_ITEMS } from "@/lib/mock-content";

export default function VenuesPage() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="sectionHeader listHeader">
          <div>
            <h1>Discover Venues</h1>
            <p>Find the perfect spot for your next night out</p>
          </div>
        </div>

        <div className="discoveryLayout">
          <FilterSidebar />

          <div>
            <div className="cardsGrid three">
              {VENUE_ITEMS.map((item) => (
                <VenueCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
