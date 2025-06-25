import { useState, useEffect, useCallback, useMemo } from "react";
import { Get } from "./cache";
import type { GetRxController } from "./controller";
import type { ObsEmitter, GetRxControllerFactory } from "./types";

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
  if (Get.exists(tag)) {
    // Fallback to useGetFind if the controller already exists in the cache
    return useGetFind<T>(tag)!;
  }

  const { persist = false } = options;

  const factoryCallback = useCallback(factory, [factory]);

  if (!persist) {
    useEffect(() => {
      return () => {
        Get.delete<T>(tag);
      };
    }, [tag, factoryCallback, persist]);
  }

  return useMemo(
    () => Get.put<T>(tag, factoryCallback),
    [tag, factoryCallback, persist]
  );
}
