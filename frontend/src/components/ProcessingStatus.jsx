function ProcessingStatus({ status, message, progress, error, statistics }) {
    const getStatusIcon = () => {
        switch (status) {
            case 'uploading':
            case 'processing':
                return <div className="status-icon loading">⏳</div>;
            case 'complete':
                return <div className="status-icon success">✅</div>;
            case 'error':
                return <div className="status-icon error">❌</div>;
            default:
                return null;
        }
    };

    const getStatusTitle = () => {
        switch (status) {
            case 'uploading':
                return 'Uploading...';
            case 'processing':
                return 'Processing Document...';
            case 'complete':
                return 'Processing Complete!';
            case 'error':
                return 'Error Occurred';
            default:
                return '';
        }
    };

    return (
        <section className="status-section fade-in">
            <div className={`status-card status-${status}`}>
                <div className="status-header">
                    {getStatusIcon()}
                    <div className="status-info">
                        <h3 className="status-title">{getStatusTitle()}</h3>
                        <p className="status-message">{message}</p>
                    </div>
                </div>

                {(status === 'uploading' || status === 'processing') && (
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}

                {error && (
                    <div className="error-details">
                        <span className="error-icon">⚠️</span>
                        <span className="error-text">{error}</span>
                    </div>
                )}

                {status === 'complete' && statistics && (
                    <div className="statistics-grid">
                        {statistics.sectionsDetected > 0 && (
                            <div className="stat-item">
                                <span className="stat-value">{statistics.sectionsDetected}</span>
                                <span className="stat-label">Sections Detected</span>
                            </div>
                        )}
                        <div className="stat-item">
                            <span className="stat-value">{statistics.rulesApplied}</span>
                            <span className="stat-label">Rules Applied</span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-value">{statistics.appliedChanges}</span>
                            <span className="stat-label">Changes Made</span>
                        </div>
                        {statistics.errors > 0 && (
                            <div className="stat-item stat-error">
                                <span className="stat-value">{statistics.errors}</span>
                                <span className="stat-label">Errors</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

export default ProcessingStatus;
