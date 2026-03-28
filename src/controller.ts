/**
 * Base class for controllers cached through the GetRx hooks.
 *
 * The class is intentionally minimal - you are free to add state, observables,
 * methods, constructors, and any other domain logic you need.
 *
 * A **controller** groups together state and business logic that can be shared
 * by many unrelated components. Instances are *automatically* memoised by the
 * {@link Get} cache and should therefore be treated as *singletons* - do not
 * assume that `new MyController()` will always run when using the React hook.
 */
export abstract class GetRxController {}
