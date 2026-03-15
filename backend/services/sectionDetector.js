/**
 * Section Detector - Identifies document sections based on keywords and rules
 */

/**
 * Detect sections in document based on formatting rules
 * @param {Object} content - Parsed document content
 * @param {Object} structuredRules - Structured formatting rules
 * @returns {Array} Array of detected sections with formatting
 */
function detectSections(content, structuredRules) {
    const lines = content.text.split('\n').filter(line => line.trim() !== '');
    const sections = [];

    // Extract keywords from rules
    const sectionKeywords = structuredRules.SECTION_KEYWORDS || [];
    const metaKeywords = structuredRules.META_KEYWORDS || [];
    const footerKeyword = structuredRules.FOOTER_KEYWORD || '';

    let currentSection = null;

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // First line is typically the TITLE
        if (index === 0) {
            sections.push({
                type: 'TITLE',
                content: trimmedLine,
                lineNumber: index + 1,
                formatting: extractFormatting(structuredRules, 'TITLE')
            });
            return;
        }

        // Check if line matches FOOTER keyword
        if (footerKeyword && trimmedLine.includes(footerKeyword)) {
            sections.push({
                type: 'FOOTER',
                content: trimmedLine,
                lineNumber: index + 1,
                formatting: extractFormatting(structuredRules, 'FOOTER')
            });
            currentSection = 'FOOTER';
            return;
        }

        // Check if line starts with META keywords
        const isMetaLine = metaKeywords.some(keyword =>
            trimmedLine.startsWith(keyword)
        );

        if (isMetaLine) {
            sections.push({
                type: 'META',
                content: trimmedLine,
                lineNumber: index + 1,
                formatting: extractFormatting(structuredRules, 'META')
            });
            currentSection = 'META';
            return;
        }

        // Check if line matches SECTION keywords (headings)
        const isSectionHeading = sectionKeywords.some(keyword =>
            trimmedLine === keyword || trimmedLine.startsWith(keyword)
        );

        if (isSectionHeading) {
            sections.push({
                type: 'HEADING',
                content: trimmedLine,
                lineNumber: index + 1,
                formatting: extractFormatting(structuredRules, 'HEADING')
            });
            currentSection = 'HEADING';
            return;
        }

        // Otherwise, it's BODY text
        sections.push({
            type: 'BODY',
            content: trimmedLine,
            lineNumber: index + 1,
            formatting: extractFormatting(structuredRules, 'BODY')
        });
        currentSection = 'BODY';
    });

    return sections;
}

/**
 * Extract formatting rules for a specific section type
 */
function extractFormatting(rules, sectionType) {
    const formatting = {};
    const prefix = sectionType + '_';

    Object.keys(rules).forEach(key => {
        if (key.startsWith(prefix)) {
            const property = key.replace(prefix, '').toLowerCase();
            formatting[property] = rules[key];
        }
    });

    return formatting;
}

/**
 * Generate formatted document from sections
 */
function generateFormattedDocument(sections) {
    return sections.map(section => {
        const formatting = section.formatting;
        let prefix = '';
        let suffix = '';

        // Add formatting indicators (these would be applied in actual rendering)
        if (formatting.bold === 'true') {
            prefix += '**';
            suffix = '**' + suffix;
        }

        if (formatting.align) {
            prefix = `[${formatting.align.toUpperCase()}] ` + prefix;
        }

        if (formatting.font || formatting.size) {
            const fontInfo = [];
            if (formatting.font) fontInfo.push(formatting.font);
            if (formatting.size) fontInfo.push(formatting.size + 'pt');
            prefix = `[${fontInfo.join(', ')}] ` + prefix;
        }

        return prefix + section.content + suffix;
    }).join('\n\n');
}

module.exports = {
    detectSections,
    extractFormatting,
    generateFormattedDocument
};
