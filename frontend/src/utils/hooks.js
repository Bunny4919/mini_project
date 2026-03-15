/**
 * Custom React Hooks
 * 
 * Reusable hook patterns for common functionality across components
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiPost, ApiError } from './api';

/**
 * Hook for managing async operations with loading and error states
 * @param {Function} asyncFunction - Async function to execute
 * @param {boolean} immediate - Whether to execute immediately
 * @returns {Object} { execute, loading, error, data, reset }
 */
export function useAsync(asyncFunction, immediate = false) {
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const response = await asyncFunction(...args);
      setData(response);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setData(null);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, loading, error, data, reset };
}

/**
 * Hook for managing form input state and validation
 * @param {Object} initialValues - Initial form values
 * @param {Function} onSubmit - Submit handler
 * @returns {Object} { values, errors, touched, setFieldValue, handleChange, handleSubmit, reset }
 */
export function useForm(initialValues, onSubmit) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      // Validate field on change if it was touched
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [touched]);

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFieldValue(name, type === 'checkbox' ? checked : value);
  }, [setFieldValue]);

  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, onSubmit]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    setFieldValue,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    isSubmitting
  };
}

/**
 * Hook for managing debounced values
 * @param {any} value - Value to debounce
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {any} Debounced value
 */
export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for managing local storage
 * @param {string} key - Storage key
 * @param {any} initialValue - Initial value if key doesn't exist
 * @returns {Array} [value, setValue]
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading from localStorage:`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error writing to localStorage:`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

/**
 * Hook for managing previous value
 * @param {any} value - Current value
 * @returns {any} Previous value
 */
export function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

/**
 * Hook for handling file uploads
 * @param {Object} options - Upload options
 * @returns {Object} { file, isLoading, error, handleFileSelect, reset }
 */
export function useFileUpload(options = {}) {
  const { maxSize = 10 * 1024 * 1024, allowedTypes = [] } = options;
  const [file, setFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = useCallback(async (selectedFile) => {
    setError(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate size
    if (selectedFile.size > maxSize) {
      setError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
      return;
    }

    // Validate type
    if (allowedTypes.length > 0) {
      const ext = '.' + selectedFile.name.split('.').pop().toLowerCase();
      if (!allowedTypes.includes(ext)) {
        setError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
        return;
      }
    }

    setFile(selectedFile);
  }, [maxSize, allowedTypes]);

  const reset = useCallback(() => {
    setFile(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { file, isLoading, error, handleFileSelect, reset };
}

/**
 * Hook for managing countdown timer
 * @param {number} initialSeconds - Initial seconds
 * @returns {Object} { seconds, isActive, start, stop, reset }
 */
export function useCountdown(initialSeconds) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;

    if (isActive && seconds > 0) {
      interval = setInterval(() => {
        setSeconds(prev => prev - 1);
      }, 1000);
    } else if (seconds === 0 && isActive) {
      setIsActive(false);
    }

    return () => clearInterval(interval);
  }, [isActive, seconds]);

  const start = useCallback(() => setIsActive(true), []);
  const stop = useCallback(() => setIsActive(false), []);
  const reset = useCallback(() => {
    setSeconds(initialSeconds);
    setIsActive(false);
  }, [initialSeconds]);

  return { seconds, isActive, start, stop, reset };
}

/**
 * Hook for managing toggle state
 * @param {boolean} initialValue - Initial toggle state
 * @returns {Array} [value, toggle]
 */
export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle];
}

/**
 * Hook for managing previous props
 * @param {Object} props - Props object
 * @returns {Object} Previous props
 */
export function usePreviousProps(props) {
  const ref = useRef();

  useEffect(() => {
    ref.current = props;
  }, [props]);

  return ref.current || {};
}
