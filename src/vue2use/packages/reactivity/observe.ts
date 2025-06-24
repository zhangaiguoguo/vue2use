import vm from "../vm";
import { ReactiveFlags } from "./operations";
import { Dep } from "./dep";

const { $data } = vm,
  ObserverV2 = $data[ReactiveFlags.OB].constructor;

class Observer<T> {
  //@ts-ignore
  vmCount: number;
  constructor(
    public readonly value: T,
    public readonly shallow = false,
    public readonly mock = false
  ) {
    return new ObserverV2(value, shallow, mock);
  }
  //@ts-ignore
  readonly dep: Dep;
}

export { Observer };
