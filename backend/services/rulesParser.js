const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Parse a rules file and extract formatting rules
 * @param {string} filePath - Path to the rules file
 * @returns {Object} Parsed rules object containing rules array and structured rules
 */
async function parseRules(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    let text;

    switch (ext) {
        case '.pdf':
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            text = pdfData.text;
            break;
        case '.docx':
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
            break;
        case '.txt':
            text = fs.readFileSync(filePath, 'utf-8');
            break;
        default:
            throw new Error(`Unsupported file type: ${ext}`);
    }

    return extractRules(text);
}

/**
 * Extract rules from text content
 * Supports multiple rule formats:
 * - "Replace X with Y"
 * - "X -> Y"
 * - "Capitalize headings"
 * - "Remove extra spaces"
 * - Key: Value format
 * - Structured format: KEY=VALUE
 * - NEW: "Insert X before/after Y"
 * - NEW: "Wrap X with Y"
 * - NEW: "If X then Y"
 */
function extractRules(text) {
    const rules = [];
    const structuredRules = {};
    const conditionalRules = [];
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    lines.forEach((line, index) => {
        // Skip comments
        if (line.startsWith('#') || line.startsWith('//')) return;

        // Structured rules: KEY=VALUE format
        const structuredMatch = line.match(/^([A-Z_]+)=(.+)$/);
        if (structuredMatch) {
            const key = structuredMatch[1];
            let value = structuredMatch[2].trim();

            // Handle comma-separated values (for keywords)
            if (key.includes('KEYWORDS')) {
                value = value.split(',').map(v => v.trim());
            } else if (value === 'true' || value === 'false') {
                value = value;
            }

            structuredRules[key] = value;
            return;
        }

        // NEW: Conditional rule: "If X then Y" or "When X apply Y"
        let match = line.match(/^(?:if|when)\s+(.+?)\s+(?:then|apply)\s+(.+)$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'conditional',
                condition: match[1].trim(),
                action: match[2].trim(),
                line: index + 1
            });
            return;
        }

        // NEW: Insert pattern: "Insert X before/after Y"
        match = line.match(/^insert\s+[\"']?(.+?)[\"']?\s+(before|after)\s+[\"']?(.+?)[\"']?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'insert',
                content: match[1],
                position: match[2].toLowerCase(),
                target: match[3],
                line: index + 1
            });
            return;
        }

        // NEW: Wrap pattern: "Wrap X with Y" or "Wrap X with Y and Z"
        match = line.match(/^wrap\s+[\"']?(.+?)[\"']?\s+with\s+[\"']?(.+?)[\"']?(?:\s+and\s+[\"']?(.+?)[\"']?)?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'wrap',
                target: match[1],
                prefix: match[2],
                suffix: match[3] || match[2], // If no suffix, use prefix (symmetric wrap)
                line: index + 1
            });
            return;
        }

        // NEW: Unwrap pattern: "Unwrap X from Y"
        match = line.match(/^unwrap\s+[\"']?(.+?)[\"']?\s+from\s+[\"']?(.+?)[\"']?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'unwrap',
                wrapper: match[1],
                target: match[2],
                line: index + 1
            });
            return;
        }

        // NEW: Priority pattern: "[priority:N] rule"
        const priorityMatch = line.match(/^\[priority:\s*(\d+)\]\s*(.+)$/i);
        if (priorityMatch) {
            const priority = parseInt(priorityMatch[1], 10);
            const ruleText = priorityMatch[2];
            // Re-parse the rule text and add priority
            const subRules = extractRules(ruleText);
            if (subRules.rules.length > 0) {
                const rule = subRules.rules[0];
                rule.priority = priority;
                rules.push(rule);
            }
            return;
        }

        // NEW: Split pattern: "Split X by Y"
        match = line.match(/^split\s+[\"']?(.+?)[\"']?\s+by\s+[\"']?(.+?)[\"']?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'split',
                target: match[1],
                delimiter: match[2],
                line: index + 1
            });
            return;
        }

        // NEW: Merge pattern: "Merge lines matching X"
        match = line.match(/^merge\s+(?:lines\s+)?matching\s+[\"']?(.+?)[\"']?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'merge',
                pattern: match[1],
                line: index + 1
            });
            return;
        }

        // NEW: Indent pattern: "Indent X by N spaces"
        match = line.match(/^indent\s+[\"']?(.+?)[\"']?\s+by\s+(\d+)\s*(?:spaces?)?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'indent',
                target: match[1],
                spaces: parseInt(match[2], 10),
                line: index + 1
            });
            return;
        }

        // Replace pattern: "Replace X with Y" or "X -> Y"
        match = line.match(/^replace\s+[\"']?(.+?)[\"']?\s+with\s+[\"']?(.+?)[\"']?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'replace',
                find: match[1],
                replace: match[2],
                line: index + 1
            });
            return;
        }

        // Arrow pattern: "X -> Y"
        match = line.match(/^[\"']?(.+?)[\"']?\s*->\s*[\"']?(.+?)[\"']?$/);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'replace',
                find: match[1],
                replace: match[2],
                line: index + 1
            });
            return;
        }

        // Capitalize pattern
        match = line.match(/^capitalize\s+(.+)$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'capitalize',
                target: match[1].trim(),
                line: index + 1
            });
            return;
        }

        // Remove pattern: "Remove X"
        match = line.match(/^remove\s+[\"']?(.+?)[\"']?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'remove',
                target: match[1],
                line: index + 1
            });
            return;
        }

        // Format pattern: "Format X as Y"
        match = line.match(/^format\s+(.+?)\s+as\s+(.+)$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'format',
                target: match[1].trim(),
                style: match[2].trim(),
                line: index + 1
            });
            return;
        }

        // Style rules: "Style: value" or "style = value"
        match = line.match(/^(font|size|color|alignment|spacing|margin|line-height|padding)[\s:=]+(.+)$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'style',
                property: match[1].toLowerCase(),
                value: match[2].trim(),
                line: index + 1
            });
            return;
        }

        // Regex pattern: "/pattern/ -> replacement"
        match = line.match(/^\/(.+?)\/([gim]*)\s*->\s*[\"']?(.*)[\"']?$/);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'regex',
                pattern: match[1],
                flags: match[2] || 'g',
                replace: match[3],
                line: index + 1
            });
            return;
        }

        // Normalization rules
        if (/^normalize\s+spaces?$/i.test(line)) {
            rules.push({
                id: rules.length + 1,
                type: 'normalize',
                target: 'spaces',
                line: index + 1
            });
            return;
        }

        if (/^normalize\s+quotes?$/i.test(line)) {
            rules.push({
                id: rules.length + 1,
                type: 'normalize',
                target: 'quotes',
                line: index + 1
            });
            return;
        }

        if (/^normalize\s+dashes?$/i.test(line)) {
            rules.push({
                id: rules.length + 1,
                type: 'normalize',
                target: 'dashes',
                line: index + 1
            });
            return;
        }

        // Trim rules
        if (/^trim\s+lines?$/i.test(line)) {
            rules.push({
                id: rules.length + 1,
                type: 'trim',
                target: 'lines',
                line: index + 1
            });
            return;
        }

        // NEW: Line wrap pattern
        match = line.match(/^(?:line\s+)?wrap\s+at\s+(\d+)\s*(?:characters?|chars?)?$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'lineWrap',
                width: parseInt(match[1], 10),
                line: index + 1
            });
            return;
        }

        // NEW: Case conversion
        match = line.match(/^(?:convert\s+)?case\s+to\s+(upper|lower|title|sentence)$/i);
        if (match) {
            rules.push({
                id: rules.length + 1,
                type: 'caseConvert',
                case: match[1].toLowerCase(),
                line: index + 1
            });
            return;
        }
    });

    // Sort rules by priority if specified
    rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return {
        rules,
        structuredRules,
        hasStructuredRules: Object.keys(structuredRules).length > 0,
        metadata: {
            totalRules: rules.length,
            structuredRulesCount: Object.keys(structuredRules).length,
            ruleTypes: [...new Set(rules.map(r => r.type))]
        }
    };
}

/**
 * Validate a single rule
 * @param {Object} rule - Rule to validate
 * @returns {Object} Validation result
 */
function validateRule(rule) {
    const errors = [];
    const warnings = [];

    if (!rule.type) {
        errors.push('Rule type is required');
    }

    switch (rule.type) {
        case 'replace':
            if (!rule.find) errors.push('Replace rule requires "find" value');
            if (rule.replace === undefined) errors.push('Replace rule requires "replace" value');
            if (rule.find === rule.replace) warnings.push('Find and replace values are identical');
            break;

        case 'regex':
            if (!rule.pattern) {
                errors.push('Regex rule requires "pattern" value');
            } else {
                try {
                    new RegExp(rule.pattern, rule.flags || 'g');
                } catch (e) {
                    errors.push(`Invalid regex pattern: ${e.message}`);
                }
            }
            break;

        case 'insert':
            if (!rule.content) errors.push('Insert rule requires "content" value');
            if (!rule.target) errors.push('Insert rule requires "target" value');
            if (!['before', 'after'].includes(rule.position)) errors.push('Insert position must be "before" or "after"');
            break;

        case 'wrap':
            if (!rule.target) errors.push('Wrap rule requires "target" value');
            if (!rule.prefix) errors.push('Wrap rule requires wrapper value');
            break;

        case 'indent':
            if (!rule.target) errors.push('Indent rule requires "target" value');
            if (!rule.spaces || rule.spaces < 0) errors.push('Indent rule requires positive "spaces" value');
            break;
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Get a human-readable description of a rule
 * @param {Object} rule - Rule to describe
 * @returns {string} Description
 */
function describeRule(rule) {
    switch (rule.type) {
        case 'replace':
            return `Replace "${rule.find}" with "${rule.replace}"`;
        case 'regex':
            return `Regex replace /${rule.pattern}/${rule.flags || ''} with "${rule.replace}"`;
        case 'capitalize':
            return `Capitalize ${rule.target}`;
        case 'remove':
            return `Remove "${rule.target}"`;
        case 'normalize':
            return `Normalize ${rule.target}`;
        case 'trim':
            return `Trim ${rule.target}`;
        case 'insert':
            return `Insert "${rule.content}" ${rule.position} "${rule.target}"`;
        case 'wrap':
            return `Wrap "${rule.target}" with "${rule.prefix}" and "${rule.suffix}"`;
        case 'unwrap':
            return `Unwrap "${rule.wrapper}" from "${rule.target}"`;
        case 'indent':
            return `Indent "${rule.target}" by ${rule.spaces} spaces`;
        case 'conditional':
            return `If ${rule.condition} then ${rule.action}`;
        case 'lineWrap':
            return `Wrap lines at ${rule.width} characters`;
        case 'caseConvert':
            return `Convert to ${rule.case} case`;
        default:
            return `${rule.type}: ${JSON.stringify(rule)}`;
    }
}

module.exports = { parseRules, extractRules, validateRule, describeRule };
