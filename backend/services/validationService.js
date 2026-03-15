/**
 * Validation Service - Centralized validation for files and inputs
 */

const path = require('path');
const fs = require('fs');

// Custom validation error class
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.status = 400;
    }
}

// File magic bytes for type detection
const FILE_SIGNATURES = {
    pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
    docx: [0x50, 0x4B, 0x03, 0x04], // PK.. (ZIP format)
};

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];
const MAX_CONTENT_LENGTH = 500000; // 500KB of text

/**
 * Validate an uploaded file
 * @param {Object} file - Multer file object
 * @throws {ValidationError} If validation fails
 */
function validateFile(file) {
    if (!file) {
        throw new ValidationError('No file provided');
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        throw new ValidationError(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new ValidationError(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`);
    }

    // Check magic bytes for PDF and DOCX
    if (ext === '.pdf' || ext === '.docx') {
        if (fs.existsSync(file.path)) {
            const buffer = Buffer.alloc(4);
            const fd = fs.openSync(file.path, 'r');
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);

            const expectedSignature = ext === '.pdf' ? FILE_SIGNATURES.pdf : FILE_SIGNATURES.docx;
            const matches = expectedSignature.every((byte, i) => buffer[i] === byte);

            if (!matches) {
                throw new ValidationError(`File content does not match ${ext.toUpperCase()} format`);
            }
        }
    }

    return true;
}

/**
 * Validate session ID format
 * @param {string} sessionId - Session ID to validate
 * @throws {ValidationError} If validation fails
 */
function validateSessionId(sessionId) {
    if (!sessionId) {
        throw new ValidationError('Session ID is required');
    }

    // UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
        throw new ValidationError('Invalid session ID format');
    }

    return true;
}

/**
 * Validate rule content
 * @param {string} ruleText - Rule text to validate
 * @throws {ValidationError} If validation fails
 */
function validateRuleContent(ruleText) {
    if (!ruleText || typeof ruleText !== 'string') {
        throw new ValidationError('Rule content must be a non-empty string');
    }

    if (ruleText.length > MAX_CONTENT_LENGTH) {
        throw new ValidationError(`Rule content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = [
        /require\s*\(/i,
        /eval\s*\(/i,
        /Function\s*\(/i,
        /__proto__/i,
        /constructor\s*\[/i
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(ruleText)) {
            throw new ValidationError('Rule content contains potentially unsafe patterns');
        }
    }

    return true;
}

/**
 * Validate document content
 * @param {string} documentText - Document text to validate
 * @throws {ValidationError} If validation fails
 */
function validateDocumentContent(documentText) {
    if (!documentText || typeof documentText !== 'string') {
        throw new ValidationError('Document content must be a non-empty string');
    }

    if (documentText.length > MAX_CONTENT_LENGTH * 10) { // 5MB of text allowed for documents
        throw new ValidationError('Document content exceeds maximum length');
    }

    return true;
}

/**
 * Validate export format
 * @param {string} format - Export format to validate
 * @throws {ValidationError} If validation fails
 */
function validateExportFormat(format) {
    const allowedFormats = ['pdf', 'docx', 'txt'];

    if (!format || typeof format !== 'string') {
        throw new ValidationError('Export format is required');
    }

    if (!allowedFormats.includes(format.toLowerCase())) {
        throw new ValidationError(`Invalid export format. Allowed formats: ${allowedFormats.join(', ')}`);
    }

    return true;
}

/**
 * Sanitize text input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }

    // Remove null bytes
    return input.replace(/\0/g, '')
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Trim excessive whitespace
        .trim();
}

/**
 * Validate and sanitize a rule object
 * @param {Object} rule - Rule object to validate
 * @returns {Object} Validated and sanitized rule
 */
function validateRule(rule) {
    if (!rule || typeof rule !== 'object') {
        throw new ValidationError('Invalid rule format');
    }

    const validTypes = ['replace', 'regex', 'capitalize', 'remove', 'normalize', 'trim', 'format', 'style', 'insert', 'wrap'];

    if (!validTypes.includes(rule.type)) {
        throw new ValidationError(`Invalid rule type: ${rule.type}`);
    }

    // Type-specific validation
    switch (rule.type) {
        case 'replace':
            if (!rule.find) {
                throw new ValidationError('Replace rule requires a "find" value');
            }
            if (rule.replace === undefined) {
                throw new ValidationError('Replace rule requires a "replace" value');
            }
            break;

        case 'regex':
            if (!rule.pattern) {
                throw new ValidationError('Regex rule requires a "pattern" value');
            }
            try {
                new RegExp(rule.pattern, rule.flags || 'g');
            } catch (e) {
                throw new ValidationError(`Invalid regex pattern: ${e.message}`);
            }
            break;

        case 'capitalize':
        case 'remove':
        case 'normalize':
        case 'trim':
            if (!rule.target) {
                throw new ValidationError(`${rule.type} rule requires a "target" value`);
            }
            break;
    }

    return rule;
}

module.exports = {
    ValidationError,
    validateFile,
    validateSessionId,
    validateRuleContent,
    validateDocumentContent,
    validateExportFormat,
    validateRule,
    sanitizeInput,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    MAX_CONTENT_LENGTH
};
