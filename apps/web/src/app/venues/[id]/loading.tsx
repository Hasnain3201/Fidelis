export default function VenueDetailsLoading() {
  return (
    <section className="siteSection">
      <div className="siteContainer">
        <div className="stateLoadingWrap">
          <div className="stateSkeletonTitle" />
          <div className="stateSkeletonLine" />
          <div className="stateSkeletonCard tall" />
        </div>
      </div>
    </section>
  );
}