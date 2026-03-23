// Minimal stub for @lynx-js/react — used only in vitest (Node environment).
// The real package requires the Lynx runtime (globalThis.lynx) which doesn't
// exist in Node. All hooks/components are no-ops here; we test them separately.

export const useState = (init: unknown) => [typeof init === 'function' ? (init as () => unknown)() : init, () => {}];
export const useEffect = () => {};
export const useCallback = (fn: unknown) => fn;
export const useRef = (init: unknown) => ({ current: init });
export const useMemo = (fn: () => unknown) => fn();
export const createContext = (defaultValue: unknown) => ({ Provider: () => null, Consumer: () => null, _currentValue: defaultValue });
export const useContext = (ctx: { _currentValue: unknown }) => ctx._currentValue;

export default {
  useState, useEffect, useCallback, useRef, useMemo, createContext, useContext,
};
