interface LoadingSpinnerProps {
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function LoadingSpinner({ fullScreen, size = 'md', message }: LoadingSpinnerProps) {
  const sizes = { sm: 'h-5 w-5', md: 'h-10 w-10', lg: 'h-16 w-16' };

  const spinner = (
    <div className={`animate-spin rounded-full border-2 border-surface border-t-primary ${sizes[size]}`} aria-hidden="true" />
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-military-dark" role="status" aria-label={message ?? 'Memuat...'}>
        <div className="flex flex-col items-center gap-4">
          {spinner}
          <p className="text-text-muted text-sm animate-pulse">{message ?? 'Memuat...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8" role="status" aria-label={message ?? 'Memuat...'}>
      {spinner}
      {message && <span className="ml-3 text-sm text-text-muted">{message}</span>}
    </div>
  );
}
