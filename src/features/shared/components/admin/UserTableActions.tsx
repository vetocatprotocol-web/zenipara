import { useState, useRef, useEffect } from 'react';
import { ICONS } from '../../icons';
import Button from '../common/Button';
import type { User } from '../../types';

interface TableActionMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  disabled?: boolean;
  divider?: boolean;
}

export interface UserTableActionsProps {
  user: User;
  currentUserId?: string;
  onDetail: () => void;
  onResetPin: () => void;
  onRoleEdit: () => void;
  onToggleActive: () => void;
  onUnlock?: () => void;
  onDelete: () => void;
}

export default function UserTableActions({
  user,
  currentUserId,
  onDetail,
  onResetPin,
  onRoleEdit,
  onToggleActive,
  onUnlock,
  onDelete,
}: UserTableActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Determine if user is locked
  const isLocked = user.locked_until && new Date(user.locked_until) > new Date();

  // Build menu items based on user state and permissions
  const menuItems: TableActionMenuItem[] = [
    {
      id: 'detail',
      label: 'Lihat Detail',
      icon: <ICONS.Eye className="h-3.5 w-3.5" />,
      action: () => {
        setIsOpen(false);
        onDetail();
      },
    },
    {
      id: 'reset-pin',
      label: 'Reset PIN',
      icon: <ICONS.Key className="h-3.5 w-3.5" />,
      action: () => {
        setIsOpen(false);
        onResetPin();
      },
    },
    {
      id: 'role-edit',
      label: 'Ubah Role',
      icon: <ICONS.Shield className="h-3.5 w-3.5" />,
      action: () => {
        setIsOpen(false);
        onRoleEdit();
      },
    },
    ...(isLocked && onUnlock
      ? [
          {
            id: 'unlock',
            label: 'Buka Kunci',
            icon: <ICONS.Unlock className="h-3.5 w-3.5 text-accent-gold" />,
            action: () => {
              setIsOpen(false);
              onUnlock();
            },
            variant: 'warning' as const,
            divider: true,
          } as TableActionMenuItem,
        ]
      : []),
    {
      id: 'toggle-active',
      label: user.is_active ? 'Nonaktifkan' : 'Aktifkan',
      icon: user.is_active ? <ICONS.X className="h-3.5 w-3.5" /> : <ICONS.Check className="h-3.5 w-3.5" />,
      action: () => {
        setIsOpen(false);
        onToggleActive();
      },
      variant: user.is_active ? 'default' : 'success',
    },
    {
      id: 'delete',
      label: 'Hapus',
      icon: <ICONS.Trash className="h-3.5 w-3.5" />,
      action: () => {
        setIsOpen(false);
        onDelete();
      },
      variant: 'danger',
      disabled: currentUserId === user.id,
    },
  ];

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        triggerRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative inline-block">
      <Button
        ref={triggerRef}
        size="sm"
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2"
        title="Aksi personel"
      >
        <span className="flex items-center gap-1.5">
          <ICONS.MoreVertical className="h-4 w-4" />
        </span>
      </Button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-surface/40 bg-bg-card shadow-lg z-50 animate-fade-in"
        >
          <div className="py-1">
            {menuItems.map((item, idx) => (
              <div key={item.id}>
                {item.divider && idx > 0 && <div className="my-1 h-px bg-surface/40" />}
                <button
                  onClick={item.action}
                  disabled={item.disabled}
                  className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 transition-colors ${
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : item.variant === 'danger'
                        ? 'hover:bg-accent-red/10 text-accent-red hover:text-accent-red'
                        : item.variant === 'warning'
                          ? 'hover:bg-accent-gold/10 text-accent-gold hover:text-accent-gold'
                          : item.variant === 'success'
                            ? 'hover:bg-success/10 text-success hover:text-success'
                            : 'hover:bg-primary/5 text-text-primary hover:text-primary'
                  }`}
                  title={item.disabled ? 'Tidak bisa dilakukan' : item.label}
                >
                  {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
                  <span className="flex-1">{item.label}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
