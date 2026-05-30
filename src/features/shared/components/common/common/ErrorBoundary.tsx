import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const loginHref = `${import.meta.env.BASE_URL}#/login`;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console for debugging; can be extended with a monitoring service
    console.error('[KARYO OS] Unhandled Error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-military-dark p-6">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-accent-red/30 bg-bg-card p-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent-red/15">
              <AlertTriangle className="h-8 w-8 text-accent-red" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Terjadi Kesalahan Sistem</h1>
              <p className="mt-2 text-sm text-text-muted">
                Komponen mengalami error yang tidak terduga. Tim teknis telah dicatat.
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-xl border border-surface/70 bg-surface/30 px-4 py-3 text-left">
                <p className="text-xs font-mono text-accent-red/80 break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Coba Lagi
              </button>
              <a
                href={loginHref}
                className="w-full rounded-xl border border-surface/70 px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-primary"
              >
                Kembali ke Login
              </a>
            </div>
          </div>

          <p className="mt-6 text-xs text-text-muted">
            KARYO OS v1.0.0 — Jika masalah berlanjut, hubungi Administrator.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
