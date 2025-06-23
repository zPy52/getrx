import type { GetRxControllerFactory } from "./types";
import type { GetRxController } from "./controller";

/**
 * Internal singleton cache for storing instances of classes extending GetRxController.
 * This cache is not exported from the module; only the React hooks interact with it,
 * ensuring it is only used within the `getrx` package.
 *
 * The cache key is a user-provided tag, allowing multiple cached instances of the same
 * class if desired.
 */
export class Get {
  /** The backing map for the cache */
  private static readonly registry = new Map<string, unknown>();

  /**
   * Prevent instantiation – this class is intended to be used statically.
   */
  private constructor() {}

  /* ----------------------------------------------------------------------- */
  /* Helpers                                                                */
  /* ----------------------------------------------------------------------- */
  /**
   * Validates and returns the cache key.
   * @param tag - A non-empty string used as the cache key.
   */
  private static makeKey(tag: string): string {
    if (!tag || typeof tag !== "string") {
      throw new Error("A non-empty string tag is required for GetRxCache.");
    }
    return tag;
  }

  /**
   * Calls the provided function, awaiting it if it returns a Promise.
   * Errors are caught and logged.
   * @param fn - Optional function to call, possibly async.
   */
  private static async callMaybeAsync(fn?: () => void | Promise<void>) {
    if (typeof fn === "function") {
      // Call the function; if it returns a promise, await and catch errors.
      const result = fn();
      if (result instanceof Promise) {
        await result.catch(console.error);
      }
    }
  }

  /* --------------------------------------------------------------------- */
  /*  Factory-based helpers – used by hooks API that takes `() => T`       */
  /* --------------------------------------------------------------------- */

  /**
   * Finds a cached controller instance by tag.
   * @param tag - The cache key.
   * @returns The cached instance, or undefined if not found.
   */
  public static find<T extends GetRxController>(tag: string): T | undefined {
    const key = this.makeKey(tag);
    return this.registry.get(key) as T | undefined;
  }

  /**
   * Retrieves a cached controller instance by tag, or creates and caches a new one using the provided factory.
   * Calls the instance's onInit method if a new instance is created.
   * @param tag - The cache key.
   * @param factory - Factory function to create a new instance if needed.
   * @returns The cached or newly created instance.
   */
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

  /**
   * Removes a cached controller instance by tag.
   * Calls the instance's onClose method before removal.
   * @param tag - The cache key.
   */
  public static delete<T extends GetRxController>(tag: string): void {
    const key = this.makeKey(tag);
    const cached = this.registry.get(key) as T | undefined;
    if (cached) {
      this.callMaybeAsync(cached.onClose);
      this.registry.delete(key);
    }
  }
}
