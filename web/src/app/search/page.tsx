import { Suspense } from "react";
import { SearchResultsClient } from "@/components/search-results-client";

export default function SearchPage() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <Suspense fallback={<p className="meta">Loading search results...</p>}>
          <SearchResultsClient />
        </Suspense>
      </div>
    </section>
  );
}
