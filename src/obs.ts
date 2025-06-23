import type { ObsEmitter, ObsListener } from "./types";
import { useOnObsChange } from "./hooks";

export class Obs<T> implements ObsEmitter<T> {
  private eventHandlers: ObsListener<T>[] = [];
  private currentValue: T | undefined;

  constructor(initialValue?: T | undefined) {
    this.currentValue = initialValue;
  }

  public get value(): T | undefined {
    return this.get();
  }

  public get(): T | undefined {
    return this.currentValue;
  }

  public set value(value: T) {
    this.set(value);
  }

  public set(value: T) {
    this.currentValue = value;
    this.eventHandlers.forEach(listener => listener(value));
    
  }

  public on(listener: ObsListener<T>) {
    this.eventHandlers.push(listener);
    if (this.currentValue !== undefined) {
      listener(this.currentValue);
    }
  }

  public off(listener: ObsListener<T>) {
    this.eventHandlers = this.eventHandlers.filter(l => l !== listener);
  }

  public use(): T | undefined {
    return useOnObsChange(this);
  }
}