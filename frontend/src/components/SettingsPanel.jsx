function SettingsPanel({ settings, onUpdate, onClose }) {
    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={e => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>⚙️ Settings</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="settings-content">
                    {/* Appearance Section */}
                    <div className="settings-section">
                        <h3>Appearance</h3>

                        <div className="setting-item">
                            <label>Theme</label>
                            <div className="theme-options">
                                <button
                                    className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => onUpdate({ theme: 'dark' })}
                                >
                                    🌙 Dark
                                </button>
                                <button
                                    className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
                                    onClick={() => onUpdate({ theme: 'light' })}
                                >
                                    ☀️ Light
                                </button>
                            </div>
                        </div>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.compactView}
                                    onChange={(e) => onUpdate({ compactView: e.target.checked })}
                                />
                                Compact View
                            </label>
                            <span className="setting-desc">Reduce spacing for more content</span>
                        </div>
                    </div>

                    {/* Processing Section */}
                    <div className="settings-section">
                        <h3>Processing</h3>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.autoProcess}
                                    onChange={(e) => onUpdate({ autoProcess: e.target.checked })}
                                />
                                Auto-Process on Upload
                            </label>
                            <span className="setting-desc">Automatically process when document is uploaded</span>
                        </div>

                        <div className="setting-item">
                            <label>Default Export Format</label>
                            <select
                                value={settings.defaultExportFormat}
                                onChange={(e) => onUpdate({ defaultExportFormat: e.target.value })}
                                className="setting-select"
                            >
                                <option value="docx">DOCX (Word)</option>
                                <option value="pdf">PDF</option>
                                <option value="txt">TXT (Plain Text)</option>
                            </select>
                        </div>
                    </div>

                    {/* Display Section */}
                    <div className="settings-section">
                        <h3>Comparison Display</h3>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.showLineNumbers}
                                    onChange={(e) => onUpdate({ showLineNumbers: e.target.checked })}
                                />
                                Show Line Numbers
                            </label>
                        </div>

                        <div className="setting-item">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={settings.highlightChanges}
                                    onChange={(e) => onUpdate({ highlightChanges: e.target.checked })}
                                />
                                Highlight Changes
                            </label>
                            <span className="setting-desc">Color-code additions and removals</span>
                        </div>
                    </div>
                </div>

                <div className="settings-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsPanel;
