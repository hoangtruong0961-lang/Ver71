
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/50 rounded-lg text-red-800 dark:text-red-200 shadow-lg">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            ⚠️ Đã xảy ra lỗi hệ thống (Crash)
          </h2>
          <p className="text-sm mb-4 opacity-90">Hệ thống ghi nhận một lỗi giao diện nghiêm trọng. Vui lòng xem chi tiết kỹ thuật bên dưới để debug:</p>
          
          <div className="bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded p-4 font-mono text-xs overflow-auto max-h-[300px] mb-4 text-left">
            <div className="font-bold text-red-700 dark:text-red-400 mb-1">
              [{this.state.error?.name || "Error"}]: {this.state.error?.message || "Không có mô tả chi tiết."}
            </div>
            {this.state.error?.stack && (
              <pre className="whitespace-pre-wrap opacity-75 mt-2 text-[10px] leading-normal select-text">
                {this.state.error.stack}
              </pre>
            )}
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md transition-all text-sm"
            >
              Tải lại trang (F5)
            </button>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 hover:bg-gray-300 dark:hover:bg-zinc-700 text-gray-800 dark:text-zinc-200 font-medium rounded-md transition-all text-sm"
            >
              Thử quay lại
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
