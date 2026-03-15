import { useState, useMemo, useCallback, useEffect, useRef } from 'react';

/**
 * SpellCheckModal
 *
 * Accessibility-compliant dialog that shows ALL unique misspelled words in a
 * single scrollable table. The user decides per-word whether to fix or keep,
 * then clicks Done. Keyboard-navigable; Escape closes without applying changes.
 *
 * @param {{ word: string, suggestions: string[], occurrences: number, context: string }[]} issues
 * @param {(decisions: Record<string, string|null>) => void} onDone
 * @param {() => void} onClose
 */
export default function SpellCheckModal({ issues, onDone, onClose }) {
    const modalRef = useRef(null);
    const closeRef = useRef(null);   // "Skip" button — first focusable element
    const doneRef = useRef(null);   // "Done"  button — last  focusable element

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /** decisions: word → chosen replacement (string) or `null` (keep) */
    const [decisions, setDecisions] = useState(() => {
        const init = {};
        for (const { word, suggestions } of issues) {
            init[word] = suggestions[0] ?? null;
        }
        return init;
    });

    /** Set of words the user has chosen to keep as-is */
    const [keepSet, setKeepSet] = useState(() => new Set());

    // -------------------------------------------------------------------------
    // Keyboard handling — Escape closes, Tab traps focus inside the modal
    // -------------------------------------------------------------------------

    useEffect(() => {
        const FOCUSABLE = 'button, [href], select, input, [tabindex]:not([tabindex="-1"])';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key !== 'Tab') return;

            const nodes = [...(modalRef.current?.querySelectorAll(FOCUSABLE) ?? [])];
            const first = nodes[0];
            const last = nodes[nodes.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        // Move focus into the modal on mount.
        closeRef.current?.focus();

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Prevent body scroll while modal is open.
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // -------------------------------------------------------------------------
    // Derived data
    // -------------------------------------------------------------------------

    const fixCount = useMemo(
        () => issues.length - keepSet.size,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [issues.length, keepSet]  // `keepSet` reference changes on every update
    );

    // -------------------------------------------------------------------------
    // Handlers (all stable via useCallback)
    // -------------------------------------------------------------------------

    const toggleKeep = useCallback((word) => {
        setKeepSet(prev => {
            const next = new Set(prev);
            if (next.has(word)) next.delete(word);
            else next.add(word);
            return next;
        });
    }, []);

    const handleSuggestionChange = useCallback((word, value) => {
        setDecisions(prev => ({ ...prev, [word]: value }));
        // Changing the suggestion implicitly means "fix this word".
        setKeepSet(prev => {
            if (!prev.has(word)) return prev;   // nothing to change
            const next = new Set(prev);
            next.delete(word);
            return next;
        });
    }, []);

    const handleFixAll = useCallback(() => {
        setKeepSet(new Set());
    }, []);

    const handleKeepAll = useCallback(() => {
        setKeepSet(new Set(issues.map(i => i.word)));
    }, [issues]);

    const handleDone = useCallback(() => {
        const result = {};
        for (const { word } of issues) {
            result[word] = keepSet.has(word) ? null : (decisions[word] ?? null);
        }
        onDone(result);
    }, [issues, keepSet, decisions, onDone]);

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------

    const titleId = 'sc-modal-title';
    const subtitleId = 'sc-modal-subtitle';

    return (
        <div
            className="sc-backdrop"
            /* Clicking outside the modal panel closes it */
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                ref={modalRef}
                className="sc-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={subtitleId}
            >
                {/* ── Header ── */}
                <div className="sc-header">
                    <div className="sc-title">
                        <span className="sc-icon" aria-hidden="true">🔍</span>
                        <div>
                            <h2 id={titleId}>Spell Check Results</h2>
                            <p id={subtitleId} className="sc-subtitle">
                                Found <strong>{issues.length}</strong> potentially misspelled
                                word{issues.length !== 1 ? 's' : ''}. Review and decide for each one.
                            </p>
                        </div>
                    </div>
                    <div className="sc-header-actions">
                        <button
                            className="sc-btn sc-btn-fix-all"
                            onClick={handleFixAll}
                            aria-label="Fix all words using their top suggestion"
                        >
                            ✅ Fix All
                        </button>
                        <button
                            className="sc-btn sc-btn-keep-all"
                            onClick={handleKeepAll}
                            aria-label="Keep all words unchanged"
                        >
                            ❌ Keep All
                        </button>
                    </div>
                </div>

                {/* ── Table ── */}
                <div className="sc-table-wrap" role="region" aria-label="Spelling issues">
                    <table className="sc-table">
                        <thead>
                            <tr>
                                <th scope="col">Misspelled Word</th>
                                <th scope="col">Context</th>
                                <th scope="col">Found</th>
                                <th scope="col">Replace With</th>
                                <th scope="col">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issues.map((issue) => {
                                const isKept = keepSet.has(issue.word);
                                const rowClass = isKept ? 'sc-row-keep' : 'sc-row-fix';
                                const selectId = `sc-select-${issue.word}`;

                                return (
                                    <tr key={issue.word} className={rowClass}>
                                        <td>
                                            <span className="sc-bad-word" aria-label={`Misspelled: ${issue.word}`}>
                                                {issue.word}
                                            </span>
                                        </td>

                                        <td>
                                            <span
                                                className="sc-context"
                                                title={issue.context || undefined}
                                                aria-label={issue.context ? `Context: ${issue.context}` : 'No context available'}
                                            >
                                                {issue.context || '—'}
                                            </span>
                                        </td>

                                        <td className="sc-center">
                                            <span
                                                className="sc-badge"
                                                aria-label={`${issue.occurrences} occurrence${issue.occurrences !== 1 ? 's' : ''}`}
                                            >
                                                {issue.occurrences}×
                                            </span>
                                        </td>

                                        <td>
                                            {isKept ? (
                                                <span className="sc-kept-label">kept as-is</span>
                                            ) : (
                                                <label htmlFor={selectId} className="sc-select-label">
                                                    <select
                                                        id={selectId}
                                                        className="sc-select"
                                                        value={decisions[issue.word] ?? ''}
                                                        onChange={e => handleSuggestionChange(issue.word, e.target.value)}
                                                        aria-label={`Replacement for ${issue.word}`}
                                                    >
                                                        {issue.suggestions.map(s => (
                                                            <option key={s} value={s}>{s}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}
                                        </td>

                                        <td className="sc-center">
                                            <button
                                                className={`sc-toggle ${isKept ? 'sc-toggle-keep' : 'sc-toggle-active'}`}
                                                onClick={() => toggleKeep(issue.word)}
                                                aria-pressed={!isKept}
                                                aria-label={isKept
                                                    ? `Undo keep for ${issue.word} — click to fix`
                                                    : `Mark ${issue.word} to keep as-is`}
                                            >
                                                {isKept ? '❌ Keep' : '✅ Fix'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Footer ── */}
                <div className="sc-footer">
                    <div className="sc-summary" aria-live="polite" aria-atomic="true">
                        <span className="sc-fix-count">✅ {fixCount} will be fixed</span>
                        <span className="sc-keep-count">❌ {keepSet.size} will be kept</span>
                    </div>
                    <div className="sc-footer-actions">
                        <button
                            ref={closeRef}
                            className="sc-btn sc-btn-skip"
                            onClick={onClose}
                            aria-label="Skip spell check and continue without corrections"
                        >
                            Skip Spell Check
                        </button>
                        <button
                            ref={doneRef}
                            className="sc-btn sc-btn-done"
                            onClick={handleDone}
                            aria-label={`Apply ${fixCount} correction${fixCount !== 1 ? 's' : ''} and close`}
                        >
                            Done — Apply Decisions
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
