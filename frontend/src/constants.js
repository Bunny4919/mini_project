/**
 * Frontend Constants
 * 
 * Centralized configuration for frontend application
 * Ensures consistency across components
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: '/api',
  DEFAULT_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 1,
  RETRY_DELAY: 1000
};

// File Upload Configuration
export const FILE_CONFIG = {
  MAX_SIZE_MB: 10,
  ALLOWED_EXTENSIONS: ['.pdf', '.docx', '.txt'],
  ALLOWED_TYPES: 'application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain'
};

// UI Configuration
export const UI_CONFIG = {
  TOAST_DURATION_MS: 3500,
  MODAL_ANIMATION_MS: 300,
  PROGRESS_UPDATE_INTERVAL_MS: 100,
  DEBOUNCE_DELAY_MS: 300
};

// Settings
export const SETTINGS = {
  THEMES: ['light', 'dark', 'system'],
  DEFAULT_THEME: 'dark',
  DEFAULT_EXPORT_FORMAT: 'docx',
  EXPORT_FORMATS: ['pdf', 'docx', 'txt'],
  STORAGE_KEY: 'documentFormatterSettings'
};

// Status Types
export const STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  COMPLETE: 'complete',
  ERROR: 'error'
};

// Toast Types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Component Messages
export const MESSAGES = {
  ERROR_NO_SESSION: 'Please upload a rules file first',
  ERROR_NO_DOCUMENT: 'Please upload both rules and document files',
  ERROR_NOT_PROCESSED: 'Document not processed yet',
  SUCCESS_UPLOAD_RULES: 'Rules file uploaded successfully',
  SUCCESS_UPLOAD_DOCUMENT: 'Document uploaded successfully',
  SUCCESS_PROCESS: 'Document processed successfully',
  ERROR_NETWORK: 'Network error. Please check your connection.',
  ERROR_TIMEOUT: 'Request timed out. Please try again.',
  SPELL_CHECK_COMPLETE: 'Spell check complete',
  NO_SPELL_ISSUES: '✅ No spelling issues detected',
  SPELL_CHECK_UNAVAILABLE: '⚠️ Spell check unavailable'
};

// SSE Event Types
export const SSE_EVENTS = {
  PROGRESS: 'progress',
  STARTED: 'processing_started',
  COMPLETE: 'processing_complete',
  ERROR: 'error',
  CONNECTED: 'connected'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  SETTINGS: 'documentFormatterSettings',
  SESSION_ID: 'documentFormatterSessionId',
  RECENT_FILES: 'documentFormatterRecentFiles'
};
