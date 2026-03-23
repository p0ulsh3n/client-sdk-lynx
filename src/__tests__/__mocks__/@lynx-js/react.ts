// Comprehensive stub for @lynx-js/react in vitest (Node env).
// The real package requires globalThis.lynx (Lynx runtime) which doesn't
// exist in Node. All exports are minimal no-ops so imports don't crash.

const noop = () => {};
const identity = (x: unknown) => x;
const passthrough = (fn: unknown) => fn;

export const useState = (init: unknown) => [
  typeof init === 'function' ? (init as () => unknown)() : init,
  noop,
];
export const useEffect = noop;
export const useLayoutEffect = noop;
export const useInsertionEffect = noop;
export const useCallback = passthrough;
export const useMemo = (fn: () => unknown) => fn();
export const useRef = (init: unknown) => ({ current: init });
export const useContext = (ctx: { _currentValue: unknown }) => ctx._currentValue;
export const useReducer = (reducer: unknown, init: unknown) => [init, noop];
export const useImperativeHandle = noop;
export const useDebugValue = noop;
export const useDeferredValue = identity;
export const useTransition = () => [false, passthrough];
export const useId = () => ':r0:';
export const useSyncExternalStore = (_sub: unknown, getSnapshot: () => unknown) => getSnapshot();

export const createContext = (defaultValue: unknown) => ({
  Provider: () => null,
  Consumer: () => null,
  _currentValue: defaultValue,
});

// forwardRef: returns the render function as-is (no actual ref forwarding needed)
export const forwardRef = (render: unknown) => render;

export const memo = identity;
export const lazy = (factory: () => Promise<{ default: unknown }>) => factory;

export const createRef = () => ({ current: null });
export const createPortal = () => null;
export const cloneElement = identity;
export const isValidElement = () => false;
export const Children = {
  map: (children: unknown, fn: (child: unknown, i: number) => unknown) =>
    Array.isArray(children) ? children.map(fn) : [],
  forEach: noop,
  count: () => 0,
  toArray: (children: unknown) => (Array.isArray(children) ? children : []),
  only: identity,
};

export const Fragment = Symbol('Fragment');

export const startTransition = (fn: () => void) => fn();
export const flushSync = (fn: () => void) => fn();

export const version = '0.0.0-stub';

export default {
  useState, useEffect, useLayoutEffect, useInsertionEffect,
  useCallback, useMemo, useRef, useContext, useReducer,
  useImperativeHandle, useDebugValue, useDeferredValue,
  useTransition, useId, useSyncExternalStore,
  createContext, forwardRef, memo, lazy,
  createRef, createPortal, cloneElement, isValidElement,
  Children, Fragment, startTransition, flushSync, version,
};
