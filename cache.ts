import type { GetRxControllerFactory } from "./types";
import type { GetRxController } from "./controller";

/**
 * GetRxCache is an internal, singleton style cache that stores instances of
 * classes extending GetRxController. The cache is **not** exported from the
 * module – only the React hooks interact with it – ensuring that it is only
 * consumed from within the `getrx` package.
 *
 * The cache key is a combination of the controller's constructor name plus an
 * optional user-provided tag, allowing multiple cached instances of the same
 * class when desired.
 */
export class GetRxCache {
  /** The actual backing map of the cache */
  private static readonly registry = new Map<string, unknown>();

  /**
   * Prevent external construction – this class is meant to be purely static.
   */
  private constructor() {}

  /* ----------------------------------------------------------------------- */
  /* Helpers                                                                  */
  /* ----------------------------------------------------------------------- */
  private static makeKey(tag: string): string {
    if (!tag || typeof tag !== "string") {
      throw new Error("A non-empty string tag is required for GetRxCache.");
    }
    return tag;
  }

  private static async callMaybeAsync(fn?: () => void | Promise<void>) {
    if (typeof fn === "function") {
      // Fire and forget; await if it returns a promise so errors surface.
      const result = fn();
      if (result instanceof Promise) {
        await result.catch(console.error);
      }
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Factory based helpers – used by hooks API that takes `() => T`       */
  /* --------------------------------------------------------------------- */

  public static find<T extends GetRxController>(tag: string): T | undefined {
    const key = this.makeKey(tag);
    return this.registry.get(key) as T | undefined;
  }

  public static put<T extends GetRxController>(
    tag: string,
    factory: GetRxControllerFactory<T>
  ): T {
    const key = this.makeKey(tag);
    const existing = this.registry.get(key) as T | undefined;
    
    if (existing) {
      return existing;
    }
    
    const instance = factory();
    this.registry.set(key, instance);
    this.callMaybeAsync(instance.onInit);
    return instance;
  }

  public static delete<T extends GetRxController>(tag: string): void {
    const key = this.makeKey(tag);
    const cached = this.registry.get(key) as T | undefined;
    if (cached) {
      this.callMaybeAsync(cached.onClose);
      this.registry.delete(key);
    }
  }
}
