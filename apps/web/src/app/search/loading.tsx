export default function SearchLoading() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="stateLoadingWrap">
          <div className="stateSkeletonTitle" />
          <div className="stateSkeletonLine" />
          <div className="cardsGrid eventsDense stateSkeletonGrid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`search-route-loading-${idx}`} className="stateSkeletonCard" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
