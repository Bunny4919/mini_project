import React from 'react';

/**
 * Error Boundary Component
 * 
 * Catches errors in child components and displays a user-friendly error UI
 * Prevents entire app from crashing due to component errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ 
            backgroundColor: '#fee', 
            border: '2px solid #f88', 
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '600px',
            margin: '2rem auto'
          }}>
            <h2 style={{ color: '#c00', marginTop: 0 }}>⚠️ Something went wrong</h2>
            <p style={{ color: '#333', marginBottom: '1rem' }}>
              The application encountered an error. Please try refreshing the page or clearing your browser cache.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ 
                textAlign: 'left', 
                backgroundColor: '#f5f5f5', 
                padding: '1rem',
                borderRadius: '4px',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: '300px'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button 
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              🔄 Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
