import { Get } from "./cache";
import type { ObsEmitter } from "./types";
import type { GetRxController } from "./controller";
import { getControllerKey, type GetRxControllerClass } from "./controller-key";
import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * React helper used by {@link Obs.use}. Subscribes the calling component to the
 * given {@link ObsEmitter} so that it re-renders every time the emitter
 * broadcasts a new value.
 *
 * @typeParam T – Value carried by the observable.
 * @param   obs – Observable to listen to.
 * @returns The *current* value held by the observable (or `undefined` when no
 *          value has been emitted yet).
 */
export function useOnObsChange<T>(obs: ObsEmitter<T>): T | undefined {
  const [value, setValue] = useState<T | undefined>(obs.value);

  const handler = useCallback((value: T) => {
    setValue(value);
  }, []);

  useEffect(() => {
    obs.on(handler);
    return () => {
      obs.off(handler);
    };
  }, [obs]);

  return value;
}

// A module-level map that keeps track of how many mounted components are currently
// using a given controller (identified by its shared controller key). When the
// counter reaches zero the controller can be safely removed from the cache.
const refCounts = new Map<string, number>();

// Map used to hold pending deletion timers for each controller key so that we
// can cancel them if a component re-mounts shortly after unmounting (e.g.
// during a React suspense fallback or a quick navigation).
const deletionTimers = new Map<string, NodeJS.Timeout>();

/** Amount of time (in ms) we keep an *unreferenced* controller alive before
 *  evicting it from the cache.  A small positive delay dramatically reduces
 *  race conditions caused by async side-effects that outlive the component
 *  that originally triggered them (e.g. network requests, image generation
 *  jobs, etc.).
 *
 *  You can tweak this constant to trade memory for safety.  The default of
 *  `2000` ms has proven to be more than enough for typical UI interactions
 *  without noticeably increasing memory usage.
 */
const GC_GRACE_PERIOD_MS = 5000;

/**
 * Primary bridge between React components and the controller cache.
 *
 * The hook guarantees that **exactly one** instance of `ControllerClass` exists
 * for the provided `{tag}` across the whole React tree.  It also tracks how
 * many mounted components are currently using the instance and automatically
 * schedules removal from the cache when the last consumer unmounts.  A small
 * grace period is applied to avoid race conditions with asynchronous
 * side-effects that may still hold references to the controller.
 *
 * @example
 * ```tsx
 * const todos = useGet(TodoController, { tag: "listA", args: [initialTodos] });
 * ```
 */
export function useGet<T extends GetRxController, Args extends any[] = any[]>(
  ControllerClass: GetRxControllerClass<T, Args>,
  options: { tag?: string; args?: Args } = {},
): T {
  const { tag: tagSuffix, args = [] as unknown as Args } = options;
  const controllerKey = getControllerKey(ControllerClass, tagSuffix);

  // Either fetch an existing controller or create a new one.
  const controller = useMemo(() => {
    return Get.put<T>(ControllerClass, { tag: tagSuffix, args });
  }, [ControllerClass, tagSuffix]);

  // Reference counting with delayed eviction to avoid race conditions.
  useEffect(() => {
    // Cancel any pending eviction for this controller key – we're alive again!
    const pending = deletionTimers.get(controllerKey);
    if (pending) {
      clearTimeout(pending);
      deletionTimers.delete(controllerKey);
    }

    refCounts.set(
      controllerKey,
      (refCounts.get(controllerKey) ?? 0) + 1,
    );

    return () => {
      const current = (refCounts.get(controllerKey) ?? 1) - 1;
      if (current <= 0) {
        refCounts.delete(controllerKey);

        // Defer actual deletion by GC_GRACE_PERIOD_MS.
        const timer = setTimeout(() => {
          if (!refCounts.has(controllerKey)) {
            Get.delete<T>(ControllerClass, { tag: tagSuffix });
          }
          deletionTimers.delete(controllerKey);
        }, GC_GRACE_PERIOD_MS);

        deletionTimers.set(controllerKey, timer);
      } else {
        refCounts.set(controllerKey, current);
      }
    };
  }, [controllerKey, ControllerClass, tagSuffix]);

  return controller;
}
