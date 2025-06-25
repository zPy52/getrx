import { Get } from "./cache";
import type { GetRxController } from "./controller";
import type { ObsEmitter, GetRxControllerFactory } from "./types";
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
 * the instance is automatically removed from the cache (unless `persist: true`
 * is passed in the `options` parameter).
 *
 * @param tag       The tag to differentiate multiple instances.
 * @param factory   Factory function used to create the controller when it does
 *                  not yet exist in the cache.
 * @param options   Optional options object.  If `persist` is true the
 *                  controller is NOT deleted when the last component unmounts.
 * @returns         The cached or newly created controller instance.
 */
export function useGet<T extends GetRxController>(
  tag: string,
  factory: GetRxControllerFactory<T>,
  options: { persist?: boolean } = {}
): T {
  // Memoise the factory so that its identity stays stable across renders.
  const factoryCallback = useCallback(factory, []);

  // Either fetch the existing controller or create & cache a new one.
  const controller = useMemo(() => {
    if (Get.exists(tag)) {
      return Get.find<T>(tag) as T;
    }
    return Get.put<T>(tag, factoryCallback);
  }, [tag, factoryCallback]);

  const { persist = false } = options;

  // Keep a reference count so we know when the very last component using this
  // controller unmounts.  At that point – and only then – we can safely delete
  // it from the cache (unless it was marked as persistent).
  useEffect(() => {
    // Increment on mount.
    refCounts.set(tag, (refCounts.get(tag) ?? 0) + 1);

    // Decrement on unmount and delete when it reaches zero.
    return () => {
      const current = (refCounts.get(tag) ?? 1) - 1;
      if (current <= 0) {
        refCounts.delete(tag);
        if (!persist) {
          Get.delete<T>(tag);
        }
      } else {
        refCounts.set(tag, current);
      }
    };
  }, [tag, persist]);

  return controller;
}

