'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  name: string;
  /** Minimal height to prevent layout shift when crashed */
  minHeight?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary for chart page sections.
 * Prevents a crash in one widget (TradingView, metrics, tape)
 * from taking down the entire chart page.
 */
export default class ChartErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[Chart "${this.props.name}"] crashed:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center text-center bg-[#060606] border border-white/[0.06] rounded-md"
          style={{ minHeight: this.props.minHeight || '120px' }}
        >
          <AlertTriangle className="w-5 h-5 text-red-400/70 mb-2" />
          <p className="text-xs text-neutral-400 mb-1">
            {this.props.name} failed to load
          </p>
          <p className="text-[10px] text-neutral-600 mb-2 max-w-[250px] truncate px-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
