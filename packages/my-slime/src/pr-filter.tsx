import { COLORS } from "./constants";

export type PrFilter = "all" | "open" | "draft" | "merged" | "no-pr";

export const PR_FILTERS: PrFilter[] = ["all", "open", "draft", "merged", "no-pr"];

const FILTER_COLORS: Record<PrFilter, string> = {
  all: COLORS.TEXT,
  open: COLORS.GREEN,
  draft: COLORS.DIM,
  merged: COLORS.PURPLE,
  "no-pr": COLORS.YELLOW,
};

interface PrFilterBarProps {
  activeFilter: PrFilter;
}

export const PrFilterBar = ({ activeFilter }: PrFilterBarProps) => (
  <text fg={COLORS.DIM}>
    {PR_FILTERS.map((filter, index) => {
      const isActive = filter === activeFilter;
      const separator = index < PR_FILTERS.length - 1 ? "  " : "";
      return (
        <span key={filter}>
          <span fg={isActive ? FILTER_COLORS[filter] : COLORS.DIM}>
            {isActive ? `[${filter}]` : ` ${filter} `}
          </span>
          {separator}
        </span>
      );
    })}
  </text>
);
