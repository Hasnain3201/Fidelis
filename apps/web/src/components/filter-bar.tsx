"use client";

type FilterBarProps = {
  items: string[];
  activeItem?: string;
  onSelect?: (item: string) => void;
};

export function FilterBar({ items, activeItem, onSelect }: FilterBarProps) {
  return (
    <div className="filterBar">
      {items.map((item) => {
        const active = activeItem === item;
        return (
          <button
            type="button"
            key={item}
            className={active ? "filterBarChip active" : "filterBarChip"}
            onClick={() => onSelect?.(item)}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
