/**
 * Formatting Engine - Apply formatting rules to document content
 * Enhanced with undo/redo, batch processing, preview mode, and new operations
 */

/**
 * Apply formatting rules to document content
 * @param {Object} content - Parsed document content
 * @param {Array} rules - Array of formatting rules
 * @param {Object} options - Processing options
 * @returns {Object} Processed content with changes tracked
 */
function applyFormatting(content, rules, options = {}) {
    const {
        previewOnly = false,
        stopOnError = false,
        maxChanges = Infinity
    } = options;

    const changes = [];
    const history = []; // For undo capability
    let processedText = content.text;
    let processedSections = JSON.parse(JSON.stringify(content.sections));

    // Store original for undo
    history.push({
        text: content.text,
        sections: JSON.parse(JSON.stringify(content.sections)),
        changeIndex: 0
    });

    for (const rule of rules) {
        if (changes.length >= maxChanges) break;

        try {
            const result = applyRule(processedText, processedSections, rule, previewOnly);

            if (!previewOnly) {
                processedText = result.text;
                processedSections = result.sections;
            }

            changes.push(...result.changes);

            // Store state for undo
            if (!previewOnly && result.changes.length > 0) {
                history.push({
                    text: processedText,
                    sections: JSON.parse(JSON.stringify(processedSections)),
                    changeIndex: changes.length
                });
            }
        } catch (error) {
            changes.push({
                ruleId: rule.id,
                type: 'error',
                description: `Error applying rule: ${error.message}`,
                error: true
            });

            if (stopOnError) break;
        }
    }

    return {
        content: {
            text: processedText,
            sections: processedSections,
            metadata: content.metadata
        },
        changes,
        history,
        statistics: {
            totalRules: rules.length,
            appliedChanges: changes.filter(c => !c.error).length,
            errors: changes.filter(c => c.error).length
        }
    };
}

/**
 * Apply a single rule to the content
 */
function applyRule(text, sections, rule, previewOnly = false) {
    const changes = [];
    let newText = text;

    switch (rule.type) {
        case 'replace':
            const replaceResult = applyReplace(newText, rule.find, rule.replace, rule.id);
            newText = replaceResult.text;
            changes.push(...replaceResult.changes);
            break;

        case 'regex':
            const regexResult = applyRegex(newText, rule.pattern, rule.flags, rule.replace, rule.id);
            newText = regexResult.text;
            changes.push(...regexResult.changes);
            break;

        case 'capitalize':
            const capResult = applyCapitalize(newText, rule.target, rule.id);
            newText = capResult.text;
            changes.push(...capResult.changes);
            break;

        case 'remove':
            const removeResult = applyRemove(newText, rule.target, rule.id);
            newText = removeResult.text;
            changes.push(...removeResult.changes);
            break;

        case 'normalize':
            const normalizeResult = applyNormalize(newText, rule.target, rule.id);
            newText = normalizeResult.text;
            changes.push(...normalizeResult.changes);
            break;

        case 'trim':
            const trimResult = applyTrim(newText, rule.target, rule.id);
            newText = trimResult.text;
            changes.push(...trimResult.changes);
            break;

        // NEW: Insert rule
        case 'insert':
            const insertResult = applyInsert(newText, rule.content, rule.target, rule.position, rule.id);
            newText = insertResult.text;
            changes.push(...insertResult.changes);
            break;

        // NEW: Wrap rule
        case 'wrap':
            const wrapResult = applyWrap(newText, rule.target, rule.prefix, rule.suffix, rule.id);
            newText = wrapResult.text;
            changes.push(...wrapResult.changes);
            break;

        // NEW: Unwrap rule
        case 'unwrap':
            const unwrapResult = applyUnwrap(newText, rule.wrapper, rule.target, rule.id);
            newText = unwrapResult.text;
            changes.push(...unwrapResult.changes);
            break;

        // NEW: Indent rule
        case 'indent':
            const indentResult = applyIndent(newText, rule.target, rule.spaces, rule.id);
            newText = indentResult.text;
            changes.push(...indentResult.changes);
            break;

        // NEW: Line wrap rule
        case 'lineWrap':
            const lineWrapResult = applyLineWrap(newText, rule.width, rule.id);
            newText = lineWrapResult.text;
            changes.push(...lineWrapResult.changes);
            break;

        // NEW: Case conversion
        case 'caseConvert':
            const caseResult = applyCaseConvert(newText, rule.case, rule.id);
            newText = caseResult.text;
            changes.push(...caseResult.changes);
            break;

        // NEW: Conditional rule
        case 'conditional':
            const conditionalResult = applyConditional(newText, rule.condition, rule.action, rule.id);
            newText = conditionalResult.text;
            changes.push(...conditionalResult.changes);
            break;

        case 'format':
        case 'style':
            // Style rules are tracked but applied during export
            changes.push({
                ruleId: rule.id,
                type: rule.type,
                description: `Style rule: ${rule.property || rule.target} = ${rule.value || rule.style}`,
                before: '',
                after: '',
                appliedDuringExport: true
            });
            break;
    }

    // Update sections with new text
    const newSections = sections.map(section => ({
        ...section,
        content: section.content
    }));

    return { text: newText, sections: newSections, changes };
}

/**
 * Apply replace rule
 */
function applyReplace(text, find, replace, ruleId) {
    const changes = [];
    const regex = new RegExp(escapeRegex(find), 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
        changes.push({
            ruleId,
            type: 'replace',
            position: match.index,
            before: match[0],
            after: replace,
            description: `Replaced "${match[0]}" with "${replace}"`
        });
    }

    const newText = text.replace(regex, replace);
    return { text: newText, changes };
}

/**
 * Apply regex rule
 */
function applyRegex(text, pattern, flags, replace, ruleId) {
    const changes = [];

    try {
        const regex = new RegExp(pattern, flags);
        let match;
        const tempRegex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');

        while ((match = tempRegex.exec(text)) !== null) {
            const replacement = match[0].replace(new RegExp(pattern, flags.replace('g', '')), replace);
            changes.push({
                ruleId,
                type: 'regex',
                position: match.index,
                before: match[0],
                after: replacement,
                description: `Regex replaced "${match[0]}" with "${replacement}"`
            });

            if (!flags.includes('g')) break;
        }

        const newText = text.replace(regex, replace);
        return { text: newText, changes };
    } catch (e) {
        console.error('Invalid regex pattern:', pattern, e);
        return { text, changes: [] };
    }
}

/**
 * Apply capitalize rule
 */
function applyCapitalize(text, target, ruleId) {
    const changes = [];
    let newText = text;

    switch (target.toLowerCase()) {
        case 'headings':
        case 'titles':
            const lines = text.split('\n');
            newText = lines.map((line, idx) => {
                const trimmed = line.trim();
                if (trimmed.length > 0 && trimmed.length < 100 && !trimmed.endsWith('.')) {
                    const capitalized = capitalizeWords(trimmed);
                    if (capitalized !== trimmed) {
                        changes.push({
                            ruleId,
                            type: 'capitalize',
                            line: idx + 1,
                            before: trimmed,
                            after: capitalized,
                            description: `Capitalized heading: "${trimmed}" -> "${capitalized}"`
                        });
                        return line.replace(trimmed, capitalized);
                    }
                }
                return line;
            }).join('\n');
            break;

        case 'sentences':
            newText = text.replace(/(^|[.!?]\s+)([a-z])/g, (match, prefix, letter) => {
                changes.push({
                    ruleId,
                    type: 'capitalize',
                    before: match,
                    after: prefix + letter.toUpperCase(),
                    description: `Capitalized sentence start`
                });
                return prefix + letter.toUpperCase();
            });
            break;

        case 'all':
            newText = text.toUpperCase();
            if (newText !== text) {
                changes.push({
                    ruleId,
                    type: 'capitalize',
                    before: text.substring(0, 50) + '...',
                    after: newText.substring(0, 50) + '...',
                    description: 'Converted all text to uppercase'
                });
            }
            break;

        default:
            const wordRegex = new RegExp(`\\b${escapeRegex(target)}\\b`, 'gi');
            newText = text.replace(wordRegex, (match) => {
                const capitalized = capitalizeWords(match);
                if (capitalized !== match) {
                    changes.push({
                        ruleId,
                        type: 'capitalize',
                        before: match,
                        after: capitalized,
                        description: `Capitalized "${match}" to "${capitalized}"`
                    });
                }
                return capitalized;
            });
    }

    return { text: newText, changes };
}

/**
 * Apply remove rule
 */
function applyRemove(text, target, ruleId) {
    const changes = [];
    let newText = text;

    if (target.toLowerCase() === 'extra spaces') {
        const before = text;
        newText = text.replace(/  +/g, ' ');
        if (before !== newText) {
            changes.push({
                ruleId,
                type: 'remove',
                before: 'Multiple spaces',
                after: 'Single space',
                description: 'Removed extra spaces'
            });
        }
    } else if (target.toLowerCase() === 'blank lines') {
        const before = text;
        newText = text.replace(/\n\s*\n\s*\n/g, '\n\n');
        if (before !== newText) {
            changes.push({
                ruleId,
                type: 'remove',
                before: 'Multiple blank lines',
                after: 'Single blank line',
                description: 'Removed extra blank lines'
            });
        }
    } else {
        const regex = new RegExp(escapeRegex(target), 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
            changes.push({
                ruleId,
                type: 'remove',
                position: match.index,
                before: match[0],
                after: '',
                description: `Removed "${match[0]}"`
            });
        }
        newText = text.replace(regex, '');
    }

    return { text: newText, changes };
}

/**
 * Apply normalize rule
 */
function applyNormalize(text, target, ruleId) {
    const changes = [];
    let newText = text;

    switch (target.toLowerCase()) {
        case 'spaces':
            const beforeSpaces = text;
            newText = text.replace(/[ \t]+/g, ' ').replace(/^ +| +$/gm, '');
            if (beforeSpaces !== newText) {
                changes.push({
                    ruleId,
                    type: 'normalize',
                    before: 'Irregular spacing',
                    after: 'Normalized spacing',
                    description: 'Normalized spaces'
                });
            }
            break;

        case 'quotes':
            const beforeQuotes = text;
            newText = text
                .replace(/[""]/g, '"')
                .replace(/['']/g, "'");
            if (beforeQuotes !== newText) {
                changes.push({
                    ruleId,
                    type: 'normalize',
                    before: 'Smart quotes',
                    after: 'Standard quotes',
                    description: 'Normalized quotes to standard ASCII'
                });
            }
            break;

        case 'dashes':
            const beforeDashes = text;
            newText = text
                .replace(/—/g, '--')
                .replace(/–/g, '-');
            if (beforeDashes !== newText) {
                changes.push({
                    ruleId,
                    type: 'normalize',
                    before: 'Special dashes',
                    after: 'Standard dashes',
                    description: 'Normalized dashes to standard ASCII'
                });
            }
            break;
    }

    return { text: newText, changes };
}

/**
 * Apply trim rule
 */
function applyTrim(text, target, ruleId) {
    const changes = [];
    let newText = text;

    if (target.toLowerCase() === 'lines') {
        const lines = text.split('\n');
        const trimmedLines = lines.map(line => line.trim());
        newText = trimmedLines.join('\n');

        if (text !== newText) {
            changes.push({
                ruleId,
                type: 'trim',
                before: 'Lines with extra whitespace',
                after: 'Trimmed lines',
                description: 'Trimmed whitespace from line beginnings and endings'
            });
        }
    }

    return { text: newText, changes };
}

/**
 * NEW: Apply insert rule
 */
function applyInsert(text, content, target, position, ruleId) {
    const changes = [];
    const regex = new RegExp(escapeRegex(target), 'gi');
    let newText = text;
    let offset = 0;

    let match;
    const matches = [];
    while ((match = regex.exec(text)) !== null) {
        matches.push({ index: match.index, text: match[0] });
    }

    matches.forEach(m => {
        const insertPos = position === 'before' ? m.index + offset : m.index + m.text.length + offset;
        newText = newText.slice(0, insertPos) + content + newText.slice(insertPos);
        offset += content.length;

        changes.push({
            ruleId,
            type: 'insert',
            position: insertPos,
            before: m.text,
            after: position === 'before' ? content + m.text : m.text + content,
            description: `Inserted "${content}" ${position} "${m.text}"`
        });
    });

    return { text: newText, changes };
}

/**
 * NEW: Apply wrap rule
 */
function applyWrap(text, target, prefix, suffix, ruleId) {
    const changes = [];
    const regex = new RegExp(escapeRegex(target), 'gi');

    const newText = text.replace(regex, (match) => {
        const wrapped = prefix + match + suffix;
        changes.push({
            ruleId,
            type: 'wrap',
            before: match,
            after: wrapped,
            description: `Wrapped "${match}" with "${prefix}...${suffix}"`
        });
        return wrapped;
    });

    return { text: newText, changes };
}

/**
 * NEW: Apply unwrap rule
 */
function applyUnwrap(text, wrapper, target, ruleId) {
    const changes = [];
    const pattern = escapeRegex(wrapper) + '(' + escapeRegex(target) + ')' + escapeRegex(wrapper);
    const regex = new RegExp(pattern, 'gi');

    const newText = text.replace(regex, (match, inner) => {
        changes.push({
            ruleId,
            type: 'unwrap',
            before: match,
            after: inner,
            description: `Unwrapped "${wrapper}" from "${inner}"`
        });
        return inner;
    });

    return { text: newText, changes };
}

/**
 * NEW: Apply indent rule
 */
function applyIndent(text, target, spaces, ruleId) {
    const changes = [];
    const lines = text.split('\n');
    const indent = ' '.repeat(spaces);
    const targetRegex = new RegExp(target, 'i');

    const newText = lines.map((line, idx) => {
        if (targetRegex.test(line)) {
            const indented = indent + line;
            changes.push({
                ruleId,
                type: 'indent',
                line: idx + 1,
                before: line,
                after: indented,
                description: `Indented line by ${spaces} spaces`
            });
            return indented;
        }
        return line;
    }).join('\n');

    return { text: newText, changes };
}

/**
 * NEW: Apply line wrap rule
 */
function applyLineWrap(text, width, ruleId) {
    const changes = [];
    const lines = text.split('\n');
    let changesMade = false;

    const newText = lines.map(line => {
        if (line.length > width) {
            changesMade = true;
            const wrapped = wrapLine(line, width);
            return wrapped;
        }
        return line;
    }).join('\n');

    if (changesMade) {
        changes.push({
            ruleId,
            type: 'lineWrap',
            before: 'Long lines',
            after: `Lines wrapped at ${width} characters`,
            description: `Wrapped lines at ${width} characters`
        });
    }

    return { text: newText, changes };
}

/**
 * Helper: Wrap a single line at specified width
 */
function wrapLine(line, width) {
    const words = line.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= width) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);

    return lines.join('\n');
}

/**
 * NEW: Apply case conversion
 */
function applyCaseConvert(text, targetCase, ruleId) {
    const changes = [];
    let newText = text;

    switch (targetCase) {
        case 'upper':
            newText = text.toUpperCase();
            break;
        case 'lower':
            newText = text.toLowerCase();
            break;
        case 'title':
            newText = capitalizeWords(text);
            break;
        case 'sentence':
            newText = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
            break;
    }

    if (newText !== text) {
        changes.push({
            ruleId,
            type: 'caseConvert',
            before: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            after: newText.substring(0, 50) + (newText.length > 50 ? '...' : ''),
            description: `Converted text to ${targetCase} case`
        });
    }

    return { text: newText, changes };
}

/**
 * NEW: Apply conditional rule
 */
function applyConditional(text, condition, action, ruleId) {
    const changes = [];

    // Check if condition is met (simple pattern matching)
    if (text.includes(condition) || new RegExp(condition, 'i').test(text)) {
        // Parse and apply the action
        // Simple implementation: if action is "replace X with Y"
        const replaceMatch = action.match(/replace\s+[\"']?(.+?)[\"']?\s+with\s+[\"']?(.+?)[\"']?$/i);
        if (replaceMatch) {
            const result = applyReplace(text, replaceMatch[1], replaceMatch[2], ruleId);
            result.changes.forEach(c => {
                c.description = `[Conditional] ${c.description}`;
            });
            return result;
        }

        changes.push({
            ruleId,
            type: 'conditional',
            before: '',
            after: '',
            description: `Condition "${condition}" met, applied action "${action}"`
        });
    }

    return { text, changes };
}

/**
 * Helper: Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Helper: Capitalize first letter of each word
 */
function capitalizeWords(str) {
    return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Undo to a specific point in history
 * @param {Object} history - Processing history
 * @param {number} index - History index to restore
 * @returns {Object} Restored content
 */
function undoTo(history, index) {
    if (index < 0 || index >= history.length) {
        throw new Error('Invalid history index');
    }
    return {
        text: history[index].text,
        sections: JSON.parse(JSON.stringify(history[index].sections))
    };
}

/**
 * Preview changes without applying them
 * @param {Object} content - Document content
 * @param {Array} rules - Rules to preview
 * @returns {Object} Preview of changes
 */
function previewChanges(content, rules) {
    return applyFormatting(content, rules, { previewOnly: true });
}

module.exports = {
    applyFormatting,
    undoTo,
    previewChanges,
    // Export individual functions for testing
    applyReplace,
    applyRegex,
    applyCapitalize,
    applyRemove,
    applyNormalize,
    applyTrim,
    applyInsert,
    applyWrap,
    applyUnwrap,
    applyIndent,
    applyLineWrap,
    applyCaseConvert,
    applyConditional
};
