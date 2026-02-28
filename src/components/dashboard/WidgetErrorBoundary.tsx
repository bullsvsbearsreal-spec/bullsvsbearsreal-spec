'use client';

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  widgetName: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary that catches crashes in individual dashboard widgets
 * so one broken widget doesn't take down the entire dashboard.
 */
export default class WidgetErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[Widget "${this.props.widgetName}"] crashed:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-4 px-3 text-center">
          <AlertTriangle className="w-5 h-5 text-red-400/70 mb-2" />
          <p className="text-xs text-neutral-400 mb-1">
            {this.props.widgetName} failed to load
          </p>
          <p className="text-[10px] text-neutral-600 mb-2 max-w-[200px] truncate">
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-[10px] text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-colors"
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
