"use client";

import { useHeaderSearchStore } from "@/store/headerSearchStore";

/* HeaderSearch (Option 2 restoration, §II.24): pre-removal this lived inline
   in Header.js and rendered only while a page had registered a search
   surface in useHeaderSearchStore (visible flag). Its only consumer was the
   Providers page, which phase 2 replaced with a page-local search field
   (P-01) and dropped the registration — so the store had no producers left.
   Restored as its own component wired to the same store; the Providers page
   registers again and folds the header query into its filter alongside the
   page-local field (closest current equivalent of the original surface). */
export default function HeaderSearch() {
  const visible = useHeaderSearchStore((s) => s.visible);
  const query = useHeaderSearchStore((s) => s.query);
  const placeholder = useHeaderSearchStore((s) => s.placeholder);
  const setQuery = useHeaderSearchStore((s) => s.setQuery);

  if (!visible) return null;

  return (
    <div className="relative w-[150px] sm:w-[200px] xl:w-[220px]">
      <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-text-muted text-[16px] pointer-events-none">
        search
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder || "Search"}
        className="w-full h-8 pl-7 pr-7 rounded-lg border border-border bg-surface-2 text-sm text-text-main placeholder:text-text-subtle focus:outline-none focus:border-border-strong transition-colors"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main p-0.5 rounded"
          aria-label="Clear search"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      )}
    </div>
  );
}
