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
  /*  Helpers used by new hooks API                                        */
  /* --------------------------------------------------------------------- */

  /**
   * Generates the final cache key for a controller class plus optional tag.
   */
  private static buildTag(
    ControllerClass: new (...args: any[]) => GetRxController,
    suffix?: string
  ): string {
    const base = ControllerClass.name || "AnonymousController";
    return suffix ? `${base}-${suffix}` : base;
  }

  /**
   * Finds a cached controller instance identified by a controller class and
   * optional tag suffix.
   */
  public static find<T extends GetRxController>(
    ControllerClass: new (...args: any[]) => T,
    options: { tag?: string } = {}
  ): T | undefined {
    const key = this.makeKey(this.buildTag(ControllerClass, options.tag));
    return this.registry.get(key) as T | undefined;
  }

  /**
   * Retrieves a cached controller instance or creates & caches a new one. The
   * controller is instantiated automatically; no factory function is needed.
   */
  public static put<T extends GetRxController, Args extends any[] = any[]>(
    ControllerClass: new (...args: Args) => T,
    options: { tag?: string; args?: Args } = {}
  ): T {
    const { tag, args = [] as unknown as Args } = options;
    const key = this.makeKey(this.buildTag(ControllerClass, tag));

    const existing = this.registry.get(key) as T | undefined;
    if (existing) {
      return existing;
    }

    const instance = new ControllerClass(...(args as unknown as Args));
    this.registry.set(key, instance);
    this.callMaybeAsync(instance.onInit);
    return instance;
  }

  /**
   * Removes a cached controller instance, calling `onClose` beforehand.
   */
  public static delete<T extends GetRxController>(
    ControllerClass: new (...args: any[]) => T,
    options: { tag?: string } = {}
  ): void {
    const key = this.makeKey(this.buildTag(ControllerClass, options.tag));
    const cached = this.registry.get(key) as T | undefined;
    if (cached) {
      this.callMaybeAsync(cached.onClose);
      this.registry.delete(key);
    }
  }

  /**
   * Checks if a cached instance exists for the given controller class & tag.
   */
  public static exists<T extends GetRxController>(
    ControllerClass: new (...args: any[]) => T,
    options: { tag?: string } = {}
  ): boolean {
    const key = this.makeKey(this.buildTag(ControllerClass, options.tag));
    return this.registry.has(key);
  }
}
