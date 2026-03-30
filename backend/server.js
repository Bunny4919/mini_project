require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { parseDocument } = require('./services/documentParser');
const { parseRules } = require('./services/rulesParser');
const { applyFormatting } = require('./services/formattingEngine');
const { exportDocument, exportReport } = require('./services/exportService');
const { detectSections, generateFormattedDocument } = require('./services/sectionDetector');
const { validateFile, validateSessionId, ValidationError } = require('./services/validationService');
const { checkSpelling, applyCorrections } = require('./services/nlpService');
const { initDatabase } = require('./config/db');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security headers via Helmet
app.use(helmet());

// CORS configuration
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigin === '*' || origin === allowedOrigin) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ============================================
// RATE LIMITING
// ============================================

// General API rate limit: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Too many requests, please try again in 15 minutes.' }
});

// Strict rate limit for auth routes: 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too Many Requests', message: 'Too many login/register attempts, please try again in 15 minutes.' }
});

app.use('/api/', generalLimiter);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const requestId = uuidv4().slice(0, 8);
  req.requestId = requestId;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${requestId}] ${req.method} ${req.path}`);
  next();
});

// Auth routes — apply strict rate limit
app.use('/api/auth', authLimiter, authRoutes);

// ============================================
// DIRECTORY SETUP
// ============================================

const uploadsDir = path.join(__dirname, 'uploads');
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });

// ============================================
// MULTER CONFIGURATION
// ============================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new ValidationError('Only PDF, DOCX, and TXT files are allowed'));
    }
  }
});

// ============================================
// SESSION MANAGEMENT WITH AUTO-CLEANUP
// ============================================

const sessions = new Map();
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean every 5 minutes

// Session cleanup function
function cleanupExpiredSessions() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, session] of sessions.entries()) {
    const sessionAge = now - new Date(session.createdAt).getTime();
    if (sessionAge > SESSION_TIMEOUT) {
      // Clean up uploaded files
      if (session.rulesFile && fs.existsSync(session.rulesFile.path)) {
        try { fs.unlinkSync(session.rulesFile.path); } catch (e) { /* ignore */ }
      }
      if (session.documentFile && fs.existsSync(session.documentFile.path)) {
        try { fs.unlinkSync(session.documentFile.path); } catch (e) { /* ignore */ }
      }
      sessions.delete(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[Session Cleanup] Removed ${cleanedCount} expired sessions. Active: ${sessions.size}`);
  }
}

// Run cleanup periodically
setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);

// Session helper functions
function getSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    throw new ValidationError('Invalid or expired session. Please upload rules first.');
  }
  const session = sessions.get(sessionId);
  session.lastAccessed = new Date();
  return session;
}

function createSession(data) {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    ...data,
    createdAt: new Date(),
    lastAccessed: new Date()
  });
  return sessionId;
}

// ============================================
// PROCESSING HISTORY
// ============================================

const processingHistory = new Map(); // Track processing history per session
const MAX_HISTORY_PER_SESSION = 10;

function addToHistory(sessionId, entry) {
  if (!processingHistory.has(sessionId)) {
    processingHistory.set(sessionId, []);
  }
  const history = processingHistory.get(sessionId);
  history.unshift({
    ...entry,
    timestamp: new Date().toISOString()
  });
  if (history.length > MAX_HISTORY_PER_SESSION) {
    history.pop();
  }
}

// ============================================
// SERVER-SENT EVENTS FOR REAL-TIME UPDATES
// ============================================

const sseClients = new Map();

function sendSSE(sessionId, event, data) {
  const client = sseClients.get(sessionId);
  if (client) {
    client.write(`event: ${event}\n`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// SSE endpoint for real-time progress
app.get('/api/events/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.set(sessionId, res);

  // Send initial connection message
  res.write(`event: connected\ndata: {"message": "Connected to event stream"}\n\n`);

  req.on('close', () => {
    sseClients.delete(sessionId);
  });
});

// ============================================
// API ROUTES
// ============================================

// Upload rules file
app.post('/api/upload/rules', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    // Validate file
    validateFile(req.file);

    const parsedRules = await parseRules(req.file.path);

    // Support both old and new rule formats
    const rules = parsedRules.rules || parsedRules;
    const structuredRules = parsedRules.structuredRules || {};
    const hasStructuredRules = parsedRules.hasStructuredRules || false;

    const sessionId = createSession({
      rulesFile: req.file,
      rules,
      structuredRules,
      hasStructuredRules
    });

    console.log(`[${req.requestId}] Session ${sessionId.slice(0, 8)} created with ${Array.isArray(rules) ? rules.length : 0} rules`);

    res.json({
      success: true,
      sessionId,
      rulesCount: Array.isArray(rules) ? rules.length : 0,
      structuredRulesCount: Object.keys(structuredRules).length,
      hasStructuredRules,
      fileName: req.file.originalname
    });
  } catch (error) {
    next(error);
  }
});

// Upload target document
app.post('/api/upload/document', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { sessionId } = req.body;
    const session = getSession(sessionId);

    // Validate file
    validateFile(req.file);

    const documentContent = await parseDocument(req.file.path);

    session.documentFile = req.file;
    session.originalContent = documentContent;
    sessions.set(sessionId, session);

    // Send SSE update
    sendSSE(sessionId, 'document_uploaded', {
      fileName: req.file.originalname,
      contentLength: documentContent.text.length
    });

    res.json({
      success: true,
      fileName: req.file.originalname,
      contentLength: documentContent.text.length,
      lineCount: documentContent.text.split('\n').length
    });
  } catch (error) {
    next(error);
  }
});

// Process document with rules
app.post('/api/process', async (req, res, next) => {
  try {
    const { sessionId, options = {} } = req.body;
    const session = getSession(sessionId);

    if (!session.originalContent) {
      throw new ValidationError('No document uploaded');
    }

    // Send start event
    sendSSE(sessionId, 'processing_started', { message: 'Starting document processing...' });

    let result;
    const startTime = Date.now();

    // Use section-based formatting for structured rules
    if (session.hasStructuredRules) {
      sendSSE(sessionId, 'progress', { step: 'Detecting sections...', progress: 30 });

      const sections = detectSections(session.originalContent, session.structuredRules);

      sendSSE(sessionId, 'progress', { step: 'Generating formatted document...', progress: 60 });

      const formattedText = generateFormattedDocument(sections);

      result = {
        content: {
          text: formattedText,
          sections: sections,
          metadata: session.originalContent.metadata
        },
        changes: sections.map((section, idx) => ({
          ruleId: idx + 1,
          type: 'formatting',
          description: `Applied ${section.type} formatting`,
          preview: section.content.substring(0, 50) + (section.content.length > 50 ? '...' : ''),
          before: section.content,
          after: `[${section.type}] ${section.content}`,
          formatting: section.formatting
        })),
        sections
      };
    } else {
      sendSSE(sessionId, 'progress', { step: 'Applying formatting rules...', progress: 50 });

      // Use traditional rule-based formatting
      result = applyFormatting(session.originalContent, session.rules);
    }

    const processingTime = Date.now() - startTime;

    // Update session
    session.processedContent = result.content;
    session.changes = result.changes;
    session.sections = result.sections || [];
    session.processedAt = new Date();
    session.processingTime = processingTime;
    sessions.set(sessionId, session);

    // Add to history
    addToHistory(sessionId, {
      rulesFile: session.rulesFile.originalname,
      documentFile: session.documentFile.originalname,
      changesCount: result.changes.length,
      processingTime
    });

    // Send completion event
    sendSSE(sessionId, 'processing_complete', {
      changesCount: result.changes.length,
      processingTime
    });

    res.json({
      success: true,
      changesCount: result.changes.length,
      changes: result.changes,
      hasStructuredFormatting: session.hasStructuredRules,
      processingTime,
      statistics: {
        sectionsDetected: result.sections?.length || 0,
        rulesApplied: session.rules.length,
        originalLength: session.originalContent.text.length,
        processedLength: result.content.text.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get comparison report
app.get('/api/report/:sessionId', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = getSession(sessionId);

    if (!session.processedContent) {
      throw new ValidationError('Document not processed yet');
    }

    res.json({
      original: session.originalContent.text,
      processed: session.processedContent.text,
      changes: session.changes,
      rulesApplied: session.rules.length,
      sections: session.sections,
      metadata: {
        rulesFile: session.rulesFile.originalname,
        documentFile: session.documentFile.originalname,
        processedAt: session.processedAt,
        processingTime: session.processingTime
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get processing history
app.get('/api/history/:sessionId', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const history = processingHistory.get(sessionId) || [];
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

// Get session info
app.get('/api/session/:sessionId', (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = getSession(sessionId);

    res.json({
      hasRules: !!session.rules,
      hasDocument: !!session.originalContent,
      hasProcessed: !!session.processedContent,
      rulesCount: Array.isArray(session.rules) ? session.rules.length : 0,
      hasStructuredRules: session.hasStructuredRules,
      rulesFileName: session.rulesFile?.originalname,
      documentFileName: session.documentFile?.originalname,
      createdAt: session.createdAt,
      processedAt: session.processedAt
    });
  } catch (error) {
    next(error);
  }
});

// Delete session
app.delete('/api/session/:sessionId', (req, res, next) => {
  try {
    const { sessionId } = req.params;

    if (sessions.has(sessionId)) {
      const session = sessions.get(sessionId);

      // Clean up files
      if (session.rulesFile && fs.existsSync(session.rulesFile.path)) {
        fs.unlinkSync(session.rulesFile.path);
      }
      if (session.documentFile && fs.existsSync(session.documentFile.path)) {
        fs.unlinkSync(session.documentFile.path);
      }

      sessions.delete(sessionId);
      processingHistory.delete(sessionId);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Export document
app.get('/api/export/:sessionId/:format', async (req, res, next) => {
  try {
    const { sessionId, format } = req.params;
    const session = getSession(sessionId);

    if (!session.processedContent) {
      throw new ValidationError('Document not processed yet');
    }

    const exportPath = await exportDocument(session.processedContent, format, exportsDir);
    res.download(exportPath, (err) => {
      if (err) {
        console.error(`[${req.requestId}] Download error:`, err);
      }
      // Clean up export file after download
      setTimeout(() => {
        try { fs.unlinkSync(exportPath); } catch (e) { /* ignore */ }
      }, 60000); // Delete after 1 minute
    });
  } catch (error) {
    next(error);
  }
});

// Export comparison report
app.get('/api/export-report/:sessionId/:format', async (req, res, next) => {
  try {
    const { sessionId, format } = req.params;
    const session = getSession(sessionId);

    if (!session.processedContent) {
      throw new ValidationError('Document not processed yet');
    }

    const reportPath = await exportReport(
      session.originalContent,
      session.processedContent,
      session.changes,
      format,
      exportsDir
    );

    res.download(reportPath, (err) => {
      if (err) {
        console.error(`[${req.requestId}] Download error:`, err);
      }
      // Clean up export file after download
      setTimeout(() => {
        try { fs.unlinkSync(reportPath); } catch (e) { /* ignore */ }
      }, 60000);
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// NLP SPELL CHECK ENDPOINTS
// ============================================

/**
 * POST /api/spellcheck
 * Scans the session's uploaded document for misspelled words.
 * Returns a de-duplicated list of issues with suggestions and context.
 */
app.post('/api/spellcheck', async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSession(sessionId);

    if (!session.originalContent) {
      throw new ValidationError('No document uploaded for this session');
    }

    const { text } = session.originalContent;
    console.log(`[${req.requestId}] Spell-check: scanning ${text.length.toLocaleString()} chars`);

    const issues = checkSpelling(text);

    console.log(`[${req.requestId}] Spell-check: found ${issues.length} unique issue(s)`);

    res.json({ success: true, issueCount: issues.length, issues });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/apply-corrections
 * Applies the user's spell-check decisions to the session document text.
 * Body: { sessionId: string, corrections: Record<string, string | null> }
 * A null value means "keep the word as-is".
 */
app.post('/api/apply-corrections', async (req, res, next) => {
  try {
    const { sessionId, corrections } = req.body;

    // Validate corrections: must be a plain object (not an array, null, etc.)
    if (
      corrections === null ||
      corrections === undefined ||
      typeof corrections !== 'object' ||
      Array.isArray(corrections)
    ) {
      throw new ValidationError('corrections must be a plain object mapping words to replacements');
    }

    const session = getSession(sessionId);
    if (!session.originalContent) {
      throw new ValidationError('No document uploaded for this session');
    }

    // applyCorrections validates its own inputs and throws TypeError on bad data;
    // those will be caught and forwarded to the global error handler.
    const correctedText = applyCorrections(session.originalContent.text, corrections);

    const fixedCount = Object.values(corrections).filter(
      (v) => v !== null && v !== undefined
    ).length;

    // Persist corrected text back into the session.
    session.originalContent = { ...session.originalContent, text: correctedText };
    sessions.set(sessionId, session);

    console.log(`[${req.requestId}] Apply-corrections: fixed ${fixedCount} word type(s)`);

    res.json({
      success: true,
      fixedWords: fixedCount,
      message: `Applied ${fixedCount} spelling correction${fixedCount !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    next(error);
  }
});


// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: sessions.size,
    uptime: process.uptime()
  });
});

// API stats
app.get('/api/stats', (req, res) => {
  res.json({
    activeSessions: sessions.size,
    totalHistoryEntries: Array.from(processingHistory.values()).reduce((sum, h) => sum + h.length, 0),
    sseConnections: sseClients.size,
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// ============================================
// ERROR HANDLING MIDDLEWARE
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    requestId: req.requestId
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';

  // Always log full error server-side
  console.error(`[${req.requestId}] Error:`, err.message);
  if (!isProd) console.error(err.stack);

  // Handle CORS errors
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: isProd ? 'Origin not allowed' : err.message,
      requestId: req.requestId
    });
  }

  // Handle validation errors
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      requestId: req.requestId
    });
  }

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File Too Large',
      message: 'File size exceeds the 10MB limit',
      requestId: req.requestId
    });
  }

  // Handle other errors — hide details in production
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: isProd ? 'An unexpected error occurred' : (err.message || 'An unexpected error occurred'),
    requestId: req.requestId
  });
});

// ============================================
// SERVER STARTUP
// ============================================

// ============================================
// SERVER STARTUP
// ============================================

let server; // declared here so SIGTERM handler can access it

function startServer() {
  server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Document Formatter Pro - Backend Server               ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                 ║
║  Environment: ${process.env.NODE_ENV || 'development'}                            ║
║  Session timeout: ${SESSION_TIMEOUT / 1000 / 60} minutes                            ║
║  Auth: PostgreSQL + JWT                                   ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

// Start server after DB is ready
initDatabase()
  .then(() => startServer())
  .catch(err => {
    console.error('[DB] Fatal: could not initialise database:', err.message);
    // Start anyway so the app partially works
    startServer();
  });

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

module.exports = app;
