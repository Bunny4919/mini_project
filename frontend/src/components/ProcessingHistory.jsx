function ProcessingHistory({ history, onClose }) {
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const formatTime = (ms) => {
        if (ms < 1000) return `${ms}ms`;
        return `${(ms / 1000).toFixed(2)}s`;
    };

    return (
        <div className="history-panel fade-in">
            <div className="history-header">
                <h3>📜 Processing History</h3>
                <button className="close-btn" onClick={onClose}>✕</button>
            </div>

            <div className="history-content">
                {history.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">📭</span>
                        <p>No processing history yet</p>
                    </div>
                ) : (
                    <div className="history-list">
                        {history.map((entry, index) => (
                            <div key={index} className="history-item">
                                <div className="history-item-header">
                                    <span className="history-time">{formatDate(entry.timestamp)}</span>
                                    <span className="history-duration">{formatTime(entry.processingTime)}</span>
                                </div>
                                <div className="history-item-content">
                                    <div className="history-files">
                                        <span className="history-file">📋 {entry.rulesFile}</span>
                                        <span className="history-arrow">→</span>
                                        <span className="history-file">📄 {entry.documentFile}</span>
                                    </div>
                                    <div className="history-stats">
                                        <span className="history-changes">{entry.changesCount} changes applied</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProcessingHistory;
