---
name: getrx
description: Best practices and usage guidance for the getrx state management library. Use when writing React components or state logic with getrx, when creating GetRxController classes, when working with Obs observables, when using the useGet hook, or when deciding how to structure state management in a getrx-based project. Also use when reviewing or refactoring getrx code for correctness and idiomatic patterns.
---

# GetRx Best Practices

## Golden Rule: Always Use Controllers

Every piece of shared or component-level reactive state belongs inside a `GetRxController`. Never create standalone `Obs` instances at module scope or inside components.

**Correct — state lives in a controller:**

```tsx
class SearchController extends GetRxController {
  query = new Obs("");
  results = new Obs<SearchResult[]>([]);

  async search(term: string) {
    this.query.value = term;
    this.results.value = await api.search(term);
  }
}

function SearchPage() {
  const c = useGet(SearchController);
  const query = c.query.use();
  const results = c.results.use();
  // ...
}
```

**Wrong — loose Obs with no controller:**

```ts
// DON'T do this
const query = new Obs("");
const results = new Obs<SearchResult[]>([]);

function SearchPage() {
  const q = query.use();  // no controller cache, no shared cleanup, leaks memory
  // ...
}
```

Standalone `Obs` objects bypass the `Get` cache entirely, so they are never managed by `useGet`, are never garbage-collected, and cannot be shared safely across components via `useGet`.

## Creating Controllers

### Extend GetRxController

```ts
import { Obs, GetRxController } from "getrx";

class TodoController extends GetRxController {
  todos = new Obs<Todo[]>([]);
  loading = new Obs(false);

  addTodo(text: string) {
    const current = this.todos.value ?? [];
    this.todos.value = [...current, { id: Date.now(), text, done: false }];
  }

  toggle(id: number) {
    const current = this.todos.value ?? [];
    this.todos.value = current.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    );
  }
}
```

### Explicit Setup

If a controller needs one-time setup or async loading, expose an explicit method and call it from the component that uses the controller.

```ts
class UserController extends GetRxController {
  user = new Obs<User | null>(null);
  loading = new Obs(true);

  async load() {
    try {
      this.user.value = await fetchUser();
    } finally {
      this.loading.value = false;
    }
  }
}

function UserPage() {
  const controller = useGet(UserController);

  useEffect(() => {
    void controller.load();
  }, [controller]);
}
```

### Keep Controllers Focused

One controller per domain concern. Prefer several small controllers over one large one.

```ts
// Good — separate concerns
class AuthController extends GetRxController { /* auth state */ }
class CartController extends GetRxController { /* shopping cart */ }
class ProductController extends GetRxController { /* product catalog */ }

// Avoid — god controller
class AppController extends GetRxController {
  /* auth + cart + products + UI state all mixed together */
}
```

### Constructor Arguments

Pass initial data via `args` when the controller needs external configuration:

```ts
class ChatController extends GetRxController {
  messages = new Obs<Message[]>([]);
  roomId: string;

  constructor(roomId: string) {
    super();
    this.roomId = roomId;
  }
}

// In a component:
const chat = useGet(ChatController, { tag: roomId, args: [roomId] });
```

## Using useGet

`useGet` is the primary way to access controllers from React components.

### Basic Usage

```tsx
function Counter() {
  const c = useGet(CounterController);
  const count = c.count.use();
  return <button onClick={() => c.increment()}>Count: {count}</button>;
}
```

### What useGet Does

1. **Creates or retrieves** a singleton controller instance (by controller constructor identity + optional tag).
2. **Reference-counts** mounted consumers — the controller stays alive as long as at least one component uses it.
3. **Auto-cleans** the controller by removing it from the cache after the last consumer unmounts, with a 5-second grace period to survive quick re-mounts.

Controller identity is constructor-based rather than `class.name`-based, so different controllers do not collide after production minification even if their runtime names match.

### Tags for Multiple Instances

Use `tag` when the same controller class must exist in multiple independent copies:

```tsx
// Two independent todo lists
const inbox = useGet(TodoController, { tag: "inbox" });
const work  = useGet(TodoController, { tag: "work" });
```

Without a tag, every call to `useGet(TodoController)` returns the **same** instance across the entire React tree.

### When to Use useGet vs. Direct Instantiation

| Scenario | Approach |
|---|---|
| Shared state across components | `useGet(Controller)` |
| Component-scoped state | `useGet(Controller, { tag: uniqueId })` |
| Multiple instances of the same concern | `useGet(Controller, { tag })` |
| State that outlives a single component | `useGet(Controller)` — the cache keeps it alive |
| Ephemeral local UI state (a toggle, an input) | Plain `useState` is fine — no controller needed |

**Rule of thumb:** if the state is reactive or shared, use a controller with `useGet`. If it is trivially local to one component (e.g., a boolean toggle), `useState` is acceptable.

## Working with Obs

### Reading Values

```ts
// Outside React (in controller methods, callbacks, etc.)
const current = this.count.value;   // property access
const current = this.count.get();   // method access (equivalent)
```

### Writing Values

```ts
this.count.value = 42;   // property setter
this.count.set(42);      // method call (equivalent)
```

Both notify all subscribers synchronously.

### Subscribing in React — the .use() Hook

Inside a component, call `.use()` on any `Obs` to subscribe to its changes:

```tsx
function StatusBar() {
  const c = useGet(AppController);
  const status = c.status.use();   // re-renders when status changes
  return <span>{status}</span>;
}
```

Only call `.use()` for observables whose changes should trigger a re-render of **that** component. Reading `.value` instead avoids unnecessary re-renders when the value is only needed once (e.g., inside an event handler).

```tsx
function SaveButton() {
  const c = useGet(FormController);
  // Don't .use() here — we only need the value at click time
  const handleSave = () => api.save(c.formData.value);
  return <button onClick={handleSave}>Save</button>;
}
```

### Imperative Subscriptions

For non-React code (e.g., inter-controller communication), use `on`/`off`:

```ts
class DashboardController extends GetRxController {
  stats = new Obs<Stats>();

  bindAuth() {
    const auth = Get.find(AuthController);
    auth?.token.on((token) => {
      if (token) this.loadStats(token);
    });
  }
}
```

## Common Patterns

### Loading + Error States

```ts
class DataController extends GetRxController {
  data = new Obs<Item[]>([]);
  loading = new Obs(true);
  error = new Obs<string | null>(null);

  async load() {
    try {
      this.data.value = await fetchItems();
    } catch (e) {
      this.error.value = (e as Error).message;
    } finally {
      this.loading.value = false;
    }
  }
}
```

### Cross-Controller Communication

Use `Get.find()` to look up another controller imperatively. Keep the lookup local at the point of use so intertwined flows stay easy to read:

```ts
class OrderController extends GetRxController {
  placeOrder() {
    const cart = Get.find(CartController);
    const items = cart?.items.value ?? [];
    // ... process order with items
  }
}
```

When reaching into a sibling API (for example `ui.flush()` from message logic), prefer explicit local variables:

```ts
class MessagesController extends GetRxController {
  onToolCall() {
    const ui = Get.find(ChatController)?.ui;
    ui?.flush();
  }
}
```

If your app uses tagged controller instances, always pass the same tag in `Get.find` that was used in `useGet`:

```ts
// Component side
const chat = useGet(ChatController, { tag: roomId, args: [roomId] });

// Imperative lookup side
const chat = Get.find(ChatController, { tag: roomId });
```

Mixing tagged and untagged lookups is a common source of subtle bugs (wrong instance or `undefined`).

### Derived / Computed Values

Expose computed getters on the controller rather than creating extra `Obs` instances:

```ts
class CartController extends GetRxController {
  items = new Obs<CartItem[]>([]);

  get total(): number {
    return (this.items.value ?? []).reduce((sum, i) => sum + i.price * i.qty, 0);
  }
}
```

Note: since `total` is not an `Obs`, calling `c.total` does not subscribe the component — it is a snapshot. If the component needs reactive updates, call `c.items.use()` and derive the total in the render body.

## Quick Reference

| Import | Purpose |
|---|---|
| `GetRxController` | Base class for all controllers |
| `Obs<T>` | Reactive value holder |
| `useGet(Ctrl, opts?)` | Retrieve/create a controller in React |
| `Get.find(Ctrl, opts?)` | Look up a controller imperatively (may return `undefined`) |
| `obs.use()` | React hook — subscribe and re-render |
| `obs.value` / `obs.get()` | Read without subscribing |
| `obs.value = x` / `obs.set(x)` | Write and notify subscribers |
