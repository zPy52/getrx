/**
 * Base class to be extended by any controller that wishes to be cached through
 * the GetRx hooks.  The class is intentionally minimal – you are free to add
 * state, observables, methods, etc.  Simply extend this class and optionally
 * override `onInit` and/or `onClose`.
 */
export abstract class GetRxController {
  /**
   * Optional lifecycle method called once when the controller instance is first
   * put into the cache.
   */
  public onInit?(): void | Promise<void>;

  /**
   * Optional lifecycle method called once when the controller instance is
   * removed from the cache via `useGetDelete`.
   */
  public onClose?(): void | Promise<void>;
}
