import { useState, useCallback, useEffect, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import FileUpload from './components/FileUpload';
import ProcessingStatus from './components/ProcessingStatus';
import ComparisonReport from './components/ComparisonReport';
import ExportOptions from './components/ExportOptions';
import SettingsPanel from './components/SettingsPanel';
import ProcessingHistory from './components/ProcessingHistory';
import SpellCheckModal from './components/SpellCheckModal';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import { InteractiveHoverButton } from './components/ui/interactive-hover-button';
import { PulseBeams } from './components/ui/pulse-beams';
import { useAuth } from './context/AuthContext';

// Minimal beam data for header accent strip
const HEADER_BEAMS = [
    {
        path: "M 0 50 Q 200 10 450 50 T 858 50",
        gradientConfig: {
            initial: { x1: "0%", x2: "10%", y1: "0%", y2: "0%" },
            animate: { x1: ["0%", "100%"], x2: ["10%", "110%"], y1: ["0%", "0%"], y2: ["0%", "0%"] },
            transition: { duration: 4, repeat: Infinity, repeatType: "loop", ease: "linear", delay: 0 }
        }
    },
    {
        path: "M 0 30 Q 300 70 600 30 T 858 30",
        gradientConfig: {
            initial: { x1: "0%", x2: "10%", y1: "0%", y2: "0%" },
            animate: { x1: ["0%", "100%"], x2: ["10%", "110%"], y1: ["0%", "0%"], y2: ["0%", "0%"] },
            transition: { duration: 5, repeat: Infinity, repeatType: "loop", ease: "linear", delay: 1.5 }
        }
    }
];

const API_BASE = '/api';

// Load saved settings (always dark)
const loadSettings = () => {
    try {
        const saved = localStorage.getItem('documentFormatterSettings');
        const parsed = saved ? JSON.parse(saved) : {};
        return { ...getDefaultSettings(), ...parsed, theme: 'dark' };
    } catch {
        return getDefaultSettings();
    }
};

const getDefaultSettings = () => ({
    theme: 'dark',
    autoProcess: false,
    defaultExportFormat: 'docx',
    showLineNumbers: true,
    highlightChanges: true,
    compactView: false
});

// Animation variants
const fadeInUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }
    })
};

const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } }
};

// ─── Protected route wrapper ──────────────────────────────────────────────────
function RequireAuth({ children }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return children;
}

// ─── Main document formatter page ────────────────────────────────────────────
function MainApp() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [sessionId, setSessionId] = useState(null);
    const [rulesFile, setRulesFile] = useState(null);
    const [documentFile, setDocumentFile] = useState(null);
    const [rulesCount, setRulesCount] = useState(0);
    const [status, setStatus] = useState('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [progress, setProgress] = useState(0);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);
    const [settings, setSettings] = useState(loadSettings);
    const [showSettings, setShowSettings] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState([]);
    const [statistics, setStatistics] = useState(null);

    // Spell-check state
    const [spellIssues, setSpellIssues] = useState([]);
    const [showSpellModal, setShowSpellModal] = useState(false);
    const [toasts, setToasts] = useState([]);
    const toastTimers = useRef({});

    // Stable ref to the latest handleProcess — breaks stale-closure cycle
    const handleProcessRef = useRef(null);

    // Always dark theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('documentFormatterSettings', JSON.stringify({ ...settings, theme: 'dark' }));
    }, [settings]);

    // Clear all pending toast timers on unmount
    useEffect(() => {
        const timers = toastTimers.current;
        return () => {
            Object.values(timers).forEach(clearTimeout);
        };
    }, []);

    // SSE connection for real-time updates
    useEffect(() => {
        if (!sessionId) return;

        const eventSource = new EventSource(`${API_BASE}/events/${sessionId}`);

        eventSource.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            setStatusMessage(data.step);
            setProgress(data.progress);
        });

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [sessionId]);

    // Update settings
    const updateSettings = useCallback((newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings, theme: 'dark' }));
    }, []);

    // Show a toast notification
    const showToast = useCallback((message, type = 'success', duration = 3500) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        toastTimers.current[id] = setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    // Fetch history
    const fetchHistory = useCallback(async () => {
        if (!sessionId) return;
        try {
            const response = await fetch(`${API_BASE}/history/${sessionId}`);
            const data = await response.json();
            setHistory(data.history || []);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    }, [sessionId]);

    // Upload rules file
    const handleRulesUpload = useCallback(async (file) => {
        setRulesFile(file);
        setStatus('uploading');
        setStatusMessage('Uploading rules file...');
        setProgress(10);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/upload/rules`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.message);

            setSessionId(data.sessionId);
            setRulesCount(data.rulesCount);
            setProgress(25);
            setStatusMessage(`Parsed ${data.rulesCount} rules from ${data.fileName}`);
            setStatus('idle');
        } catch (err) {
            setError(err.message);
            setStatus('error');
            setRulesFile(null);
        }
    }, []);

    // Upload document file
    const handleDocumentUpload = useCallback(async (file) => {
        if (!sessionId) {
            setError('Please upload a rules file first');
            return;
        }

        setDocumentFile(file);
        setStatus('uploading');
        setStatusMessage('Uploading document...');
        setProgress(40);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('sessionId', sessionId);

        try {
            const response = await fetch(`${API_BASE}/upload/document`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.message);

            setProgress(50);
            setStatusMessage(`Document uploaded: ${data.fileName} (${data.lineCount} lines)`);
            setStatus('idle');

            // --- NLP Spell Check (non-fatal) ---
            try {
                setProgress(55);
                setStatusMessage('Running spell check…');
                const scRes = await fetch(`${API_BASE}/spellcheck`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId })
                });
                const scData = await scRes.json();
                if (scRes.ok && scData.issues && scData.issues.length > 0) {
                    setSpellIssues(scData.issues);
                    setShowSpellModal(true);
                } else {
                    showToast('✅ No spelling issues detected', 'success');
                    if (settings.autoProcess) {
                        setTimeout(() => handleProcessRef.current?.(), 500);
                    }
                }
            } catch {
                showToast('⚠️ Spell check unavailable', 'warning');
                if (settings.autoProcess) {
                    setTimeout(() => handleProcessRef.current?.(), 500);
                }
            }

        } catch (err) {
            setError(err.message);
            setStatus('error');
            setDocumentFile(null);
        }
    }, [sessionId, settings.autoProcess, showToast]);

    // Handle spell-check modal Done
    const handleSpellDone = useCallback(async (decisions) => {
        setShowSpellModal(false);
        const fixCount = Object.values(decisions).filter(v => v !== null).length;

        if (fixCount > 0) {
            try {
                setStatusMessage('Applying spelling corrections…');
                const res = await fetch(`${API_BASE}/apply-corrections`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId, corrections: decisions })
                });
                if (!res.ok) throw new Error('Server error applying corrections');
                showToast(`✅ Applied ${fixCount} spelling correction${fixCount !== 1 ? 's' : ''}`, 'success');
            } catch {
                showToast('⚠️ Could not apply corrections', 'warning');
            }
        } else {
            showToast('ℹ️ All words kept as-is', 'info');
        }

        if (settings.autoProcess) {
            setTimeout(() => handleProcessRef.current?.(), 500);
        }
    }, [sessionId, settings.autoProcess, showToast]);

    // Process document
    const handleProcess = useCallback(async () => {
        if (!sessionId || !documentFile) {
            setError('Please upload both rules and document files');
            return;
        }

        setStatus('processing');
        setStatusMessage('Applying formatting rules...');
        setProgress(60);
        setError(null);

        try {
            const response = await fetch(`${API_BASE}/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || data.message);

            setProgress(80);
            setStatistics(data.statistics);
            setStatusMessage('Generating comparison report...');

            const reportResponse = await fetch(`${API_BASE}/report/${sessionId}`);
            const reportData = await reportResponse.json();
            if (!reportResponse.ok) throw new Error(reportData.error || reportData.message);

            setReport({
                original: reportData.original,
                processed: reportData.processed,
                changes: reportData.changes,
                rulesApplied: reportData.rulesApplied,
                sections: reportData.sections,
                metadata: reportData.metadata
            });

            setProgress(100);
            setStatusMessage(`Complete! Applied ${data.changesCount} changes in ${data.processingTime}ms`);
            setStatus('complete');

            fetchHistory();
        } catch (err) {
            setError(err.message);
            setStatus('error');
        }
    }, [sessionId, documentFile, fetchHistory]);

    // Keep the ref in sync with the latest version of handleProcess.
    useEffect(() => {
        handleProcessRef.current = handleProcess;
    });

    // Reset
    const handleReset = useCallback(async () => {
        if (sessionId) {
            try {
                await fetch(`${API_BASE}/session/${sessionId}`, { method: 'DELETE' });
            } catch (e) { /* ignore */ }
        }

        setSessionId(null);
        setRulesFile(null);
        setDocumentFile(null);
        setRulesCount(0);
        setStatus('idle');
        setStatusMessage('');
        setProgress(0);
        setReport(null);
        setError(null);
        setStatistics(null);
        setHistory([]);
        setSpellIssues([]);
        setShowSpellModal(false);
    }, [sessionId]);

    const handleRemoveRules = useCallback(() => {
        handleReset();
    }, [handleReset]);

    const handleRemoveDocument = useCallback(() => {
        setDocumentFile(null);
        setReport(null);
        setStatistics(null);
    }, []);

    const handleLogout = useCallback(() => {
        logout();
        navigate('/login', { replace: true });
    }, [logout, navigate]);

    const canProcess = sessionId && documentFile && status !== 'processing';

    // Get user initials for avatar
    const getInitials = (name) => {
        if (!name) return '?';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
        <div className="app">
            {/* Ambient background noise overlay */}
            <div className="noise-overlay" aria-hidden="true" />
            <div className="ambient-orb ambient-orb-1" aria-hidden="true" />
            <div className="ambient-orb ambient-orb-2" aria-hidden="true" />

            {/* Header */}
            <motion.header
                className="header"
                initial="hidden"
                animate="visible"
                variants={fadeInUp}
                custom={0}
            >
                <div className="header-top">
                    <motion.div className="logo-group" variants={fadeInUp} custom={0.5}>
                        <span className="logo-icon" aria-hidden="true">⬡</span>
                        <h1>DocRule</h1>
                    </motion.div>
                    <motion.div className="header-actions" variants={fadeInUp} custom={1}>
                        <motion.button
                            className="icon-btn"
                            onClick={() => setShowHistory(!showHistory)}
                            title="Processing History"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            📜
                        </motion.button>
                        <motion.button
                            className="icon-btn"
                            onClick={() => setShowSettings(!showSettings)}
                            title="Settings"
                            whileHover={{ scale: 1.1, rotate: 90 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                        >
                            ⚙️
                        </motion.button>

                        {/* User avatar + logout */}
                        <div className="user-menu">
                            <div className="user-avatar" title={user?.email}>
                                {getInitials(user?.name)}
                            </div>
                            <span className="user-name">{user?.name?.split(' ')[0]}</span>
                            <motion.button
                                className="logout-btn"
                                onClick={handleLogout}
                                title="Sign out"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                ↩ Sign out
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
                <motion.p variants={fadeInUp} custom={1.5}>
                    Rule-based document formatting — upload your rules and target document to automatically apply formatting corrections, style alignment, and content adjustments.
                </motion.p>
            </motion.header>

            {/* Pulse beams accent */}
            <motion.div
                className="pulse-beams-wrapper"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 1 }}
                aria-hidden="true"
            >
                <PulseBeams
                    beams={HEADER_BEAMS}
                    height={80}
                    baseColor="rgba(99,102,241,0.12)"
                    accentColor="rgba(139,92,246,0.2)"
                    className="!h-20"
                />
            </motion.div>

            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        key="settings"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25 }}
                    >
                        <SettingsPanel
                            settings={settings}
                            onUpdate={updateSettings}
                            onClose={() => setShowSettings(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showHistory && history.length > 0 && (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.25 }}
                    >
                        <ProcessingHistory
                            history={history}
                            onClose={() => setShowHistory(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Spell Check Modal */}
            <AnimatePresence>
                {showSpellModal && spellIssues.length > 0 && (
                    <motion.div
                        key="spell"
                        initial={fadeIn.hidden}
                        animate={fadeIn.visible}
                        exit={fadeIn.hidden}
                    >
                        <SpellCheckModal
                            issues={spellIssues}
                            onDone={handleSpellDone}
                            onClose={() => {
                                setShowSpellModal(false);
                                showToast('ℹ️ Spell check skipped', 'info');
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast notifications */}
            <AnimatePresence>
                <div className="toast-container">
                    {toasts.map(t => (
                        <motion.div
                            key={t.id}
                            className={`toast toast-${t.type}`}
                            initial={{ opacity: 0, x: 48, scale: 0.95 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 48, scale: 0.95 }}
                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {t.message}
                        </motion.div>
                    ))}
                </div>
            </AnimatePresence>

            <main>
                <motion.div
                    className="main-content"
                    initial="hidden"
                    animate="visible"
                    variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
                >
                    <motion.div variants={fadeInUp}>
                        <FileUpload
                            title="Rules File"
                            icon="📋"
                            description="Upload a file containing formatting rules (PDF, DOCX, or TXT)"
                            accept=".pdf,.docx,.txt"
                            file={rulesFile}
                            onFileSelect={handleRulesUpload}
                            onFileRemove={handleRemoveRules}
                            fileInfo={rulesCount > 0 ? `${rulesCount} rules parsed` : null}
                            disabled={status === 'processing'}
                        />
                    </motion.div>

                    <motion.div variants={fadeInUp}>
                        <FileUpload
                            title="Target Document"
                            icon="📄"
                            description="Upload the document to format (PDF, DOCX, or TXT)"
                            accept=".pdf,.docx,.txt"
                            file={documentFile}
                            onFileSelect={handleDocumentUpload}
                            onFileRemove={handleRemoveDocument}
                            disabled={!sessionId || status === 'processing'}
                            disabledMessage="Please upload rules first"
                        />
                    </motion.div>
                </motion.div>

                {/* Process section */}
                <motion.div
                    className="process-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                >
                    {status === 'processing' ? (
                        <button className="btn btn-primary process-btn" disabled>
                            <motion.span
                                className="spinner"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                            />
                            Processing...
                        </button>
                    ) : (
                        <InteractiveHoverButton
                            text="⚡ Process Document"
                            onClick={handleProcess}
                            disabled={!canProcess}
                            className={!canProcess ? 'opacity-40 cursor-not-allowed' : ''}
                        />
                    )}

                    <AnimatePresence>
                        {(rulesFile || documentFile) && status !== 'processing' && (
                            <motion.button
                                key="reset-btn"
                                className="btn btn-secondary"
                                onClick={handleReset}
                                style={{ marginLeft: '1rem' }}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                            >
                                🔄 Reset
                            </motion.button>
                        )}
                    </AnimatePresence>
                </motion.div>

                <AnimatePresence>
                    {(status !== 'idle' || error) && (
                        <motion.div
                            key="processing-status"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 16 }}
                            transition={{ duration: 0.35 }}
                        >
                            <ProcessingStatus
                                status={status}
                                message={statusMessage}
                                progress={progress}
                                error={error}
                                statistics={statistics}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {report && status === 'complete' && (
                        <motion.div
                            key="report"
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <ComparisonReport
                                original={report.original}
                                processed={report.processed}
                                changes={report.changes}
                                rulesApplied={report.rulesApplied}
                                sections={report.sections}
                                settings={settings}
                            />

                            <ExportOptions
                                sessionId={sessionId}
                                defaultFormat={settings.defaultExportFormat}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            <motion.footer
                className="footer"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.5 }}
            >
                <p>DocRule — Rule-Based Document Processing System • {new Date().getFullYear()}</p>
            </motion.footer>
        </div>
    );
}

// ─── Root router ──────────────────────────────────────────────────────────────
function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
                path="/"
                element={
                    <RequireAuth>
                        <MainApp />
                    </RequireAuth>
                }
            />
            {/* Catch-all → home */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default App;
