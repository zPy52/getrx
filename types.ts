import type { GetRxController } from "./controller";

export type ObsListener<T> = (value: T) => void;

export interface ObsEmitter<T> {
  on: (listener: ObsListener<T>) => void;
  off: (listener: ObsListener<T>) => void;
  emit: (value: T) => void;
  value: T | undefined;
}

export type GetRxControllerFactory<T extends GetRxController> = () => T;