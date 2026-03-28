import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create } from "react-test-renderer";
import { Get } from "../src/cache";
import { GetRxController } from "../src/controller";
import { useGet } from "../src/hooks";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setRuntimeName(ControllerClass: Function, name: string) {
  Object.defineProperty(ControllerClass, "name", {
    configurable: true,
    value: name,
  });
}

function installFakeTimers() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  let nextId = 1;
  const scheduled = new Map<number, () => void>();

  globalThis.setTimeout = ((callback: TimerHandler, _delay?: number, ...args: unknown[]) => {
    const timerId = nextId++;

    scheduled.set(timerId, () => {
      if (typeof callback === "function") {
        callback(...args);
      }
    });

    return timerId as unknown as NodeJS.Timeout;
  }) as typeof setTimeout;

  globalThis.clearTimeout = ((timerId: NodeJS.Timeout) => {
    scheduled.delete(timerId as unknown as number);
  }) as typeof clearTimeout;

  return {
    runAll() {
      const pending = [...scheduled.values()];
      scheduled.clear();
      pending.forEach(runTimer => runTimer());
    },
    restore() {
      scheduled.clear();
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

function ControllerHarness({
  ControllerClass,
  tag,
}: {
  ControllerClass: new (...args: any[]) => GetRxController;
  tag?: string;
}) {
  useGet(ControllerClass, tag ? { tag } : {});
  return null;
}

test("same controller class without a tag reuses the cached instance", () => {
  class AuthController extends GetRxController {}

  const first = Get.put(AuthController);
  const second = Get.put(AuthController);
  const found = Get.find(AuthController);

  assert.strictEqual(second, first);
  assert.strictEqual(found, first);

  Get.delete(AuthController);
});

test("same controller class with different tags stays isolated", () => {
  class AuthController extends GetRxController {}

  const dashboard = Get.put(AuthController, { tag: "dashboard" });
  const billing = Get.put(AuthController, { tag: "billing" });

  assert.notStrictEqual(dashboard, billing);
  assert.strictEqual(Get.find(AuthController, { tag: "dashboard" }), dashboard);
  assert.strictEqual(Get.find(AuthController, { tag: "billing" }), billing);

  Get.delete(AuthController, { tag: "dashboard" });
  Get.delete(AuthController, { tag: "billing" });
});

test("different controller classes do not collide when runtime names match", () => {
  class AuthController extends GetRxController {}
  class BillingController extends GetRxController {}

  setRuntimeName(AuthController, "Minified");
  setRuntimeName(BillingController, "Minified");

  const auth = Get.put(AuthController);
  const billing = Get.put(BillingController);

  assert.notStrictEqual(auth, billing);
  assert.strictEqual(Get.find(AuthController), auth);
  assert.strictEqual(Get.find(BillingController), billing);

  Get.delete(AuthController);
  Get.delete(BillingController);
});

test("find, delete, and exists share the same constructor-based identity rules", () => {
  class AuthController extends GetRxController {}
  class BillingController extends GetRxController {}

  setRuntimeName(AuthController, "Minified");
  setRuntimeName(BillingController, "Minified");

  const auth = Get.put(AuthController, { tag: "shared" });
  const billing = Get.put(BillingController, { tag: "shared" });

  assert.strictEqual(Get.find(AuthController, { tag: "shared" }), auth);
  assert.strictEqual(Get.find(BillingController, { tag: "shared" }), billing);
  assert.equal(Get.exists(AuthController, { tag: "shared" }), true);
  assert.equal(Get.exists(BillingController, { tag: "shared" }), true);

  Get.delete(AuthController, { tag: "shared" });

  assert.equal(Get.exists(AuthController, { tag: "shared" }), false);
  assert.equal(Get.exists(BillingController, { tag: "shared" }), true);
  assert.strictEqual(Get.find(BillingController, { tag: "shared" }), billing);

  Get.delete(BillingController, { tag: "shared" });
});

test("useGet lifecycle bookkeeping does not cross-talk for controllers with the same runtime name", () => {
  class AuthController extends GetRxController {}
  class BillingController extends GetRxController {}

  setRuntimeName(AuthController, "Minified");
  setRuntimeName(BillingController, "Minified");

  const timers = installFakeTimers();

  try {
    let authRenderer: ReturnType<typeof create>;
    let billingRenderer: ReturnType<typeof create>;

    act(() => {
      authRenderer = create(
        React.createElement(ControllerHarness, { ControllerClass: AuthController }),
      );
    });

    assert.equal(Get.exists(AuthController), true);

    act(() => {
      authRenderer!.unmount();
    });

    assert.equal(Get.exists(AuthController), true);

    act(() => {
      billingRenderer = create(
        React.createElement(ControllerHarness, { ControllerClass: BillingController }),
      );
    });

    assert.equal(Get.exists(BillingController), true);

    timers.runAll();

    assert.equal(Get.exists(AuthController), false);
    assert.equal(Get.exists(BillingController), true);

    act(() => {
      billingRenderer!.unmount();
    });

    timers.runAll();

    assert.equal(Get.exists(BillingController), false);
  } finally {
    timers.restore();
    Get.delete(AuthController);
    Get.delete(BillingController);
  }
});
