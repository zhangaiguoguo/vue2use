import { track } from "./dep";
import { toRaw } from "./reactive";
import {
  pauseScheduling,
  pauseTracking,
  resetScheduling,
  resetTracking,
} from "./effect";
import { TrackOpTypes } from "./operations";

interface Options {
  fn(...args: any[]): any;
}

function createArrayInstrumentations(): Record<string, Options["fn"]> {
  const instrumentations: Record<string, Options["fn"]> = {};
  ["includes", "indexOf", "lastIndexOf"].forEach((key) => {
    instrumentations[key] = function (...args: any[]) {
      const arr = toRaw(this);
      //@ts-ignore
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + "");
      }
      const res = arr[key](...args);
      if (res === -1 || res === false) {
        return arr[key](...args.map(toRaw));
      } else {
        return res;
      }
    };
  });
  ["push", "pop", "shift", "unshift", "splice"].forEach((key) => {
    instrumentations[key] = function (...args: any[]) {
      pauseTracking();
      pauseScheduling();
      const res = toRaw(this)[key].apply(this, args);
      resetScheduling();
      resetTracking();
      return res;
    };
  });
  return instrumentations;
}

const arrayInstrumentations: Record<string, Options["fn"]> =
  createArrayInstrumentations();

export { createArrayInstrumentations, arrayInstrumentations };
