export default function ArtistDashboardLoading() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="stateLoadingWrap">
          <div className="stateSkeletonTitle" />
          <div className="stateSkeletonLine" />
          <div className="cardsGrid eventsDense stateSkeletonGrid">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`artist-dashboard-loading-${idx}`} className="stateSkeletonCard compact" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
