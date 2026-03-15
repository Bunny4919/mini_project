/**
 * Application Constants
 * 
 * Centralized configuration and magic numbers/strings
 * Reduces hardcoding and improves maintainability
 */

// API Configuration
const API = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*'
};

// Session Configuration
const SESSION = {
  TIMEOUT: (process.env.SESSION_TIMEOUT_MINUTES || 30) * 60 * 1000,
  CLEANUP_INTERVAL: (process.env.SESSION_CLEANUP_INTERVAL_MINUTES || 5) * 60 * 1000,
  MAX_HISTORY: parseInt(process.env.MAX_HISTORY_PER_SESSION || '10', 10)
};

// File Upload Configuration
const FILES = {
  MAX_SIZE: (process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
  ALLOWED_TYPES: (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,txt').split(','),
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.txt'],
  MAX_CONTENT_LENGTH: parseInt(process.env.MAX_CONTENT_LENGTH || '500000', 10)
};

// NLP Configuration
const NLP = {
  ENABLED: process.env.ENABLE_SPELL_CHECK !== 'false',
  MAX_ISSUES: parseInt(process.env.MAX_SPELLING_ISSUES || '300', 10),
  MAX_SUGGESTIONS: parseInt(process.env.MAX_SPELL_SUGGESTIONS || '5', 10),
  MIN_WORD_LENGTH: parseInt(process.env.MIN_WORD_LENGTH || '3', 10),
  CONTEXT_PADDING: 45
};

// Feature Flags
const FEATURES = {
  STRUCTURED_FORMATTING: process.env.ENABLE_STRUCTURED_FORMATTING !== 'false',
  EXPORT: process.env.ENABLE_EXPORT !== 'false'
};

// Export Formats
const EXPORT_FORMATS = {
  PDF: 'pdf',
  DOCX: 'docx',
  TXT: 'txt',
  JSON: 'json',
  ALLOWED: ['pdf', 'docx', 'txt', 'json']
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Error Types
const ERROR_TYPES = {
  VALIDATION_ERROR: 'ValidationError',
  FILE_ERROR: 'FileError',
  PARSE_ERROR: 'ParseError',
  PROCESSING_ERROR: 'ProcessingError',
  NLP_ERROR: 'NLPError'
};

// SSE Events
const SSE_EVENTS = {
  CONNECTED: 'connected',
  PROGRESS: 'progress',
  STARTED: 'processing_started',
  COMPLETE: 'processing_complete',
  ERROR: 'error',
  DOCUMENT_UPLOADED: 'document_uploaded'
};

// Route Paths
const ROUTES = {
  HEALTH: '/api/health',
  STATS: '/api/stats',
  UPLOAD_RULES: '/api/upload/rules',
  UPLOAD_DOCUMENT: '/api/upload/document',
  PROCESS: '/api/process',
  REPORT: '/api/report/:sessionId',
  HISTORY: '/api/history/:sessionId',
  SESSION: '/api/session/:sessionId',
  EVENTS: '/api/events/:sessionId',
  EXPORT: '/api/export/:sessionId/:format',
  EXPORT_REPORT: '/api/export-report/:sessionId/:format',
  SPELLCHECK: '/api/spellcheck',
  APPLY_CORRECTIONS: '/api/apply-corrections'
};

module.exports = {
  API,
  SESSION,
  FILES,
  NLP,
  FEATURES,
  EXPORT_FORMATS,
  HTTP_STATUS,
  ERROR_TYPES,
  SSE_EVENTS,
  ROUTES
};
