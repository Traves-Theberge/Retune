import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

const focusRing = 'outline-none focus-visible:ring-1 focus-visible:ring-focus';

const variants = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-raised border border-line text-fg hover:bg-hover',
  ghost: 'text-muted hover:text-fg hover:bg-hover',
  danger: 'text-danger border border-danger/40 hover:bg-danger/10',
};

const sizes = {
  sm: 'px-2 py-1 text-[11px]',
  md: 'px-3 py-1.5 text-xs',
};

export function Button({
  variant = 'secondary',
  size = 'sm',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded font-medium transition disabled:opacity-40 disabled:pointer-events-none ${focusRing} ${variants[variant]} ${sizes[size]} ${className}`}
    />
  );
}

export function IconButton({
  icon: Icon,
  label,
  active,
  className = '',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      {...rest}
      className={`inline-flex items-center justify-center p-0.5 rounded text-subtle hover:text-fg hover:bg-hover transition disabled:opacity-30 disabled:pointer-events-none ${focusRing} ${className}`}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}
