// Workaround for @astryxdesign/core shipping dist files compiled with the
// dev-mode automatic JSX transform (calling jsxDEV directly). React's real
// production jsx-dev-runtime stubs jsxDEV to `undefined`, so those calls crash
// at runtime with "jsxDEV is not a function". This shim implements jsxDEV with
// plain createElement so it works identically regardless of build mode.
import { createElement, Fragment } from "react";

export { Fragment };

export function jsxDEV(type: unknown, props: Record<string, unknown>, key?: unknown) {
  const { children, ...rest } = props ?? {};
  const finalProps = key !== undefined ? { ...rest, key } : rest;
  if (children === undefined) {
    return createElement(type as never, finalProps);
  }
  return createElement(type as never, finalProps, children as never);
}
