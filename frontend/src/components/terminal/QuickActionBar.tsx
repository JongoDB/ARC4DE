import type { QuickAction } from "@/types";

interface QuickActionBarProps {
  actions: QuickAction[];
  onAction: (command: string) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, string> = {
  trash: "🗑️",
  x: "✕",
  chat: "💬",
  "arrow-right": "→",
  rotate: "↻",
};

export function QuickActionBar({ actions, onAction, disabled }: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--color-bg-tertiary)] bg-[var(--color-bg-secondary)] px-3 overflow-x-auto">
      {actions.map((action) => (
        <button
          key={action.command}
          onClick={() => onAction(action.command)}
          disabled={disabled}
          className="flex shrink-0 items-center gap-1.5 rounded bg-[var(--color-bg-tertiary)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:opacity-50 disabled:cursor-not-allowed"
          title={action.command}
        >
          <span>{ICON_MAP[action.icon] ?? "•"}</span>
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
