import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatEventTime,
  GUEST_ROLE_LABELS,
  GUEST_ROLES,
  type GuestFilter,
  type GuestPage,
  type GuestQuery,
  type GuestRole,
  type GuestRow,
  type GuestSort,
} from "@event-core";
import { GuestStageBadge, PassActions } from "@/components/events/PassActions";
import { exportGuestsCsv, fmtDate, PAGE_SIZES, type FilterTab } from "@/components/events/guestTableConfig";
import { ProgressBar } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import { errorMessage, eventsApi, generatePassesForGuests } from "@/services/eventManagement/client";

type ShareableEvent = Parameters<typeof PassActions>[0]["event"];

/**
 * Server-paginated guest/pass table. Search, filter, and sort run in the database, so it
 * stays fast for thousands of guests; only one page of rows is ever in memory.
 */
export function GuestTable({
  eventId,
  event,
  timezone,
  exportName,
  editable,
  mode,
  tabs,
  refreshKey,
  initialFilter = "ALL",
  onEdit,
  onRemove,
  onNotice,
  onError,
  onCountsChanged,
}: {
  eventId: string;
  event: ShareableEvent;
  timezone: string;
  exportName: string;
  editable: boolean;
  mode: "guests" | "passes";
  tabs: FilterTab[];
  refreshKey?: number;
  initialFilter?: GuestFilter;
  onEdit?: (row: GuestRow) => void;
  onRemove?: (row: GuestRow) => void;
  onNotice: (msg: string) => void;
  onError: (msg: string | null) => void;
  onCountsChanged?: () => void;
}) {
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<GuestFilter>(initialFilter);
  const [role, setRole] = useState<GuestRole | "ALL">("ALL");
  const [sort, setSort] = useState<GuestSort>(mode === "passes" ? "name" : "created");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState<GuestPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  /** Any change to what is being listed starts again at page 1 in the same render. */
  const resetting = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setOffset(0);
    setSelected(new Set());
  };
  const setQR = useMemo(() => resetting(setQ), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => setQR(qInput.trim()), 250);
    return () => clearTimeout(t);
  }, [qInput, setQR]);

  const query: GuestQuery = useMemo(() => ({ q, filter, role, sort, dir, limit, offset }), [q, filter, role, sort, dir, limit, offset]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPage(await eventsApi.queryGuests(eventId, query));
    } catch (err) {
      onError(errorMessage(err, "Unable to load guests. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [eventId, query, onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const changed = useCallback(async () => {
    await load();
    onCountsChanged?.();
  }, [load, onCountsChanged]);

  const rows = page?.rows ?? [];
  const eligible = rows.filter((r) => r.stage === "NO_PASS");
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const selectedEligible = selectedRows.filter((r) => r.stage === "NO_PASS");
  const total = page?.total ?? 0;

  function toggleSort(col: GuestSort) {
    setOffset(0);
    if (sort === col) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setDir(col === "name" ? "asc" : "desc");
    }
  }

  async function generateSelected() {
    const ids = selectedEligible.map((r) => r.id);
    if (!ids.length) return;
    onError(null);
    try {
      const r = await generatePassesForGuests(eventId, ids, setProgress);
      onNotice(`${r.generated} pass${r.generated === 1 ? "" : "es"} generated. Share each one from its row, or later.`);
      setSelected(new Set());
      await changed();
    } catch (err) {
      onError(errorMessage(err, "Unable to generate guest passes. Please try again."));
    } finally {
      setProgress(null);
    }
  }

  async function exportCsv() {
    setExporting(true);
    onError(null);
    try {
      const data = selectedRows.length ? selectedRows : await eventsApi.exportGuests(eventId, { q, filter, role, sort, dir });
      exportGuestsCsv(data, `${exportName}-guests${filter !== "ALL" ? `-${filter.toLowerCase()}` : ""}.csv`, timezone);
      onNotice(`Exported ${data.length} guest${data.length === 1 ? "" : "s"}${selectedRows.length ? " (selected)" : filter !== "ALL" || q ? " (current filter)" : ""}.`);
    } catch (err) {
      onError(errorMessage(err, "Unable to export guests."));
    } finally {
      setExporting(false);
    }
  }

  const SortHeader = ({ col, children, className }: { col: GuestSort; children: string; className?: string }) => (
    <th scope="col" aria-sort={sort === col ? (dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-2 font-medium", className)}>
      <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-ink focus:outline-none focus-visible:underline">
        {children}
        <span aria-hidden className={sort === col ? "text-gold-dark" : "text-ink-faint"}>
          {sort === col ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );

  return (
    <section aria-label={mode === "passes" ? "Passes" : "Guest list"}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          aria-label="Search guests"
          placeholder="Search name, email, phone, or pass ID…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="min-w-[220px] flex-1"
        />
        <div className="w-40">
          <Select aria-label="Filter by role" value={role} onChange={(e) => resetting(setRole)(e.target.value as GuestRole | "ALL")}>
            <option value="ALL">All roles</option>
            {GUEST_ROLES.map((r) => (
              <option key={r} value={r}>
                {GUEST_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void exportCsv()} disabled={exporting || !total}>
          {exporting ? "Exporting…" : selectedRows.length ? `Export ${selectedRows.length} selected` : "Export Guests"}
        </Button>
      </div>

      <div role="tablist" aria-label="Filter guests" className="mt-3 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={filter === t.id}
            onClick={() => resetting(setFilter)(t.id)}
            className={cn("rounded-full px-3 py-1.5 text-sm transition", filter === t.id ? "bg-ink text-cream" : "border border-stone-300 bg-white hover:border-stone-400")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {editable ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-200 bg-cream/70 px-3 py-2 text-sm" role="toolbar" aria-label="Bulk actions">
          <span className="font-medium" aria-live="polite">
            {selected.size} selected
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(rows.map((r) => r.id)))} disabled={!rows.length}>
            Select page
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(eligible.map((r) => r.id)))} disabled={!eligible.length}>
            Select without pass ({eligible.length})
          </Button>
          {selected.size ? (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          ) : null}
          <Button size="sm" variant="gold" className="ml-auto" disabled={!selectedEligible.length || Boolean(progress)} onClick={() => void generateSelected()}>
            Generate {selectedEligible.length || ""} pass{selectedEligible.length === 1 ? "" : "es"}
          </Button>
        </div>
      ) : null}
      {progress ? (
        <div className="mt-3">
          <ProgressBar value={progress.done} max={progress.total} label="Generating guest passes" />
        </div>
      ) : null}

      <div className={cn("mt-3 overflow-x-auto rounded-3xl border border-stone-200 bg-white", loading && page && "opacity-60")} aria-busy={loading}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">
            {total} guests, sorted by {sort} {dir === "asc" ? "ascending" : "descending"}
          </caption>
          <thead className="border-b border-stone-200 bg-cream/60 text-xs text-ink-muted">
            <tr>
              {editable ? (
                <th scope="col" className="w-10 px-3 py-2">
                  <span className="sr-only">Select</span>
                </th>
              ) : null}
              <SortHeader col="name">Guest</SortHeader>
              {mode === "passes" ? (
                <>
                  <SortHeader col="stage">Pass</SortHeader>
                  <SortHeader col="generated">Generated</SortHeader>
                  <SortHeader col="checked_in">Check-in</SortHeader>
                </>
              ) : (
                <>
                  <SortHeader col="stage">Status</SortHeader>
                  <SortHeader col="created">Added</SortHeader>
                </>
              )}
              <th scope="col" className="px-3 py-2 text-right font-medium uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!page && loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td colSpan={editable ? 6 : 5} className="px-3 py-3">
                      <div className="h-6 animate-soft-pulse rounded bg-stone-100" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.id} className={cn("border-t border-stone-100 align-top", r.stage === "CANCELLED" && "bg-stone-50 text-ink-muted")}>
                    {editable ? (
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[#8c6d45]"
                          checked={selected.has(r.id)}
                          onChange={() =>
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <p className="font-medium text-ink">
                        {r.name}
                        {r.role !== "GUEST" ? <span className="font-normal text-ink-muted"> · {GUEST_ROLE_LABELS[r.role]}</span> : null}
                      </p>
                      <p className="max-w-[260px] truncate text-xs text-ink-muted">{[r.email, r.phone].filter(Boolean).join(" · ") || "No contact details"}</p>
                      {mode === "guests" && r.bio ? <p className="max-w-[260px] truncate text-xs text-ink-muted">{r.bio}</p> : null}
                    </td>
                    {mode === "passes" ? (
                      <>
                        <td className="px-3 py-3">
                          <GuestStageBadge stage={r.stage} />
                          {r.pass ? <p className="mt-1 font-mono text-xs">{r.pass.publicId}</p> : null}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink-muted">{fmtDate(r.pass?.issuedAt, timezone)}</td>
                        <td className="px-3 py-3 tabular-nums">
                          {r.pass?.checkedInAt ? (
                            <span className="text-emerald-700">✓ {formatEventTime(r.pass.checkedInAt, timezone)}</span>
                          ) : (
                            <span className="text-ink-muted">Not checked in</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-3">
                          <GuestStageBadge stage={r.stage} />
                        </td>
                        <td className="px-3 py-3 tabular-nums text-ink-muted">{fmtDate(r.createdAt, timezone)}</td>
                      </>
                    )}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <PassActions
                          eventId={eventId}
                          event={event}
                          guest={r}
                          editable={editable}
                          showBadge={false}
                          onChanged={changed}
                          onNotice={onNotice}
                          onError={onError}
                        />
                        {mode === "guests" && editable && r.stage !== "CANCELLED" ? (
                          <>
                            {onEdit ? (
                              <Button size="sm" variant="ghost" onClick={() => onEdit(r)} aria-label={`Edit ${r.name}`}>
                                Edit
                              </Button>
                            ) : null}
                            {onRemove ? (
                              <Button size="sm" variant="ghost" onClick={() => onRemove(r)} aria-label={`Remove ${r.name}`}>
                                Remove
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {page && !rows.length ? <p className="px-4 py-10 text-center text-sm text-ink-muted">No guests match.</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <span aria-live="polite">
          {total ? `${offset + 1}–${Math.min(offset + rows.length, total)} of ${total.toLocaleString()}` : "0 guests"}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-28">
            <Select aria-label="Rows per page" value={String(limit)} onChange={(e) => resetting(setLimit)(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => (
                <option key={n} value={String(n)}>
                  {n} / page
                </option>
              ))}
            </Select>
          </div>
          <Button size="sm" variant="secondary" disabled={offset === 0 || loading} onClick={() => setOffset((o) => Math.max(0, o - limit))}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" disabled={offset + limit >= total || loading} onClick={() => setOffset((o) => o + limit)}>
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
