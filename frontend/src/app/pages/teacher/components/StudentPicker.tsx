import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";

export interface StudentOption {
  id: string;
  label: string;
}

interface StudentPickerProps {
  options: StudentOption[];
  value: string;
  onChange: (id: string) => void;
  /** Placeholder when nothing is selected (e.g. an error message). */
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Cap on how many matches to render at once (keeps large rosters fast). */
  maxResults?: number;
}

/**
 * A lightweight typeahead for picking one student from a large roster. Filters
 * the provided options client-side by name/email substring — built for the 800+
 * student courses where a native <select> is unusable. No external deps.
 */
export function StudentPicker({
  options,
  value,
  onChange,
  placeholder = "Search students by name or email…",
  loading = false,
  disabled = false,
  maxResults = 50,
}: StudentPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  // Close the dropdown when clicking outside the picker.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter((o) => o.label.toLowerCase().includes(q))
      : options;
    return list.slice(0, maxResults);
  }, [query, options, maxResults]);

  // Show the selected label when closed; the live query while searching.
  const inputValue = open ? query : selected?.label ?? "";

  const choose = (o: StudentOption) => {
    onChange(o.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={inputValue}
          disabled={disabled || loading}
          placeholder={loading ? "Loading students…" : placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setHighlight(0);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHighlight((h) => Math.min(h + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (filtered[highlight]) choose(filtered[highlight]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="pr-8"
        />
        {loading ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ChevronsUpDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        )}
      </div>

      {open ? (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-input bg-background shadow-md">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {options.length === 0 ? "No students found" : "No matches"}
            </div>
          ) : (
            filtered.map((o, i) => (
              <button
                type="button"
                key={o.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                  i === highlight ? "bg-accent" : "",
                  o.id === value ? "font-medium" : "",
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    o.id === value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{o.label}</span>
              </button>
            ))
          )}
          {!query && options.length > filtered.length ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t">
              Showing {filtered.length} of {options.length} — type to narrow
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
