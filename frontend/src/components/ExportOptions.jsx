import { useState, useCallback } from 'react';

const API_BASE = '/api';

function ExportOptions({ sessionId }) {
    const [exporting, setExporting] = useState({});

    const handleExport = useCallback(async (type, format) => {
        const key = `${type}-${format}`;
        setExporting(prev => ({ ...prev, [key]: true }));

        try {
            const endpoint = type === 'document'
                ? `${API_BASE}/export/${sessionId}/${format}`
                : `${API_BASE}/export-report/${sessionId}/${format}`;

            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('Export failed');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type === 'document' ? 'formatted-document' : 'comparison-report'}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed: ' + error.message);
        } finally {
            setExporting(prev => ({ ...prev, [key]: false }));
        }
    }, [sessionId]);

    const formats = [
        { id: 'pdf', label: 'PDF', icon: '📕' },
        { id: 'docx', label: 'DOCX', icon: '📘' },
        { id: 'txt', label: 'TXT', icon: '📝' }
    ];

    return (
        <div className="export-section fade-in">
            <h3 className="export-title">📥 Export Results</h3>

            <div className="export-options">
                <div className="export-group">
                    <div className="export-group-title">Formatted Document</div>
                    <div className="export-buttons">
                        {formats.map(format => (
                            <button
                                key={`doc-${format.id}`}
                                className="export-btn"
                                onClick={() => handleExport('document', format.id)}
                                disabled={exporting[`document-${format.id}`]}
                            >
                                {exporting[`document-${format.id}`] ? (
                                    <span className="spinner"></span>
                                ) : (
                                    format.icon
                                )}
                                <span className="format">{format.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="export-group">
                    <div className="export-group-title">Comparison Report</div>
                    <div className="export-buttons">
                        {formats.map(format => (
                            <button
                                key={`report-${format.id}`}
                                className="export-btn"
                                onClick={() => handleExport('report', format.id)}
                                disabled={exporting[`report-${format.id}`]}
                            >
                                {exporting[`report-${format.id}`] ? (
                                    <span className="spinner"></span>
                                ) : (
                                    format.icon
                                )}
                                <span className="format">{format.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ExportOptions;
