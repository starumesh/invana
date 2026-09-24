import { useState } from "react";
import { messagesFor } from "@/config/welcome-messages";
import { Input, Label, Select, Textarea } from "@/components/ui/Field";
import { fileToDataUrl } from "@/lib/url";
import type { DateValue, EventTypeId, FieldSpec, TimeValue } from "@/types";

type Props = {
  fields: FieldSpec[];
  values: Record<string, unknown>;
  eventType?: EventTypeId;
  onChange: (key: string, value: unknown) => void;
};

const OPTIONAL_GROUP = "More details";
const PHOTO_GROUPS = new Set(["Photo", "Photos"]);
const COVER_CROP_HINT = "Portrait or landscape — we’ll cover-crop to the frame.";

export function DynamicFields({ fields, values, eventType, onChange }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = fields.filter((field) => field.group !== OPTIONAL_GROUP);
  const optional = fields.filter((field) => field.group === OPTIONAL_GROUP);
  const groups = groupFields(primary);
  const filledOptional = optional.filter((field) => hasValue(values[field.key])).length;

  return (
    <div className="space-y-8">
      {groups.map(([group, specs]) => {
        const imageSpecs = specs.filter((spec) => spec.type === "image");
        const isPhotoSection = PHOTO_GROUPS.has(group) && imageSpecs.length > 0;
        const multiPhoto = isPhotoSection && imageSpecs.length > 1;

        return (
          <section key={group} className="space-y-3 animate-fade-up">
            <div>
              <h3 className="font-serif text-xl text-ink">{group}</h3>
              {isPhotoSection ? <p className="mt-1 text-sm text-ink-muted">{COVER_CROP_HINT}</p> : null}
            </div>
            <div
              className={
                multiPhoto ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2"
              }
            >
              {specs.map((spec) => {
                const isImage = spec.type === "image";
                const spanFull =
                  !multiPhoto &&
                  (spec.type === "textarea" || spec.type === "message" || isImage);

                return (
                  <div key={spec.key} className={spanFull ? "sm:col-span-2" : ""}>
                    <FieldControl
                      spec={spec}
                      value={values[spec.key]}
                      eventType={eventType}
                      onChange={onChange}
                      compactImage={isPhotoSection}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {optional.length ? (
        <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white/70">
          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-cream-dark/40"
          >
            <div>
              <h3 className="font-serif text-xl text-ink">More details</h3>
              <p className="mt-0.5 text-sm text-ink-muted">
                Dress code, RSVP, hosts, hashtag, and other optional lines
                {filledOptional ? ` · ${filledOptional} filled` : ""}
              </p>
            </div>
            <span className="text-sm text-gold-dark">{moreOpen ? "Hide" : "Show"}</span>
          </button>
          {moreOpen ? (
            <div className="grid gap-4 border-t border-stone-100 px-5 py-5 sm:grid-cols-2">
              {optional.map((spec) => (
                <div
                  key={spec.key}
                  className={spec.type === "textarea" || spec.type === "image" ? "sm:col-span-2" : ""}
                >
                  <FieldControl spec={spec} value={values[spec.key]} eventType={eventType} onChange={onChange} />
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  return Boolean(value);
}

function FieldControl({
  spec,
  value,
  eventType,
  onChange,
  compactImage = false,
}: {
  spec: FieldSpec;
  value: unknown;
  eventType?: EventTypeId;
  onChange: (key: string, value: unknown) => void;
  compactImage?: boolean;
}) {
  const id = `field-${spec.key}`;

  if (spec.type === "date") {
    const date = (value as DateValue | undefined) ?? { day: 1, month: 1, year: 2026 };
    return (
      <div>
        <Label>{spec.label}</Label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor={`${id}-day`}>Day</Label>
            <Input
              id={`${id}-day`}
              type="number"
              min={1}
              max={31}
              value={date.day}
              onChange={(e) => onChange(spec.key, { ...date, day: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-month`}>Month</Label>
            <Input
              id={`${id}-month`}
              type="number"
              min={1}
              max={12}
              value={date.month}
              onChange={(e) => onChange(spec.key, { ...date, month: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-year`}>Year</Label>
            <Input
              id={`${id}-year`}
              type="number"
              min={2020}
              max={2100}
              value={date.year}
              onChange={(e) => onChange(spec.key, { ...date, year: Number(e.target.value) })}
            />
          </div>
        </div>
      </div>
    );
  }

  if (spec.type === "time") {
    const time = (value as TimeValue | undefined) ?? { hour: 18, minute: 30, format: "12h" as const };
    const hour12 = time.hour % 12 || 12;
    const period = time.hour >= 12 ? "PM" : "AM";
    return (
      <div>
        <Label>{spec.label}</Label>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor={`${id}-hour`}>Hour</Label>
            <Input
              id={`${id}-hour`}
              type="number"
              min={1}
              max={12}
              value={hour12}
              onChange={(e) => {
                const next = Number(e.target.value);
                const hour24 = period === "PM" ? (next % 12) + 12 : next % 12;
                onChange(spec.key, { ...time, hour: hour24 });
              }}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-minute`}>Minute</Label>
            <Input
              id={`${id}-minute`}
              type="number"
              min={0}
              max={59}
              value={time.minute}
              onChange={(e) => onChange(spec.key, { ...time, minute: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor={`${id}-period`}>AM/PM</Label>
            <Select
              id={`${id}-period`}
              value={period}
              onChange={(e) => {
                const nextPeriod = e.target.value;
                const base = time.hour % 12;
                onChange(spec.key, {
                  ...time,
                  format: "12h",
                  hour: nextPeriod === "PM" ? base + 12 : base,
                });
              }}
            >
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  if (spec.type === "message") {
    const options = messagesFor(eventType);
    const current = typeof value === "string" ? value : options[0] ?? "";
    const selectValue = options.includes(current) ? current : "__custom__";
    return (
      <div className="space-y-3">
        <div>
          <Label htmlFor={id}>{spec.label}</Label>
          <Select
            id={id}
            value={selectValue}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                onChange(spec.key, options.includes(current) ? "" : current);
              } else {
                onChange(spec.key, e.target.value);
              }
            }}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value="__custom__">Write your own…</option>
          </Select>
        </div>
        {selectValue === "__custom__" ? (
          <Textarea
            value={current}
            maxLength={spec.maxLength ?? 220}
            onChange={(e) => onChange(spec.key, e.target.value)}
            placeholder="Write a short welcome message"
          />
        ) : null}
      </div>
    );
  }

  if (spec.type === "image") {
    return (
      <ImageField
        id={id}
        label={spec.label}
        value={value}
        compact={compactImage}
        onChange={(next) => onChange(spec.key, next)}
      />
    );
  }

  if (spec.type === "textarea") {
    return (
      <div>
        <Label htmlFor={id}>{spec.label}</Label>
        <Textarea
          id={id}
          value={typeof value === "string" ? value : ""}
          maxLength={spec.maxLength}
          placeholder={spec.placeholder}
          onChange={(e) => onChange(spec.key, e.target.value)}
        />
      </div>
    );
  }

  if (spec.type === "select" && spec.options) {
    return (
      <div>
        <Label htmlFor={id}>{spec.label}</Label>
        <Select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(spec.key, e.target.value)}
        >
          <option value="">Select…</option>
          {spec.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id}>
        {spec.label}
        {spec.required ? " *" : ""}
      </Label>
      <Input
        id={id}
        type={spec.type === "email" ? "email" : spec.type === "url" ? "url" : spec.type === "number" ? "number" : "text"}
        value={typeof value === "string" || typeof value === "number" ? value : ""}
        placeholder={spec.placeholder}
        maxLength={spec.maxLength}
        required={spec.required}
        onChange={(e) => onChange(spec.key, e.target.value)}
      />
    </div>
  );
}

function ImageField({
  id,
  label,
  value,
  compact,
  onChange,
}: {
  id: string;
  label: string;
  value: unknown;
  compact: boolean;
  onChange: (next: string) => void;
}) {
  const src = typeof value === "string" ? value : "";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    onChange(dataUrl);
  }

  if (compact) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white/80 p-3">
        <div className="flex items-start gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-cream-dark ring-1 ring-stone-200">
            {src ? (
              <img src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center border border-dashed border-stone-300 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
                Empty
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
              id={id}
              type="file"
              accept="image/*"
              className="py-2 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-cream-dark file:px-2 file:py-1 file:text-xs file:text-ink"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            {src ? (
              <button
                type="button"
                className="mt-1.5 text-xs text-ink-muted underline"
                onClick={() => onChange("")}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          id={id}
          type="file"
          accept="image/*"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {src ? (
          <button type="button" className="text-sm text-ink-muted underline" onClick={() => onChange("")}>
            Remove
          </button>
        ) : null}
      </div>
      {src ? (
        <img src={src} alt="" className="mt-3 h-28 w-28 rounded-xl object-cover ring-1 ring-stone-200" />
      ) : null}
    </div>
  );
}

function groupFields(fields: FieldSpec[]): [string, FieldSpec[]][] {
  const map = new Map<string, FieldSpec[]>();
  for (const field of fields) {
    const group = field.group ?? "Details";
    const list = map.get(group) ?? [];
    list.push(field);
    map.set(group, list);
  }
  return Array.from(map.entries());
}
