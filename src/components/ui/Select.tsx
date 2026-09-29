import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";

type OptionItem = { value: string; label: ReactNode; text: string; disabled: boolean; group?: string };

type Props = {
  value?: string | number | readonly string[];
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  className?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
}

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean };

function collect(children: ReactNode, group?: string, out: OptionItem[] = []): OptionItem[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<OptionProps & { label?: string }>;
    if (el.type === "optgroup") {
      collect(el.props.children, el.props.label, out);
    } else if (el.type === "option") {
      const text = textOf(el.props.children);
      out.push({
        value: el.props.value !== undefined ? String(el.props.value) : text,
        label: el.props.children,
        text,
        disabled: Boolean(el.props.disabled),
        group,
      });
    }
  });
  return out;
}

/**
 * Invana dropdown. Same API as a native <select> (`<option>` / `<optgroup>` children,
 * `onChange(e) => e.target.value`) but rendered as a styled, accessible listbox so every
 * dropdown matches the design system.
 */
export function Select({ value, defaultValue, onChange, children, className, id, name, disabled, placeholder, ...aria }: Props) {
  const options = useMemo(() => collect(children), [children]);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value !== undefined ? String(value) : uncontrolled;
  const selected = options.find((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ text: "", at: 0 });
  const autoId = useId();
  const buttonId = id ?? `${autoId}-button`;
  const listId = `${autoId}-list`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function commit(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    if (value === undefined) setUncontrolled(opt.value);
    const target = { value: opt.value, name } as unknown as HTMLSelectElement;
    onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  }

  function openList() {
    if (disabled) return;
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  }

  function step(from: number, dir: 1 | -1) {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (!options[i].disabled) return i;
    return from;
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => step(a, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => step(a, -1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(step(-1, 1));
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(step(options.length, -1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1) {
      const now = Date.now();
      typeahead.current = { text: (now - typeahead.current.at < 700 ? typeahead.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(typeahead.current.text));
      if (hit >= 0) setActive(hit);
    }
  }

  let lastGroup: string | undefined;

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        id={buttonId}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={aria["aria-label"]}
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-left text-sm text-ink outline-none ring-gold/30 transition",
          "hover:border-stone-300 focus:border-gold focus:ring-4 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-ink-faint",
          "aria-[invalid=true]:border-red-400",
          open && "border-gold ring-4",
          className,
        )}
      >
        <span className={cn("truncate", !selected && "text-ink-faint")}>{selected ? selected.label : (placeholder ?? "Select…")}</span>
        <svg aria-hidden viewBox="0 0 20 20" fill="none" className={cn("h-4 w-4 shrink-0 text-gold-dark transition", open && "rotate-180")}>
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 z-50 mt-1.5 max-h-72 overflow-auto rounded-xl border border-stone-200 bg-white py-1 text-sm shadow-lift"
        >
          {options.map((o, i) => {
            const header = o.group && o.group !== lastGroup ? o.group : null;
            lastGroup = o.group;
            return (
              <li key={`${o.group ?? ""}-${o.value}`} role="presentation">
                {header ? (
                  <div role="presentation" className="px-3.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-dark">
                    {header}
                  </div>
                ) : null}
                <div
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={o.value === current}
                  aria-disabled={o.disabled || undefined}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(i)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2",
                    o.group && "pl-5",
                    i === active && "bg-cream",
                    o.value === current && "font-medium text-ink",
                    o.disabled && "cursor-not-allowed text-ink-faint",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === current ? (
                    <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4 text-gold-dark" fill="none">
                      <path d="M5 10.5l3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
