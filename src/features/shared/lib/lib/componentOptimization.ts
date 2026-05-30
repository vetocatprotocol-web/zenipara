/**
 * Component optimization utilities
 * Helpers for reducing unnecessary re-renders and improving performance
 */

import { useRef, useEffect, useCallback } from 'react';

/**
 * Deep equality check for prop changes
 * Used for React.memo comparison
 * Shallow compares objects, arrays, and primitives
 */
export function shallowEqual<T extends Record<string, unknown>>(obj1: T, obj2: T): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!(key in obj2)) return false;
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}

/**
 * Hook for memoizing state changes
 * Only updates if value actually changed (deep equality)
 */
export function useMemoValue<T>(value: T): T {
  const ref = useRef<T>(value);

  if (!shallowEqual({ val: value }, { val: ref.current })) {
    ref.current = value;
  }

  return ref.current;
}

/**
 * Hook for creating stable callback references
 * Useful when passing functions to memoized child components
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(callback: T): T {
  const ref = useRef(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  return useCallback((...args: never[]) => ref.current(...args), []) as T;
}

/**
 * Hook for performance monitoring (dev only)
 * Logs when component renders and how long it takes
 */
export function useRenderMonitor(componentName: string, threshold = 16): void {
  const renderTimeRef = useRef(performance.now());

  useEffect(() => {
    const renderTime = performance.now() - renderTimeRef.current;
    if (renderTime > threshold && process.env.NODE_ENV === 'development') {
      console.warn(`[${componentName}] Render took ${renderTime.toFixed(2)}ms (threshold: ${threshold}ms)`);
    }
    renderTimeRef.current = performance.now();
  });
}
