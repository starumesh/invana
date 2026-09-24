import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  DeleteIcon,
  DownloadIcon,
  EditIcon,
  OpenIcon,
  PublishIcon,
  ShareIcon,
} from "@/components/ui/Icons";
import { cn } from "@/lib/cn";
import { inviteUrl } from "@/lib/url";
import type { StoredEvent } from "@/types";

export type DashboardPanel = "publish" | "share" | "download" | null;

type Props = {
  event: StoredEvent;
  open: DashboardPanel;
  onToggle: (panel: Exclude<DashboardPanel, null>) => void;
  onDelete: () => void;
};

function Action({
  active,
  onClick,
  href,
  to,
  icon,
  label,
  danger,
}: {
  active?: boolean;
  onClick?: () => void;
  href?: string;
  to?: string;
  icon: ReactNode;
  label: string;
  danger?: boolean;
}) {
  const className = cn(
    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
    danger
      ? "text-ink-muted hover:bg-red-50 hover:text-red-700"
      : active
        ? "bg-ink text-cream"
        : "text-ink-muted hover:bg-stone-100 hover:text-ink",
  );

  const body = (
    <>
      {icon}
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className} title={label}>
        {body}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} title={label}>
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-pressed={active}
      title={label}
    >
      {body}
    </button>
  );
}

export function DashboardEventActions({ event, open, onToggle, onDelete }: Props) {
  const isInvitation = event.config.kind === "invitation";
  const published = event.status === "published";

  return (
    <div
      className="flex shrink-0 flex-wrap items-center justify-end gap-0.5"
      role="toolbar"
      aria-label="Event actions"
    >
      <Action to={`/builder/${event.id}`} icon={<EditIcon className="h-3.5 w-3.5" />} label="Edit" />
      <Action
        active={open === "download"}
        onClick={() => onToggle("download")}
        icon={<DownloadIcon className="h-3.5 w-3.5" />}
        label="Download"
      />
      {isInvitation ? (
        <>
          <Action
            active={open === "publish"}
            onClick={() => onToggle("publish")}
            icon={<PublishIcon className="h-3.5 w-3.5" />}
            label={published ? "Update" : "Publish"}
          />
          <Action
            active={open === "share"}
            onClick={() => onToggle("share")}
            icon={<ShareIcon className="h-3.5 w-3.5" />}
            label="Share"
          />
          {published ? (
            <Action
              href={inviteUrl(event.slug)}
              icon={<OpenIcon className="h-3.5 w-3.5" />}
              label="Open"
            />
          ) : null}
        </>
      ) : null}
      <span className="mx-0.5 hidden h-4 w-px bg-stone-200 sm:block" aria-hidden />
      <Action
        onClick={onDelete}
        icon={<DeleteIcon className="h-3.5 w-3.5" />}
        label="Delete"
        danger
      />
    </div>
  );
}
