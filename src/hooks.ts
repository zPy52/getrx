import { Get } from "./cache";
import type { ObsEmitter } from "./types";
import type { GetRxController } from "./controller";
import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * React hook that subscribes to an ObsEmitter and returns its latest value.
 *
 * @param obs   The ObsEmitter instance to subscribe to.
 * @returns     The latest value emitted by the ObsEmitter, or its initial value.
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
 * Retrieves an existing cached controller instance or creates & caches a new
 * one if it doesn't exist.  The instance is kept alive for as long as there is
 * at least one mounted component using it.  Once the last component unmounts
 * the instance is automatically removed from the cache.
 *
 * @param ControllerClass  The controller class (must extend GetRxController).
 * @param options          Optional parameters:
 *   - tag:     Extra suffix to differentiate multiple instances (`ClassName-tag`).
 *   - args:    Constructor arguments forwarded to `new ControllerClass(...args)`.
 * @returns               The cached or newly created controller instance.
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

