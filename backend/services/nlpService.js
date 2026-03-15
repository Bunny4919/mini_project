'use strict';

/**
 * NLP Spell-Check Service
 *
 * Uses nspell (Hunspell-compatible) with the English dictionary.
 * Dictionary files are read synchronously at module-load time so the
 * event loop is never blocked during an HTTP request.
 *
 * Public API:
 *   checkSpelling(text, options?) → SpellIssue[]
 *   applyCorrections(text, corrections)  → string
 */

const fs = require('fs');
const path = require('path');
const nspell = require('nspell');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of unique spelling issues returned to the frontend. */
const MAX_ISSUES = 300;

/** Maximum number of suggestions per misspelled word. */
const MAX_SUGGESTIONS = 5;

/** Minimum word length to check (very short words have too many false positives). */
const MIN_WORD_LENGTH = 3;

/** Context window: characters around each occurrence used for display. */
const CONTEXT_PADDING = 45;

// ---------------------------------------------------------------------------
// Dictionary — loaded once at module initialisation, not on first request.
// This avoids blocking the event loop mid-request and ensures the module is
// ready before the server starts accepting connections.
// ---------------------------------------------------------------------------

const DICT_DIR = path.resolve(__dirname, '..', 'node_modules', 'dictionary-en');

let _spell;

try {
  const aff = fs.readFileSync(path.join(DICT_DIR, 'index.aff'));
  const dic = fs.readFileSync(path.join(DICT_DIR, 'index.dic'));
  _spell = nspell({ aff, dic });
  console.log('[NLP] English spell-checker ready');
} catch (err) {
  console.error('[NLP] Failed to load dictionary:', err.message);
  // Graceful degradation: service will return empty issues array.
  _spell = null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a string so it is safe to insert into a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Count whole-word occurrences of `word` in `text` (case-insensitive).
 * Regex is compiled once per call.
 * @param {string} text
 * @param {string} word
 * @returns {number}
 */
function countOccurrences(text, word) {
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'gi');
  let count = 0;
  // Use exec loop instead of .match() to avoid large array allocation.
  while (re.exec(text) !== null) count++;
  return count;
}

/**
 * Extract a short context snippet around the first occurrence of `word`.
 * @param {string} text
 * @param {string} word
 * @returns {string}
 */
function getContext(text, word) {
  // Case-insensitive search without lowercasing the full text.
  const re = new RegExp(escapeRegExp(word), 'i');
  const m = re.exec(text);
  if (!m) return '';

  const start = Math.max(0, m.index - CONTEXT_PADDING);
  const end = Math.min(text.length, m.index + word.length + CONTEXT_PADDING);
  let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();

  if (start > 0) snippet = '\u2026' + snippet; // …
  if (end < text.length) snippet = snippet + '\u2026';

  return snippet;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SpellIssue
 * @property {string}   word        - The misspelled word (as found in text)
 * @property {string[]} suggestions - Up to MAX_SUGGESTIONS replacement candidates
 * @property {number}   occurrences - How many times the word appears
 * @property {string}   context     - Short surrounding snippet for display
 */

/**
 * @typedef {Object} CheckOptions
 * @property {number} [maxIssues=300]      - Cap on unique issues returned
 * @property {number} [maxSuggestions=5]   - Cap on suggestions per issue
 */

/**
 * Scan `text` for potentially misspelled words.
 *
 * Skips:
 *  - Words that start with an uppercase letter (proper nouns / acronyms)
 *  - Words shorter than MIN_WORD_LENGTH characters
 *  - Pure-numeric and mixed alphanumeric tokens
 *  - Duplicates (only the first occurrence's context is reported)
 *
 * @param {string}       text
 * @param {CheckOptions} [options]
 * @returns {SpellIssue[]}
 */
function checkSpelling(text, options = {}) {
  if (!_spell) return []; // dictionary failed to load — fail gracefully
  if (typeof text !== 'string' || text.length === 0) return [];

  const maxIssues = options.maxIssues ?? MAX_ISSUES;
  const maxSuggestions = options.maxSuggestions ?? MAX_SUGGESTIONS;

  const seen = new Set();
  const issues = [];

  // Token pattern: only pure-alpha sequences of the required minimum length.
  const TOKEN_RE = /\b[a-zA-Z]{3,}\b/g;
  let m;

  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (issues.length >= maxIssues) break;

    const raw = m[0];
    const lower = raw.toLowerCase();

    // Deduplicate (check each unique lowercase form once).
    if (seen.has(lower)) continue;
    seen.add(lower);

    // Skip likely proper nouns / acronyms (starts with uppercase).
    if (raw.charCodeAt(0) >= 65 && raw.charCodeAt(0) <= 90) continue;

    // Correctly spelled — move on.
    if (_spell.correct(raw)) continue;

    const suggestions = _spell.suggest(raw).slice(0, maxSuggestions);

    // No suggestions → likely a specialised term or intentional word; skip.
    if (suggestions.length === 0) continue;

    issues.push({
      word: raw,
      suggestions,
      occurrences: countOccurrences(text, raw),
      context: getContext(text, raw),
    });
  }

  return issues;
}

/**
 * Apply the user's correction decisions to `text`.
 *
 * @param {string} text
 * @param {Record<string, string | null>} corrections
 *   Keys are misspelled words; values are replacements or `null` (keep as-is).
 * @returns {string} Corrected text
 * @throws {TypeError} If arguments are of the wrong type
 */
function applyCorrections(text, corrections) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (corrections === null || typeof corrections !== 'object' || Array.isArray(corrections)) {
    throw new TypeError('corrections must be a plain object');
  }

  let result = text;

  for (const [word, replacement] of Object.entries(corrections)) {
    // Guard: skip prototype-polluting or non-string keys/values
    if (!Object.prototype.hasOwnProperty.call(corrections, word)) continue;
    if (typeof word !== 'string' || word.length === 0) continue;
    if (replacement === null || replacement === undefined) continue; // keep as-is
    if (typeof replacement !== 'string' || replacement.length === 0) continue;

    // Precompile regex once per word.
    const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g');
    result = result.replace(re, replacement);
  }

  return result;
}

module.exports = { checkSpelling, applyCorrections };
