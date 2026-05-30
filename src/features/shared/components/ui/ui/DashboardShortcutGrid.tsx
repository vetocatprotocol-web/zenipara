import { Link, type To } from 'react-router-dom';
import { ICONS } from '../../icons';
import type { IconName } from '../../icons';

interface ShortcutItem {
  href: To;
  label: string;
  description?: string;
  icon: IconName;
  toneClass?: string;
}

interface DashboardShortcutGridProps {
  title?: string;
  description?: string;
  items: ShortcutItem[];
  columnsClassName?: string;
}

export default function DashboardShortcutGrid({
  title,
  description,
  items,
  columnsClassName = 'grid-cols-1 sm:grid-cols-2',
}: DashboardShortcutGridProps) {
  return (
    <div>
      {(title || description) && (
        <div className="panel-heading mb-3">
          <div>
            {title && <h3 className="panel-heading__title">{title}</h3>}
            {description && <p className="panel-heading__desc">{description}</p>}
          </div>
        </div>
      )}
      <div className={`grid-cards-responsive gap-3 ${columnsClassName}`}>
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={`${item.href}-${item.label}`}
              to={item.href}
              className={`group rounded-2xl border border-surface/70 bg-bg-card card-padding-responsive transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg dark:hover:bg-surface/30 ${item.toneClass ?? ''}`}
            >
              <div className="mb-2 flex items-start gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-surface/60 bg-gradient-to-br from-primary/12 to-primary/4 text-primary transition-transform duration-200 group-hover:scale-110 shadow-sm">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="min-w-0 break-words text-sm font-semibold leading-snug text-text-primary">{item.label}</h3>
              </div>
              {item.description && <p className="text-xs text-text-muted">{item.description}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
