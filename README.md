# getrx

[![NPM Version](https://img.shields.io/npm/v/getrx?style=for-the-badge)](https://www.npmjs.com/package/getrx)
[![NPM Downloads](https://img.shields.io/npm/dm/getrx?style=for-the-badge)](https://www.npmjs.com/package/getrx)

Sublimely simple state management for React.

`getrx` provides a minimal and intuitive API for managing state in your React applications. It's built with simplicity and performance in mind, leveraging the power of React hooks and classes to create a state management solution that is both easy to learn and powerful enough for complex applications.

## Core Concepts

-   **Controllers**: State and business logic are encapsulated in `GetRxController` classes. This keeps your UI components clean and focused on rendering.
-   **Observables**: State properties within controllers are wrapped in an `Obs` class, making them observable. Components can subscribe to these observables and automatically re-render when their value changes.
-   **Hooks**: A set of custom React hooks (`useGetPut`, `useOnObsChange`, etc.) provide a simple way to connect your components to controllers and their state.

## Installation

```bash
npm install getrx
```

or

```bash
yarn add getrx
```

## Getting Started

Let's build a simple counter to see `getrx` in action.

### 1. Create a Controller

First, define a controller that will hold our counter's state and logic. Create a file `CounterController.ts`:

```typescript
// src/controllers/CounterController.ts
import { GetRxController, Obs } from "getrx";

export class CounterController extends GetRxController {
  // Create an observable for the count
  public readonly count = new Obs(0);

  // Method to increment the count
  public increment() {
    this.count.emit((this.count.value ?? 0) + 1);
  }
}
```

### 2. Connect to a Component

Now, let's use this controller in a React component.

```tsx
// src/components/Counter.tsx
import React from "react";
import { useGetPut } from "getrx";
import { CounterController } from "../controllers/CounterController";

export function Counter() {
  // Get (or create) an instance of our controller
  const controller = useGetPut("counter", () => new CounterController());

  // Use the .obs() hook on our observable to get its value
  // The component will re-render whenever the value changes
  const count = controller.count.obs();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => controller.increment()}>Increment</button>
    </div>
  );
}
```

And that's it! You have a fully reactive counter. The `useGetPut` hook handles creating and caching the controller instance, and the `count.obs()` method subscribes your component to state updates.

## API Reference

### `Obs<T>`

The `Obs` class is the heart of reactivity in `getrx`.

-   `new Obs(initialValue)`: Creates a new observable with an initial value.
-   `.value`: A getter to access the current value of the observable.
-   `.emit(newValue)`: Emits a new value to all subscribers.
-   `.obs()`: A custom hook to be used inside a component. It returns the current value and subscribes the component to future updates.

### `GetRxController`

This is the base class for all your controllers.

-   `onInit()`: An optional async lifecycle method called when the controller is first created and put into the cache. Perfect for fetching initial data.
-   `onClose()`: An optional async lifecycle method called when the controller is removed from the cache. Use this for any cleanup logic.

### `useGetPut(tag, factory, options?)`

This hook is the primary way to interact with controllers in your components. It retrieves an existing controller from the cache or creates a new one.

-   `tag: string`: A unique string to identify the controller instance in the cache.
-   `factory: () => T`: A function that returns a new instance of your controller. It's only called if the controller is not already in the cache.
-   `options.persist?: boolean`: (Default: `false`) If `false`, the controller is automatically removed from the cache when the last component using it unmounts. If `true`, it will persist in the cache until manually removed.

### `useGetFind(tag)`

Retrieves a controller from the cache if it exists, but does not create a new one. Returns `undefined` if the controller is not found.

```tsx
const controller = useGetFind<CounterController>("counter");
```

### `useOnObsChange(obs)`

The standard hook for subscribing to an `Obs` instance. The `obs.obs()` method is a convenient shortcut for this.

```tsx
const count = useOnObsChange(controller.count);
```

## Advanced Usage

### Sharing State Between Components

Because controllers are stored in a global cache and identified by tags, sharing state between components is effortless.

Let's create another component that displays the counter value.

```tsx
// src/components/CounterDisplay.tsx
import React from "react";
import { useGetPut } from "getrx";
import { CounterController } from "../controllers/CounterController";

export function CounterDisplay() {
  // Use the same tag 'counter' to get the *same* instance
  const controller = useGetPut("counter", () => new CounterController());
  const count = controller.count.obs();

  return <p>Current count from another component: {count}</p>;
}
```

If you render `<Counter />` and `<CounterDisplay />` in your app, they will both share and react to the same state from the single `CounterController` instance. When you click the button in `<Counter />`, the text in `<CounterDisplay />` will update automatically.

### Asynchronous Actions

The `onInit` lifecycle method in a `GetRxController` is the perfect place for asynchronous operations like fetching data.

```typescript
// src/controllers/UserController.ts
import { GetRxController, Obs } from "getrx";

interface User {
  name: string;
}

export class UserController extends GetRxController {
  public readonly user = new Obs<User | undefined>();
  public readonly isLoading = new Obs(true);

  async onInit() {
    try {
      const response = await fetch("https://api.example.com/user");
      const data = await response.json();
      this.user.emit(data);
    } catch (e) {
      console.error("Failed to fetch user", e);
    } finally {
      this.isLoading.emit(false);
    }
  }
}
```

```tsx
// src/components/UserInfo.tsx
import React from "react";
import { useGetPut } from "getrx";
import { UserController } from "../controllers/UserController";

export function UserInfo() {
  const controller = useGetPut("user", () => new UserController());
  const user = controller.user.obs();
  const isLoading = controller.isLoading.obs();

  if (isLoading) {
    return <p>Loading...</p>;
  }

  return <div>Hello, {user?.name}</div>;
}
```
