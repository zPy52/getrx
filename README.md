# getrx

[![NPM Version](https://img.shields.io/npm/v/getrx?style=for-the-badge)](https://www.npmjs.com/package/getrx)
[![NPM Downloads](https://img.shields.io/npm/dm/getrx?style=for-the-badge)](https://www.npmjs.com/package/getrx)

Sublimely simple state management for React.

`getrx` provides a minimal and intuitive API for managing state in your React applications. It's built with simplicity and performance in mind, leveraging the power of React hooks and classes to create a state-management solution that is both easy to learn and powerful enough for complex applications.

---

## ✨ Quick example

```tsx
import React from "react";
import { Obs, useGet, GetRxController } from "getrx";

// 1️⃣ Define a controller that groups state & logic
class CounterController extends GetRxController {
  count = new Obs(0);

  increment() {
    this.count.value = (this.count.value ?? 0) + 1;
  }
}

// 2️⃣ Use the controller from a component
export function Counter() {
  const controller = useGet(CounterController);
  const count = controller.count.use(); // re-renders on every update

  return (
    <button onClick={() => {controller.increment()}}>
      Clicked {count} times
    </button>
  );
}
```

That is *all* the code required for a fully-reactive counter – no reducers, no actions, no boilerplate 🎉

---

## Core concepts

* **Controllers** – Plain classes that extend (optionally) `GetRxController` and encapsulate state + business logic.
* **Observables** – Instances of `Obs<T>` that store a value and notify subscribers when that value changes.
* **Hooks** – React helpers (`useGet`, `useOnObsChange`, `Obs.use`) that wire everything together.

---

## Installation

```bash
npm install getrx
```
or

```bash
yarn add getrx
```

---

## Detailed guide

### 1. Create a controller

```ts
// CounterController.ts
import { Obs, GetRxController } from "getrx";

export class CounterController extends GetRxController {
  count = new Obs(0);

  increment() {
    this.count.value = (this.count.value ?? 0) + 1;
  }
}
```

### 2. Consume it in a component

```tsx
// Counter.tsx
import { useGet } from "getrx";
import { CounterController } from "./CounterController";

export function Counter() {
  const controller = useGet(CounterController);
  const count = controller.count.use();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => controller.increment()}>Increment</button>
    </div>
  );
}
```

`useGet` guarantees that *exactly* one `CounterController` instance exists in the whole React tree for a given controller constructor and optional tag, and cleans it up automatically when the last component using it unmounts.

---

## API reference

### `Obs<T>`
The heart of reactivity.

| Member | Description |
| ------ | ----------- |
| `new Obs(initial?)` | Creates a new observable. |
| `value / get()` | Read the current value. |
| `value = x / set(x)` | Update the value **synchronously** and notify listeners. |
| `on(listener)` | Imperatively subscribe to changes. |
| `off(listener)` | Remove a listener. |
| `use()` | React hook that returns the current value and re-renders the component on updates. |

### `useGet(Controller, options?)`
Primary hook to retrieve (or lazily create) a controller instance.

| Option | Type | Default | Purpose |
| ------ | ---- | ------- | ------- |
| `tag`  | `string` | `undefined` | Differentiates multiple instances of the same class (`TodoController-inbox`, `TodoController-work`, …). |
| `args` | `any[]`  | `[]` | Constructor arguments forwarded to `new Controller(...args)`. |

Instances are identified internally by the controller constructor object plus the optional `tag`, not by `class.name`, so production minification does not cause collisions between different controllers.

### `useOnObsChange(obs)`
Lower-level hook used internally by `Obs.use()` – subscribe directly to an `Obs` when you cannot use the convenience method.

### `GetRxController`
Base class for all controllers. Add state, observables, methods, constructor logic, and any domain-specific helpers you need.

---

## Advanced patterns

### Constructor arguments & tags

```ts
const userCtrl = useGet(UserController, {
  tag: "admin-panel",
  args: [initialUser]
});
```

### Sharing state between components
Because controllers are cached globally (by controller identity + tag), different components can effortlessly share state:

```tsx
const counterA = useGet(CounterController); // same instance everywhere
const counterB = useGet(CounterController, { tag: "sidebar" });
```

This also means two different controller classes remain isolated even if a bundler minifies both runtime names to the same short value.

### Explicit setup
If a controller needs startup work, expose an explicit method and call it from the component that uses the controller:

```tsx
import { useEffect } from "react";

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
