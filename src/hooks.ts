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

/**
 * Retrieves a cached controller instance without creating a new one.
 *
 * @param tag   The tag to differentiate multiple instances.
 */
export function useGetFind<T extends GetRxController>(
  tag: string
): T | undefined {
  return useMemo(() => Get.find<T>(tag), [tag]);
}

/**
 * Retrieves an existing cached controller instance or creates & caches a new one if it doesn't exist.
 *
 * If `persist` is false (the default), the cached controller will be automatically deleted
 * when the component using this hook unmounts. If `persist` is true, the controller will remain
 * in the cache after unmount.
 *
 * If a controller instance already exists in the cache for the given tag, this hook will fallback to
 * using `useGetFind` to retrieve it instead of creating a new one.
 *
 * @param tag       The tag to differentiate multiple instances.
 * @param factory   The controller factory function.
 * @param options   Optional options object. If `persist` is true, the controller is not deleted on unmount.
 * @returns         The cached or newly created controller instance.
 */
export function useGetPut<T extends GetRxController>(
  tag: string,
  factory: GetRxControllerFactory<T>,
  options: { persist?: boolean } = {}
): T {
  // Memoise the factory so that its identity stays stable across renders
  const factoryCallback = useCallback(factory, []);

  // Create or retrieve the controller in a single place to guarantee that the
  // same hooks (useCallback ➔ useMemo ➔ useEffect) are always executed in the
  // same order, regardless of whether the controller already exists.
  const controller = useMemo(() => {
    if (Get.exists(tag)) {
      return Get.find<T>(tag) as T;
    }

    return Get.put<T>(tag, factoryCallback);
  }, [tag, factoryCallback]);

  const { persist = false } = options;

  // Remove the controller from the cache when the component unmounts unless
  // the caller explicitly wants it to persist.
  useEffect(() => {
    if (persist) return;

    return () => {
      Get.delete<T>(tag);
    };
  }, [tag, persist]);

  return controller;
}
