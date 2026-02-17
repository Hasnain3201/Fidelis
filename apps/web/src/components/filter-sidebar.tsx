import { Fragment } from "react";

const EVENT_TYPES = ["Live Music", "Concert", "DJ Set", "Comedy Show"];

type FilterSidebarProps = {
  heading?: string;
};

export function FilterSidebar({ heading = "Filters" }: FilterSidebarProps) {
  return (
    <aside className="filterPanel">
      <h3>{heading}</h3>

      <label className="filterField">
        <span>Search</span>
        <input type="text" placeholder="Search events..." />
      </label>

      <label className="filterField">
        <span>Location</span>
        <div className="inlineFields">
          <input type="text" placeholder="City" />
          <input type="text" placeholder="State" />
          <input type="text" placeholder="ZIP" />
        </div>
      </label>

      <label className="filterField">
        <span>Date</span>
        <div className="inlineFields twoCol">
          <input type="text" placeholder="From" />
          <input type="text" placeholder="To" />
        </div>
      </label>

      <div className="filterField">
        <span>Event Types</span>
        <div className="checkboxGrid">
          {EVENT_TYPES.map((item) => (
            <label key={item} className="checkItem">
              <input type="checkbox" />
              <Fragment>{item}</Fragment>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
