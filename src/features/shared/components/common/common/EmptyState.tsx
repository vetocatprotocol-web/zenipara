import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({ title, description, icon, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-surface/80 bg-bg-card px-6 py-10 text-center ${className}`}>
      <div className="relative mb-4">
        {/* Outer glow ring */}
        <span className="absolute inset-0 rounded-full bg-primary/8 blur-md" aria-hidden="true" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-surface/60 bg-gradient-to-br from-primary/12 to-indigo-500/8 text-primary shadow-sm">
          {icon ?? <Inbox className="h-6 w-6" aria-hidden="true" />}
        </div>
      </div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-text-muted leading-relaxed">{description}</p>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
