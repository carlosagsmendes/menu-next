"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
} from "react";
import Link from "next/link";
import { searchContent, type SearchResult } from "@/lib/search";

const DEBOUNCE_MS = 300;

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = "search-results-listbox";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchContent(value);
        setResults(hits);
        setOpen(true);
      });
    }, DEBOUNCE_MS);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  function handleResultClick() {
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  const showDropdown = open && (results.length > 0 || isPending);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          placeholder="Search…"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="h-7 w-44 rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        {isPending && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
          </div>
        )}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 max-h-64 w-72 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {results.length === 0 && isPending ? (
            <li className="px-3 py-2 text-xs text-zinc-400">Searching…</li>
          ) : (
            results.map((result) => (
              <li key={result.id} role="option" aria-selected={false}>
                <Link
                  href={result.href}
                  onClick={handleResultClick}
                  className="block px-3 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  <span className="block text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {result.title}
                  </span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                    {result.description}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
