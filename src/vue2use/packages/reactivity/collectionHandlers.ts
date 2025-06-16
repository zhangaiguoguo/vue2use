import {
  getProto,
  hasChanged,
  hasOwn,
  isMap,
  ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
  toRawType,
} from "./shared";
import {
  type Target,
  toRaw,
  toReactive,
  toReadonly,
  toShallow,
} from "./reactive";
import { track, trigger } from "./dep";
import warn from "./warning";
import { ReactiveFlags, TrackOpTypes, TriggerOpTypes } from "./operations";

type IterableCollections = (Map<any, any> | Set<any>) & Target;
type WeakCollections = (WeakMap<any, any> | WeakSet<any>) & Target;
type MapTypes = (Map<any, any> | WeakMap<any, any>) & Target;
type SetTypes = (Set<any> | WeakSet<any>) & Target;
type CollectionTypes = IterableCollections | WeakCollections;

function get(
  target: MapTypes,
  key: unknown,
  isReadonly = false,
  isShallow = false
) {
  target = target[ReactiveFlags.RAW];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly) {
    if (hasChanged(key, rawKey)) {
      track(rawTarget, TrackOpTypes.GET, key);
    }
    track(rawTarget, TrackOpTypes.GET, rawKey);
  }
  const { has: has2 } = getProto(rawTarget) as CollectionTypes;
  const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
  if (has2.call(rawTarget, key)) {
    return wrap(target.get(key));
  } else if (has2.call(rawTarget, rawKey)) {
    return wrap(target.get(rawKey));
  } else if (target !== rawTarget) {
    target.get(key);
  }
}

function has(this: CollectionTypes, key: any, isReadonly = false) {
  const target = this[ReactiveFlags.RAW];
  const rawTarget = toRaw(target);
  const rawKey = toRaw(key);
  if (!isReadonly) {
    if (hasChanged(key, rawKey)) {
      track(rawTarget, TrackOpTypes.HAS, key);
    }
    track(rawTarget, TrackOpTypes.HAS, rawKey);
  }
  return key === rawKey
    ? target.has(key)
    : target.has(key) || target.has(rawKey);
}

function size(target: CollectionTypes, isReadonly = false) {
  target = target[ReactiveFlags.RAW];
  !isReadonly && track(toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY);
  return Reflect.get(target, "size", target);
}

function add(this: SetTypes, value: unknown) {
  value = toRaw(value);
  const target = toRaw(this);
  const proto = getProto(target) as SetTypes;
  const hadKey = proto.has.call(target, value);
  if (!hadKey) {
    target.add(value);
    trigger(target, TriggerOpTypes.ADD, value, value);
  }
  return this;
}

function checkIdentityKeys(
  target: IterableCollections,
  has2: (key: unknown) => boolean,
  key: unknown
) {
  const rawKey = toRaw(key);
  if (rawKey !== key && has2.call(target, rawKey)) {
    const type = toRawType(target);
    warn(
      `Reactive ${type} contains both the raw and reactive versions of the same object${
        type === `Map` ? ` as keys` : ``
      }, which can lead to inconsistencies. Avoid differentiating between the raw and reactive versions of an object and only use the reactive version if possible.`
    );
  }
}

function set(this: MapTypes, key: unknown, value: unknown) {
  value = toRaw(value);
  const target = toRaw(this);
  const { has: has2, get: get2 } = getProto(target) as MapTypes;
  let hadKey = has2.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  } else {
    checkIdentityKeys(<IterableCollections>target, has2, key);
  }
  const oldValue = get2.call(target, key);
  target.set(key, value);
  if (!hadKey) {
    trigger(target, TriggerOpTypes.ADD, key, value);
  } else if (hasChanged(value, oldValue)) {
    trigger(target, TriggerOpTypes.SET, key, value, oldValue);
  }
  return this;
}

function deleteEntry(this: IterableCollections, key: unknown) {
  const target = toRaw(this);
  //@ts-ignore
  const { has: has2, get: get2 } = getProto(target) as IterableCollections;
  let hadKey = has2.call(target, key);
  if (!hadKey) {
    key = toRaw(key);
    hadKey = has2.call(target, key);
  } else {
    checkIdentityKeys(target, has2, key);
  }
  const oldValue = get2 ? get2.call(target, key) : void 0;
  const result = target.delete(key);
  if (hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, void 0, oldValue);
  }
  return result;
}

function clear(this: IterableCollections) {
  const target = toRaw(this);
  const hadItems = target.size !== 0;
  const oldTarget = isMap(target) ? new Map(target) : new Set(target);
  const result = target.clear();
  if (hadItems) {
    trigger(target, TriggerOpTypes.CLEAR, void 0, void 0, oldTarget);
  }
  return result;
}

function createForEach(isReadonly: boolean, isShallow: boolean) {
  return function forEach(
    this: IterableCollections,
    callback: Function,
    thisArg: unknown
  ) {
    const observed = this;
    const target = observed[ReactiveFlags.RAW];
    const rawTarget = toRaw(target);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY);
    return target.forEach((value: unknown, key: unknown) => {
      return callback.call(thisArg, wrap(value), wrap(key), observed);
    });
  };
}

function createIterableMethod(
  method: string | symbol,
  isReadonly: boolean,
  isShallow: boolean
) {
  return function <T>(
    this: IterableCollections,
    ...args: any[]
  ): Iterable<unknown> & Iterator<unknown> {
    const target = this[ReactiveFlags.RAW];
    const rawTarget = toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair =
      method === "entries" || (method === Symbol.iterator && targetIsMap);
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow ? toShallow : isReadonly ? toReadonly : toReactive;
    !isReadonly &&
      track(
        rawTarget,
        TrackOpTypes.ITERATE,
        isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
      );
    return {
      next() {
        const { value, done } = innerIterator.next();
        return done
          ? { value, done }
          : {
              value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              done,
            };
      },
      [Symbol.iterator]() {
        return this;
      },
    };
  };
}

const cacheStringFunction = (fn: (a: string) => any) => {
  const cache = Object.create(null);
  return (str: string) => {
    const hit = cache[str];
    return hit || (cache[str] = fn(str));
  };
};

const capitalize = cacheStringFunction((str) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
});

function createReadonlyMethod(type: TriggerOpTypes) {
  return function (this: CollectionTypes, ...args: unknown[]) {
    {
      const key = args[0] ? `on key "${args[0]}" ` : ``;
      warn(
        `${capitalize(type)} operation ${key}failed: target is readonly.`,
        toRaw(this)
      );
    }
    return type === "delete" ? false : type === "clear" ? void 0 : this;
  };
}

type Instrumentations = Record<string | symbol, Function | number>;

function createInstrumentations() {
  const mutableInstrumentations2: Instrumentations = {
    get(this: MapTypes, key: any) {
      return get(this, key);
    },
    get size() {
      //@ts-ignore
      return size(this as CollectionTypes);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, false),
  };
  const shallowInstrumentations2: Instrumentations = {
    get(this: MapTypes, key: any) {
      return get(this, key, false, true);
    },
    get size() {
      //@ts-ignore
      return size(this as IterableCollections);
    },
    has,
    add,
    set,
    delete: deleteEntry,
    clear,
    forEach: createForEach(false, true),
  };
  const readonlyInstrumentations2: Instrumentations = {
    get(this: MapTypes, key: any) {
      return get(this, key, true);
    },
    get size() {
      //@ts-ignore
      return size(this as IterableCollections, true);
    },
    has(this: IterableCollections, key: any) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, false),
  };
  const shallowReadonlyInstrumentations2: Instrumentations = {
    get(this: MapTypes, key: any) {
      return get(this, key, true, true);
    },
    get size() {
      //@ts-ignore
      return size(this as IterableCollections, true);
    },
    has(this: IterableCollections, key: any) {
      return has.call(this, key, true);
    },
    add: createReadonlyMethod(TriggerOpTypes.ADD),
    set: createReadonlyMethod(TriggerOpTypes.SET),
    delete: createReadonlyMethod(TriggerOpTypes.DELETE),
    clear: createReadonlyMethod(TriggerOpTypes.CLEAR),
    forEach: createForEach(true, true),
  };
  const iteratorMethods = ["keys", "values", "entries", Symbol.iterator];
  iteratorMethods.forEach((method) => {
    mutableInstrumentations2[method] = createIterableMethod(
      method,
      false,
      false
    );
    readonlyInstrumentations2[method] = createIterableMethod(
      method,
      true,
      false
    );
    shallowInstrumentations2[method] = createIterableMethod(
      method,
      false,
      true
    );
    shallowReadonlyInstrumentations2[method] = createIterableMethod(
      method,
      true,
      true
    );
  });
  return [
    mutableInstrumentations2,
    readonlyInstrumentations2,
    shallowInstrumentations2,
    shallowReadonlyInstrumentations2,
  ];
}

const [
  mutableInstrumentations,
  readonlyInstrumentations,
  shallowInstrumentations,
  shallowReadonlyInstrumentations,
] = createInstrumentations();

function createInstrumentationGetter(isReadonly: boolean, shallow: boolean) {
  const instrumentations = shallow
    ? isReadonly
      ? shallowReadonlyInstrumentations
      : shallowInstrumentations
    : isReadonly
    ? readonlyInstrumentations
    : mutableInstrumentations;

  return (
    target: CollectionTypes,
    key: string | symbol,
    receiver: CollectionTypes
  ) => {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    } else if (key === ReactiveFlags.RAW) {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key as string) && key in target
        ? instrumentations
        : target,
      key,
      receiver
    );
  };
}

export const mutableCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, false),
};

export const shallowCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(false, true),
};
export const readonlyCollectionHandlers: ProxyHandler<CollectionTypes> = {
  get: createInstrumentationGetter(true, false),
};
export const shallowReadonlyCollectionHandlers: ProxyHandler<CollectionTypes> =
  {
    get: createInstrumentationGetter(true, true),
  };
