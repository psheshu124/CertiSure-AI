import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CertiSure AI Error Boundary Caught Error]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-space-xl text-center">
          <div className="bg-surface-container-lowest p-space-xl rounded-2xl shadow-lg border border-outline-variant max-w-lg w-full flex flex-col items-center gap-space-md">
            <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">error</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold">
              Application Render Exception
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              CertiSure AI encountered an unexpected rendering error. Your data and session remain secure.
            </p>
            <div className="p-space-sm bg-surface-container-low rounded-lg w-full text-left font-mono text-metadata text-error overflow-x-auto">
              {this.state.error?.message || 'Unknown runtime error'}
            </div>
            <button
              onClick={this.handleReload}
              className="h-10 px-space-lg rounded-xl bg-primary text-on-primary font-body-md-medium flex items-center gap-space-xs shadow-sm hover:bg-primary-container transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
