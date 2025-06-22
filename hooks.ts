import { useState, useEffect, useCallback, useMemo } from "react";
import type { ObsEmitter } from "./types";
import { GetRxCache } from "./cache";
import type { GetRxControllerFactory } from "./types";
import type { GetRxController } from "./controller";

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
  return useMemo(() => GetRxCache.find<T>(tag), [tag]);
}

/**
 * Retrieves an existing cached controller instance or creates & caches a new one if it doesn't exist.
 *
 * If `persist` is false (the default), the cached controller will be automatically deleted
 * when the component using this hook unmounts. If `persist` is true, the controller will remain
 * in the cache after unmount.
 *
 * @param tag       The tag to differentiate multiple instances.
 * @param factory   The controller factory function.
 * @param options   Optional options object. If `persist` is true, the controller is not deleted on unmount.
 * @returns         The cached or newly created controller instance.
 */
export function useGetPut<T extends GetRxController>(
  tag: string,
  factory: GetRxControllerFactory<T>,
  { persist = false }: { persist?: boolean }
): T {
  const factoryCallback = useCallback(factory, [factory]);

  if (!persist) {
    useEffect(() => {
      return () => {
        GetRxCache.delete<T>(tag);
      };
    }, [tag, factoryCallback, persist]);
  }

  return useMemo(
    () => GetRxCache.put<T>(tag, factoryCallback),
    [tag, factoryCallback, persist]
  );
}
