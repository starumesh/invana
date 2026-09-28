import { useRef, useState, type FormEvent } from "react";
import {
  GUEST_CSV_TEMPLATE,
  GUEST_ROLE_LABELS,
  GUEST_ROLES,
  previewGuestCsv,
  validateGuest,
  type CsvPreview,
  type FieldErrors,
  type GuestRole,
  type GuestValue,
} from "@event-core";
import { FormField, ErrorBanner } from "@/components/events/ui";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { downloadFile } from "@/lib/download";
import { cn } from "@/lib/cn";

export type GuestDraft = { name: string; email: string; phone: string; bio: string; role: GuestRole };

const EMPTY_GUEST: GuestDraft = { name: "", email: "", phone: "", bio: "", role: "GUEST" };

export function GuestForm({
  initial = EMPTY_GUEST,
  submitLabel,
  onSubmit,
  onCancel,
  serverErrors,
  busy,
}: {
  initial?: GuestDraft;
  submitLabel: string;
  onSubmit: (guest: GuestValue) => Promise<boolean | void> | boolean | void;
  onCancel?: () => void;
  serverErrors?: FieldErrors;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState<GuestDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const nameRef = useRef<HTMLInputElement>(null);
  const shown = { ...errors, ...(serverErrors ?? {}) };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateGuest(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    const ok = await onSubmit(result.value);
    if (ok !== false && !onCancel) {
      setDraft(EMPTY_GUEST);
      nameRef.current?.focus();
    }
  }

  const set = (key: keyof GuestDraft) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
      <FormField label="Name" required error={shown.name}>
        {(p) => <Input {...p} ref={nameRef} value={draft.name} onChange={(e) => set("name")(e.target.value)} autoComplete="off" />}
      </FormField>
      <FormField label="Role" error={shown.role}>
        {(p) => (
          <Select {...p} value={draft.role} onChange={(e) => set("role")(e.target.value)}>
            {GUEST_ROLES.map((r) => (
              <option key={r} value={r}>
                {GUEST_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Email" hint="Optional" error={shown.email}>
        {(p) => <Input {...p} type="email" inputMode="email" value={draft.email} onChange={(e) => set("email")(e.target.value)} autoComplete="off" />}
      </FormField>
      <FormField label="Phone" hint="Optional · include country code for WhatsApp" error={shown.phone}>
        {(p) => <Input {...p} type="tel" inputMode="tel" value={draft.phone} onChange={(e) => set("phone")(e.target.value)} autoComplete="off" />}
      </FormField>
      <FormField label="Bio" hint="Optional · shown publicly only for speakers/hosts if you allow it" error={shown.bio} className="sm:col-span-2">
        {(p) => <Textarea {...p} rows={2} className="min-h-[64px]" value={draft.bio} onChange={(e) => set("bio")(e.target.value)} />}
      </FormField>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={busy}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const ROW_STYLES: Record<string, string> = {
  VALID: "text-emerald-800",
  INVALID: "text-red-700",
  DUPLICATE: "text-amber-800",
  OVER_CAPACITY: "text-amber-800",
};

const ROW_LABELS: Record<string, string> = {
  VALID: "Ready",
  INVALID: "Invalid",
  DUPLICATE: "Duplicate",
  OVER_CAPACITY: "Over capacity",
};

/** CSV import (Name,Email,Phone,Bio,Role) with a validation preview before anything is saved. */
export function CsvImport({
  existing,
  remainingCapacity,
  onImport,
  busy,
}: {
  existing: { name: string; email: string; phone: string }[];
  remainingCapacity: number;
  onImport: (guests: GuestValue[]) => Promise<void> | void;
  busy?: boolean;
}) {
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("That file is larger than 2 MB. Split it into smaller files.");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    const result = previewGuestCsv(text, { existing, remainingCapacity });
    if (result.headerError) {
      setError(result.headerError);
      setPreview(null);
      return;
    }
    setPreview(result);
  }

  function reset() {
    setPreview(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 py-2 text-sm font-medium focus-within:ring-4 focus-within:ring-gold/40 hover:bg-cream">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          Choose CSV file
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => downloadFile(new Blob([GUEST_CSV_TEMPLATE], { type: "text/csv" }), "invana-guests-template.csv")}
        >
          Download template
        </Button>
        <span className="text-xs text-ink-muted">Columns: Name, Email, Phone, Bio, Role</span>
      </div>
      <ErrorBanner message={error} />
      {preview ? (
        <div className="rounded-2xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 text-sm">
            <p>
              <span className="font-medium">{fileName}</span> · {preview.counts.VALID} ready
              {preview.counts.INVALID ? ` · ${preview.counts.INVALID} invalid` : ""}
              {preview.counts.DUPLICATE ? ` · ${preview.counts.DUPLICATE} duplicates` : ""}
              {preview.counts.OVER_CAPACITY ? ` · ${preview.counts.OVER_CAPACITY} over capacity` : ""}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={reset}>
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!preview.valid.length || busy}
                onClick={async () => {
                  await onImport(preview.valid);
                  reset();
                }}
              >
                Import {preview.valid.length} guest{preview.valid.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">CSV preview</caption>
              <thead className="sticky top-0 bg-cream text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Line</th>
                  <th scope="col" className="px-3 py-2">Name</th>
                  <th scope="col" className="px-3 py-2">Email / Phone</th>
                  <th scope="col" className="px-3 py-2">Role</th>
                  <th scope="col" className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.line} className="border-t border-stone-100">
                    <td className="px-3 py-2 tabular-nums text-ink-muted">{r.line}</td>
                    <td className="px-3 py-2">{r.raw.Name || <em className="text-ink-muted">missing</em>}</td>
                    <td className="px-3 py-2 text-ink-muted">{[r.raw.Email, r.raw.Phone].filter(Boolean).join(" · ")}</td>
                    <td className="px-3 py-2">{r.value ? GUEST_ROLE_LABELS[r.value.role] : r.raw.Role}</td>
                    <td className={cn("px-3 py-2 font-medium", ROW_STYLES[r.status])}>
                      {ROW_LABELS[r.status]}
                      {r.message && r.status !== "VALID" ? <span className="block text-xs font-normal">{r.message}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
