"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FloatingSelect } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/text";

const DEFAULT_PAGE_SIZES = [10, 20, 40, 60] as const;

export type PaginationProps = {
  page: number;
  pages: number;
  pageSize: number;
  pageSizeOptions?: readonly number[];
  pageSizeLabel?: string;
  id?: string;
  className?: string;
  summary?: ReactNode;
  previousHref?: string | null;
  nextHref?: string | null;
  onPageSizeChange: (size: number) => void;
};

/** Shared list pagination: page size, page label, and previous/next controls. */
export function Pagination({
  page,
  pages,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  pageSizeLabel = "Items per page",
  id = "pagination-page-size",
  className,
  summary,
  previousHref,
  nextHref,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, pages || 1);
  const current = Math.min(Math.max(1, page || 1), totalPages);
  const sizes = pageSizeOptions.length ? pageSizeOptions : DEFAULT_PAGE_SIZES;
  const sizeValue = sizes.includes(pageSize) ? pageSize : sizes[0];

  return (
    <nav className={cn("ui-pagination", className)} aria-label="Pagination">
      {summary ? <div className="ui-pagination-summary">{summary}</div> : null}
      <div className="ui-pagination-controls">
        <label className="ui-pagination-size">
          <FloatingSelect
            label="Show"
            id={id}
            aria-label={pageSizeLabel}
            value={String(sizeValue)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            options={sizes.map(String)}
          />
        </label>
        <span className="ui-pagination-status" aria-live="polite">
          Page {current} of {totalPages}
        </span>
        {previousHref ? (
          <Link href={previousHref} className="iconbtn ui-pagination-prev" aria-label="Previous page">
            <Icon name="chevron" />
          </Link>
        ) : (
          <button type="button" className="iconbtn ui-pagination-prev" disabled aria-label="Previous page">
            <Icon name="chevron" />
          </button>
        )}
        {nextHref ? (
          <Link href={nextHref} className="iconbtn" aria-label="Next page">
            <Icon name="chevron" />
          </Link>
        ) : (
          <button type="button" className="iconbtn" disabled aria-label="Next page">
            <Icon name="chevron" />
          </button>
        )}
      </div>
    </nav>
  );
}
