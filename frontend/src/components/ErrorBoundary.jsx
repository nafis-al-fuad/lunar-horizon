import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="aerospace-panel p-6 max-w-xl mx-auto my-12 border border-[#EF4444]/40 bg-[#0A0D15] rounded-xl font-mono text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-full bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center text-[#EF4444]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-wider">
              Diagnostic Intercept // View Render Fault
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              A temporary render fault occurred while evaluating telemetry components.
            </p>
          </div>
          {this.state.error && (
            <div className="text-[11px] text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 p-2.5 rounded text-left overflow-x-auto">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <button
            onClick={this.handleReset}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-[#E5A93C] hover:bg-[#F5BA4F] text-black font-bold text-xs btn-aerospace transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Recover Viewport State</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
