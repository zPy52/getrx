import type { GetRxController } from "./controller";

export type GetRxControllerClass<
  T extends GetRxController = GetRxController,
  Args extends any[] = any[],
> = (new (...args: Args) => T) & {
  displayName?: string;
};

const constructorIds = new WeakMap<Function, string>();
let nextControllerId = 0;

function normalizeLabel(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getReadableControllerLabel(
  ControllerClass: GetRxControllerClass,
): string {
  return (
    normalizeLabel(ControllerClass.displayName) ??
    normalizeLabel(ControllerClass.name) ??
    "AnonymousController"
  );
}

function getControllerRuntimeId(ControllerClass: GetRxControllerClass): string {
  const existingId = constructorIds.get(ControllerClass);
  if (existingId) {
    return existingId;
  }

  const runtimeId = `${getReadableControllerLabel(ControllerClass)}#${++nextControllerId}`;
  constructorIds.set(ControllerClass, runtimeId);
  return runtimeId;
}

export function getControllerKey(
  ControllerClass: GetRxControllerClass,
  suffix?: string,
): string {
  const baseKey = getControllerRuntimeId(ControllerClass);
  return suffix ? `${baseKey}-${suffix}` : baseKey;
}
