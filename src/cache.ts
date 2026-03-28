import type { GetRxController } from "./controller";
import { getControllerKey, type GetRxControllerClass } from "./controller-key";

/**
 * Simple **process-wide** registry that stores controller singletons.
 *
 * The cache is *not* exported outside of the `getrx` package – public consumers
 * interact with it exclusively through the React hooks (`useGet`) or via the
 * facade methods exposed on the default export (`Get`).  Hiding the
 * implementation detail prevents accidental misuse (e.g. leaking controllers
 * or bypassing the cache).
 *
 * A controller instance is uniquely identified by its constructor object plus
 * an optional *tag* suffix. The readable portion of the internal key may reuse
 * `displayName` or `name`, but uniqueness comes from the constructor identity
 * so production minification cannot cause collisions.
 */
export class Get {
  /** The backing map for the cache */
  private static readonly registry = new Map<string, unknown>();

  /**
   * Prevent instantiation – this class is intended to be used statically.
   */
  private constructor() {}

  /* ----------------------------------------------------------------------- */
  /* Internal helpers                                                       */
  /* ----------------------------------------------------------------------- */
  /**
   * Ensures that the generated cache key is a non-empty string.
   *
   * While the method is trivial, centralising the check avoids repeated
   * defensive code across the public API.
   */
  private static makeKey(tag: string): string {
    if (!tag || typeof tag !== "string") {
      throw new Error("A non-empty string tag is required for GetRxCache.");
    }
    return tag;
  }

  /* --------------------------------------------------------------------- */
  /*  Helpers used by the public hooks API                                 */
  /* --------------------------------------------------------------------- */

  /**
   * Pure lookup that **never** creates new instances.
   *
   * @returns `undefined` when the controller is not found.
   */
  public static find<T extends GetRxController>(
    ControllerClass: GetRxControllerClass<T>,
    options: { tag?: string } = {},
  ): T | undefined {
    const key = this.makeKey(getControllerKey(ControllerClass, options.tag));
    return this.registry.get(key) as T | undefined;
  }

  /**
   * Returns an existing cached controller **or** constructs a new one using
   * `new ControllerClass(...args)` and stores it.
   *
   * @param ControllerClass – Concrete class extending {@link GetRxController}.
   * @param options.tag      – Optional string to differentiate multiple
   *                           instances of the same class.
   * @param options.args     – Arguments to forward to the constructor.
   */
  public static put<T extends GetRxController, Args extends any[] = any[]>(
    ControllerClass: GetRxControllerClass<T, Args>,
    options: { tag?: string; args?: Args } = {},
  ): T {
    const { tag, args = [] as unknown as Args } = options;
    const key = this.makeKey(getControllerKey(ControllerClass, tag));

    const existing = this.registry.get(key) as T | undefined;
    if (existing) {
      return existing;
    }

    const instance = new ControllerClass(...(args as unknown as Args));
    this.registry.set(key, instance);
    return instance;
  }

  /**
   * Evicts the given controller from the cache.
   */
  public static delete<T extends GetRxController>(
    ControllerClass: GetRxControllerClass<T>,
    options: { tag?: string } = {},
  ): void {
    const key = this.makeKey(getControllerKey(ControllerClass, options.tag));
    this.registry.delete(key);
  }

  /**
   * Convenience helper that only tells whether an entry exists regardless of
   * its actual value.
   */
  public static exists<T extends GetRxController>(
    ControllerClass: GetRxControllerClass<T>,
    options: { tag?: string } = {},
  ): boolean {
    const key = this.makeKey(getControllerKey(ControllerClass, options.tag));
    return this.registry.has(key);
  }
}
