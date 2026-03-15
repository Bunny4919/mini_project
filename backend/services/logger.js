/**
 * Logger Service
 * 
 * Centralized logging for consistent formatting, filtering, and output
 * Supports different log levels (error, warn, info, debug, trace)
 */

const LOG_LEVELS = {
  TRACE: 0,
  DEBUG: 1,
  INFO: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
};

const LOG_LEVEL_NAMES = {
  0: 'TRACE',
  1: 'DEBUG',
  2: 'INFO',
  3: 'WARN',
  4: 'ERROR',
  5: 'SILENT'
};

const COLORS = {
  TRACE: '\x1b[90m',   // Gray
  DEBUG: '\x1b[36m',   // Cyan
  INFO: '\x1b[32m',    // Green
  WARN: '\x1b[33m',    // Yellow
  ERROR: '\x1b[31m',   // Red
  RESET: '\x1b[0m'
};

class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level?.toUpperCase()] ?? LOG_LEVELS.INFO;
    this.useColors = options.useColors ?? true;
    this.useTimestamps = options.useTimestamps ?? true;
    this.context = options.context ?? '';
    this.onLog = options.onLog ?? null; // Custom log handler
  }

  /**
   * Format timestamp
   * @private
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message with context and level
   * @private
   */
  formatMessage(levelName, message, args) {
    const timestamp = this.useTimestamps ? `[${this.getTimestamp()}]` : '';
    const contextStr = this.context ? `[${this.context}]` : '';
    const color = this.useColors ? COLORS[levelName] : '';
    const reset = this.useColors ? COLORS.RESET : '';

    const prefix = `${timestamp} ${color}${levelName}${reset} ${contextStr}`.trim();
    return `${prefix} ${message}`;
  }

  /**
   * Core logging method
   * @private
   */
  log(levelName, levelValue, message, ...args) {
    if (levelValue < this.level) {
      return;
    }

    const formatted = this.formatMessage(levelName, message, args);

    // Call custom handler if provided
    if (this.onLog) {
      this.onLog(levelName, formatted, args);
    }

    // Console output
    const consoleMethod = levelName === 'ERROR' ? 'error'
                       : levelName === 'WARN' ? 'warn'
                       : levelName === 'INFO' ? 'info'
                       : 'debug';

    console[consoleMethod](formatted, ...args);
  }

  /**
   * Trace level logging
   */
  trace(message, ...args) {
    this.log('TRACE', LOG_LEVELS.TRACE, message, ...args);
  }

  /**
   * Debug level logging
   */
  debug(message, ...args) {
    this.log('DEBUG', LOG_LEVELS.DEBUG, message, ...args);
  }

  /**
   * Info level logging
   */
  info(message, ...args) {
    this.log('INFO', LOG_LEVELS.INFO, message, ...args);
  }

  /**
   * Warn level logging
   */
  warn(message, ...args) {
    this.log('WARN', LOG_LEVELS.WARN, message, ...args);
  }

  /**
   * Error level logging
   */
  error(message, ...args) {
    this.log('ERROR', LOG_LEVELS.ERROR, message, ...args);
  }

  /**
   * Create a child logger with additional context
   * @param {string} childContext - Additional context for child logger
   * @returns {Logger}
   */
  createChild(childContext) {
    const newContext = this.context 
      ? `${this.context}:${childContext}` 
      : childContext;

    return new Logger({
      level: LOG_LEVEL_NAMES[this.level],
      useColors: this.useColors,
      useTimestamps: this.useTimestamps,
      context: newContext,
      onLog: this.onLog
    });
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this.level = LOG_LEVELS[level?.toUpperCase()] ?? LOG_LEVELS.INFO;
  }
}

/**
 * Create a logger instance with optional configuration
 * @param {Object} options - Logger options
 * @returns {Logger}
 */
function createLogger(options = {}) {
  return new Logger(options);
}

/**
 * Create a middleware for Express logging
 * @param {Logger} logger - Logger instance
 * @returns {Function}
 */
function createExpressMiddleware(logger) {
  return (req, res, next) => {
    const start = Date.now();
    const requestId = req.requestId || req.id || '';
    const requestLogger = logger.createChild(`${req.method}:${req.path}`);

    // Log request
    requestLogger.debug(`Request ${requestId}`);

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 400 ? 'warn' : 'info';
      requestLogger[level](
        `Response ${res.statusCode} ${requestId} (${duration}ms)`
      );
    });

    next();
  };
}

// Default logger instance
const defaultLogger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  useColors: process.env.NODE_ENV !== 'production',
  useTimestamps: true
});

module.exports = {
  createLogger,
  createExpressMiddleware,
  defaultLogger,
  LOG_LEVELS
};
