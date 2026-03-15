const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Parse a document file and extract its content
 * @param {string} filePath - Path to the document file
 * @returns {Object} Parsed document content with text and sections
 */
async function parseDocument(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
        case '.pdf':
            return await parsePDF(filePath);
        case '.docx':
            return await parseDOCX(filePath);
        case '.txt':
            return await parseTXT(filePath);
        default:
            throw new Error(`Unsupported file type: ${ext}`);
    }
}

/**
 * Parse PDF file
 */
async function parsePDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    return {
        text: data.text,
        sections: splitIntoSections(data.text),
        metadata: {
            pages: data.numpages,
            info: data.info
        }
    };
}

/**
 * Parse DOCX file
 */
async function parseDOCX(filePath) {
    const result = await mammoth.extractRawText({ path: filePath });

    return {
        text: result.value,
        sections: splitIntoSections(result.value),
        metadata: {
            messages: result.messages
        }
    };
}

/**
 * Parse TXT file
 */
async function parseTXT(filePath) {
    const text = fs.readFileSync(filePath, 'utf-8');

    return {
        text: text,
        sections: splitIntoSections(text),
        metadata: {}
    };
}

/**
 * Split text into logical sections
 */
function splitIntoSections(text) {
    const lines = text.split('\n');
    const sections = [];
    let currentSection = { type: 'paragraph', content: [], startLine: 0 };

    lines.forEach((line, index) => {
        const trimmedLine = line.trim();

        // Detect headings (all caps, short lines, or lines ending with colon)
        if (trimmedLine.length > 0 && trimmedLine.length < 100) {
            if (trimmedLine === trimmedLine.toUpperCase() && /[A-Z]/.test(trimmedLine)) {
                if (currentSection.content.length > 0) {
                    sections.push({ ...currentSection, content: currentSection.content.join('\n') });
                }
                currentSection = { type: 'heading', content: [trimmedLine], startLine: index };
                sections.push({ ...currentSection, content: trimmedLine });
                currentSection = { type: 'paragraph', content: [], startLine: index + 1 };
                return;
            }
        }

        // Empty line marks section break
        if (trimmedLine === '') {
            if (currentSection.content.length > 0) {
                sections.push({ ...currentSection, content: currentSection.content.join('\n') });
                currentSection = { type: 'paragraph', content: [], startLine: index + 1 };
            }
        } else {
            currentSection.content.push(line);
        }
    });

    // Add remaining content
    if (currentSection.content.length > 0) {
        sections.push({ ...currentSection, content: currentSection.content.join('\n') });
    }

    return sections;
}

module.exports = { parseDocument };
