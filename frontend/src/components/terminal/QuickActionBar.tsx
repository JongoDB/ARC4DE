import type { QuickAction } from "@/types";
import { Trash2, X, MessageSquare, ArrowRight, RotateCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface QuickActionBarProps {
  actions: QuickAction[];
  onAction: (command: string) => void;
  disabled?: boolean;
}

const ICON_MAP: Record<string, LucideIcon> = {
  trash: Trash2,
  x: X,
  chat: MessageSquare,
  "arrow-right": ArrowRight,
  rotate: RotateCw,
};

export function QuickActionBar({
  actions,
  onAction,
  disabled,
}: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 overflow-x-auto">
      {actions.map((action) => {
        const Icon = ICON_MAP[action.icon];
        return (
          <button
            key={action.command}
            onClick={() => onAction(action.command)}
            disabled={disabled}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            title={action.command}
          >
            {Icon && <Icon size={14} />}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
