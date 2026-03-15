import { useState, useMemo } from 'react';

function ComparisonReport({ original, processed, changes, rulesApplied, sections, settings }) {
    const [viewMode, setViewMode] = useState('side-by-side'); // side-by-side, unified, changes-only
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [expandedChanges, setExpandedChanges] = useState(new Set());
    const [showLineNumbers, setShowLineNumbers] = useState(settings?.showLineNumbers ?? true);

    // Filter changes based on search and type
    const filteredChanges = useMemo(() => {
        return changes.filter(change => {
            const matchesSearch = !searchTerm ||
                change.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                change.before?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                change.after?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesType = filterType === 'all' || change.type === filterType;

            return matchesSearch && matchesType;
        });
    }, [changes, searchTerm, filterType]);

    // Get unique change types for filter
    const changeTypes = useMemo(() => {
        return [...new Set(changes.map(c => c.type))];
    }, [changes]);

    // Toggle change expansion
    const toggleChange = (index) => {
        const newExpanded = new Set(expandedChanges);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedChanges(newExpanded);
    };

    // Expand/collapse all
    const expandAll = () => {
        setExpandedChanges(new Set(filteredChanges.map((_, i) => i)));
    };

    const collapseAll = () => {
        setExpandedChanges(new Set());
    };

    // Copy to clipboard
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            // Would add toast notification here
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Add line numbers to text
    const addLineNumbers = (text) => {
        return text.split('\n').map((line, i) =>
            `${String(i + 1).padStart(4, ' ')} │ ${line}`
        ).join('\n');
    };

    // Generate inline diff
    const generateInlineDiff = (before, after) => {
        const beforeWords = before.split(/(\s+)/);
        const afterWords = after.split(/(\s+)/);

        // Simple word-level diff
        const result = [];
        let i = 0, j = 0;

        while (i < beforeWords.length || j < afterWords.length) {
            if (beforeWords[i] === afterWords[j]) {
                result.push({ type: 'same', text: beforeWords[i] });
                i++; j++;
            } else if (j < afterWords.length && !beforeWords.includes(afterWords[j])) {
                result.push({ type: 'add', text: afterWords[j] });
                j++;
            } else if (i < beforeWords.length) {
                result.push({ type: 'remove', text: beforeWords[i] });
                i++;
            } else {
                break;
            }
        }

        return result;
    };

    return (
        <section className="report-section fade-in">
            <div className="report-header">
                <div className="report-title-group">
                    <h2 className="report-title">📊 Comparison Report</h2>
                    <span className="changes-summary">
                        {filteredChanges.length} of {changes.length} changes • {rulesApplied} rules applied
                    </span>
                </div>

                <div className="report-controls">
                    {/* View Mode Toggle */}
                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'side-by-side' ? 'active' : ''}`}
                            onClick={() => setViewMode('side-by-side')}
                            title="Side by Side View"
                        >
                            ⬛⬛
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'unified' ? 'active' : ''}`}
                            onClick={() => setViewMode('unified')}
                            title="Unified View"
                        >
                            📄
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'changes-only' ? 'active' : ''}`}
                            onClick={() => setViewMode('changes-only')}
                            title="Changes Only"
                        >
                            📝
                        </button>
                    </div>

                    <button
                        className={`icon-btn ${showLineNumbers ? 'active' : ''}`}
                        onClick={() => setShowLineNumbers(!showLineNumbers)}
                        title="Toggle Line Numbers"
                    >
                        #
                    </button>
                </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="filter-bar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        placeholder="Search changes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    {searchTerm && (
                        <button
                            className="clear-btn"
                            onClick={() => setSearchTerm('')}
                        >
                            ✕
                        </button>
                    )}
                </div>

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Types</option>
                    {changeTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>

                <div className="expand-controls">
                    <button className="btn-small" onClick={expandAll}>Expand All</button>
                    <button className="btn-small" onClick={collapseAll}>Collapse All</button>
                </div>
            </div>

            {/* Side by Side View */}
            {viewMode === 'side-by-side' && (
                <div className="comparison-container">
                    <div className="comparison-panel">
                        <div className="comparison-panel-header before">
                            <span>📄 Original Document</span>
                            <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(original)}
                                title="Copy to clipboard"
                            >
                                📋
                            </button>
                        </div>
                        <pre className="comparison-content">
                            {showLineNumbers ? addLineNumbers(original) : original}
                        </pre>
                    </div>

                    <div className="comparison-panel">
                        <div className="comparison-panel-header after">
                            <span>✅ Processed Document</span>
                            <button
                                className="copy-btn"
                                onClick={() => copyToClipboard(processed)}
                                title="Copy to clipboard"
                            >
                                📋
                            </button>
                        </div>
                        <pre className="comparison-content">
                            {showLineNumbers ? addLineNumbers(processed) : processed}
                        </pre>
                    </div>
                </div>
            )}

            {/* Unified View */}
            {viewMode === 'unified' && (
                <div className="unified-view">
                    <div className="unified-header">
                        <span>📄 Unified Diff View</span>
                        <button
                            className="copy-btn"
                            onClick={() => copyToClipboard(processed)}
                            title="Copy processed to clipboard"
                        >
                            📋 Copy Processed
                        </button>
                    </div>
                    <div className="unified-content">
                        {original.split('\n').map((line, i) => {
                            const processedLine = processed.split('\n')[i] || '';
                            const isDifferent = line !== processedLine;

                            return (
                                <div key={i} className="unified-line-group">
                                    <div className={`unified-line ${isDifferent ? 'removed' : ''}`}>
                                        <span className="line-number">{i + 1}</span>
                                        <span className="line-indicator">{isDifferent ? '-' : ' '}</span>
                                        <span className="line-content">{line}</span>
                                    </div>
                                    {isDifferent && processedLine && (
                                        <div className="unified-line added">
                                            <span className="line-number">{i + 1}</span>
                                            <span className="line-indicator">+</span>
                                            <span className="line-content">{processedLine}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Changes List */}
            <div className="changes-list">
                <div className="changes-list-header">
                    <span>📝 Change Details ({filteredChanges.length})</span>
                </div>

                {filteredChanges.length === 0 ? (
                    <div className="empty-state">
                        <span className="empty-icon">🔍</span>
                        <p>No changes match your search criteria</p>
                    </div>
                ) : (
                    filteredChanges.map((change, index) => (
                        <div
                            key={index}
                            className={`change-item ${expandedChanges.has(index) ? 'expanded' : ''}`}
                            onClick={() => toggleChange(index)}
                        >
                            <div className="change-header">
                                <span className={`change-type type-${change.type}`}>
                                    {change.type}
                                </span>
                                <span className="change-description">
                                    {change.description}
                                </span>
                                <span className="expand-indicator">
                                    {expandedChanges.has(index) ? '▼' : '▶'}
                                </span>
                            </div>

                            {expandedChanges.has(index) && change.before && change.after && (
                                <div className="change-diff">
                                    <div className="diff-row">
                                        <span className="diff-label">Before:</span>
                                        <code className="diff-before">{change.before}</code>
                                    </div>
                                    <div className="diff-row">
                                        <span className="diff-label">After:</span>
                                        <code className="diff-after">{change.after}</code>
                                    </div>
                                    {change.position !== undefined && (
                                        <div className="diff-meta">
                                            Position: {change.position}
                                            {change.line && ` • Line: ${change.line}`}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Sections Summary (if available) */}
            {sections && sections.length > 0 && (
                <div className="sections-summary">
                    <h3>📑 Detected Sections</h3>
                    <div className="sections-grid">
                        {Object.entries(
                            sections.reduce((acc, s) => {
                                acc[s.type] = (acc[s.type] || 0) + 1;
                                return acc;
                            }, {})
                        ).map(([type, count]) => (
                            <div key={type} className="section-badge">
                                <span className="section-type">{type}</span>
                                <span className="section-count">{count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

export default ComparisonReport;
