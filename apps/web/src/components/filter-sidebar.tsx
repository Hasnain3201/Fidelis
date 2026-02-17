import { Fragment } from "react";
import { Input } from "@/components/ui/input";

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
        <Input type="text" placeholder="Search events..." />
      </label>

      <label className="filterField">
        <span>Location</span>
        <div className="inlineFields">
          <Input type="text" placeholder="City" />
          <Input type="text" placeholder="State" />
          <Input type="text" placeholder="ZIP" />
        </div>
      </label>

      <label className="filterField">
        <span>Date</span>
        <div className="inlineFields twoCol">
          <Input type="text" placeholder="From" />
          <Input type="text" placeholder="To" />
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
