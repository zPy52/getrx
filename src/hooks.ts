import { Get } from "./cache";
import type { ObsEmitter } from "./types";
import type { GetRxController } from "./controller";
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
// using a given controller (identified by its tag).  When the counter reaches
// zero the controller can be safely removed from the cache.
const refCounts = new Map<string, number>();

/**
 * Primary bridge between React components and the controller cache.
 *
 * The hook guarantees that **exactly one** instance of `ControllerClass` exists
 * for the provided `{tag}` across the whole React tree.  It also tracks how
 * many mounted components are currently using the instance and automatically
 * removes it from the cache when the last consumer unmounts.
 *
 * @example
 * ```tsx
 * // Provide constructor args and a custom tag
 * const todos = useGet(TodoController, {
 *   tag: "listA",
 *   args: [initialTodos]
 * });
 * ```
 *
 * @typeParam T    – Concrete controller type.
 * @typeParam Args – Tuple of constructor arguments.
 * @param ControllerClass – Class extending {@link GetRxController}.
 * @param options.tag     – Optional tag suffix (default: class name only).
 * @param options.args    – Arguments forwarded to the constructor when a new
 *                          instance needs to be created.
 * @returns The cached or newly created controller instance.
 */
export function useGet<T extends GetRxController, Args extends any[] = any[]>(
  ControllerClass: new (...args: Args) => T,
  options: { tag?: string; args?: Args; } = {}
): T {
  const { tag: tagSuffix, args = [] as unknown as Args } = options;

  const baseTag = ControllerClass.name || "AnonymousController";
  const tag = tagSuffix ? `${baseTag}-${tagSuffix}` : baseTag;

  // Either fetch an existing controller or create a new one.
  const controller = useMemo(() => {
    return Get.put<T>(ControllerClass, { tag: tagSuffix, args });
  }, [ControllerClass, tagSuffix]);

  // Reference counting and automatic cache eviction.
  useEffect(() => {
    refCounts.set(tag, (refCounts.get(tag) ?? 0) + 1);

    return () => {
      const current = (refCounts.get(tag) ?? 1) - 1;
      if (current <= 0) {
        refCounts.delete(tag);
        Get.delete<T>(ControllerClass, { tag: tagSuffix });
      } else {
        refCounts.set(tag, current);
      }
    };
  }, [tag, ControllerClass, tagSuffix]);

  return controller;
}

