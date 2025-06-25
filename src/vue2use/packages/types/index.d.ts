import { ComponentInstance, VNode as VNode$1 } from 'vue/types/index';
import * as vue_types_vue from 'vue/types/vue';
import { CreateElement } from 'vue/types/vue';
import * as vue_types_v3_component_public_instance from 'vue/types/v3-component-public-instance';
import * as vue from 'vue';
import vue__default from 'vue';
import { VNodeChildren, VNode, VNodeData } from 'vue/types/vnode';
import { Component, AsyncComponent } from 'vue/types/umd';
import { ComponentOptions, PropsDefinition } from 'vue/types/options';
import { ComponentOptionsMixin } from 'vue/types/v3-component-options';

declare enum TrackOpTypes {
    GET = "get",
    ITERATE = "iterate",
    HAS = "has"
}
declare enum TriggerOpTypes {
    SET = "set",
    ADD = "add",
    DELETE = "delete",
    CLEAR = "clear",
    ARRAY_MUTATION = "array mutation"
}
declare enum ReactiveFlags {
    SKIP = "__v_skip",
    IS_REACTIVE = "__v_isReactive",
    IS_READONLY = "__v_isReadonly",
    IS_SHALLOW = "__v_isShallow",
    RAW = "__v_raw",
    IS_REF = "__v_isRef",
    DEP = "dep",
    OB = "__ob__"
}

interface DebuggerOptions {
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
}
type DebuggerEvent = {
    effect: any;
} & DebuggerEventExtraInfo;
type DebuggerEventExtraInfo = {
    target: object;
    type: TrackOpTypes | TriggerOpTypes;
    key?: any;
    newValue?: any;
    oldValue?: any;
};

interface DepTarget extends DebuggerOptions {
    id: number;
    addDep(dep: Dep): void;
    update(): void;
}
declare class Dep {
    static target?: DepTarget | null;
    id: number;
    subs: Array<DepTarget | null>;
    constructor();
    depend(info?: DebuggerEventExtraInfo): void;
    notify(info?: DebuggerEventExtraInfo): void;
}
declare function track(target: object, type: TrackOpTypes, key: any): void;
declare function trigger(target: object, type: TriggerOpTypes, key: any, newValue?: any, oldValue?: any): void;

declare class Watcher implements DepTarget {
    vm?: ComponentInstance | null | void;
    cb: Function | null;
    id: number;
    user: boolean;
    dirty: boolean | null;
    expression: string;
    active: boolean | null;
    deps: Array<Dep2> | null;
    getter: Function | null;
    value: any;
    noRecurse: boolean;
    post?: boolean | void;
    onTrack?: ((event: DebuggerEvent) => void) | undefined;
    onTrigger?: ((event: DebuggerEvent) => void) | undefined;
    before?: Function;
    onStop?: Function;
    constructor(vm: ComponentInstance | null | void, expOrFn: string | (() => any), cb: Function, options?: WatcherOptions | null, isRenderWatcher?: boolean);
    get(): any;
    addDep(dep: Dep): void;
    cleanupDeps(): void;
    update(): void;
    run(): void;
    evaluate(): void;
    depend(): void;
    teardown(): void;
}
interface WatcherOptions extends DebuggerOptions {
    deep?: boolean;
    user?: boolean;
    lazy?: boolean;
    sync?: boolean;
    before?: Function;
}

type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N;

declare const RefSymbol: unique symbol;
declare const RawSymbol: unique symbol;
interface Ref<T = any, S = T> {
    get value(): T;
    set value(_: S);
    dep: Dep | void;
    [RefSymbol]: true;
}
type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>;
type ToRefs<T = any> = {
    [K in keyof T]: ToRef<T[K]>;
};
declare const ShallowRefMarker: unique symbol;
type ShallowRef<T = any, S = T> = Ref<T, S> & {
    [ShallowRefMarker]?: true;
};
type MaybeRef<T = any> = T | Ref<T> | ShallowRef<T> | WritableComputedRef<T>;
type MaybeRefOrGetter<T = any> = MaybeRef<T> | ComputedRef<T> | (() => T);
declare class RefImplCommon implements Target {
    readonly [ReactiveFlags.IS_SHALLOW]: boolean;
    readonly [ReactiveFlags.IS_REF] = true;
    constructor(shallow?: boolean);
}
declare class RefImpl<T, S = T> extends RefImplCommon {
    _rawValue: any;
    _value: any;
    constructor(value?: T, shallow?: boolean);
    get value(): T;
    set value(v: S);
    get dep(): Dep | void;
}
type CustomRefFactory<T> = (track: () => void, trigger: (newVal?: T, oldValue?: T | void) => void) => {
    get: () => T;
    set: (value: T) => void;
};
declare function shallowRef<T>(value: T): RefImpl<T>;
declare function customRef<T>(factory: CustomRefFactory<T>): Ref<T>;
declare function isRef<T>(target: Ref<T> | unknown): target is Ref<T>;
declare function unref<T>(ref: MaybeRef<T> | ComputedRef<T>): T;
declare function triggerRef(ref2: Ref): void;
interface RefUnwrapBailTypes {
}
type ShallowUnwrapRef<T> = {
    [K in keyof T]: DistributeRef<T[K]>;
};
type DistributeRef<T> = T extends Ref<infer V, unknown> ? V : T;
type UnwrapRef<T> = T extends ShallowRef<infer V, unknown> ? V : T extends Ref<infer V, unknown> ? UnwrapRefSimple<V> : UnwrapRefSimple<T>;
type UnwrapRefSimple<T> = T extends Builtin | Ref | RefUnwrapBailTypes[keyof RefUnwrapBailTypes] | {
    [RawSymbol]?: true;
} ? T : T extends Map<infer K, infer V> ? Map<K, UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Map<any, any>>> : T extends WeakMap<infer K, infer V> ? WeakMap<K, UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof WeakMap<any, any>>> : T extends Set<infer V> ? Set<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof Set<any>>> : T extends WeakSet<infer V> ? WeakSet<UnwrapRefSimple<V>> & UnwrapRef<Omit<T, keyof WeakSet<any>>> : T extends ReadonlyArray<any> ? {
    [K in keyof T]: UnwrapRefSimple<T[K]>;
} : T extends object & {
    [ShallowReactiveMarker]?: never;
} ? {
    [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>;
} : T;
declare function toRef<T>(value: T): T extends () => infer R ? Readonly<Ref<R>> : T extends Ref ? T : Ref<UnwrapRef<T>>;
declare function toRef<T extends object, K extends keyof T>(object: T, key: K): ToRef<T[K]>;
declare function toRef<T extends object, K extends keyof T>(object: T, key: K, defaultValue: T[K]): ToRef<Exclude<T[K], undefined>>;
declare function toRefs<T extends object>(target: T): ToRefs<T>;
declare function ref<T>(target?: T): Ref<T>;
declare function toValue<T>(source: MaybeRefOrGetter<T>): T;

interface Target {
    [ReactiveFlags.SKIP]?: boolean;
    [ReactiveFlags.IS_REACTIVE]?: boolean;
    [ReactiveFlags.IS_READONLY]?: boolean;
    [ReactiveFlags.IS_SHALLOW]?: boolean;
    [ReactiveFlags.RAW]?: any;
}
type Primitive = string | number | boolean | bigint | symbol | undefined | null;
type Builtin = Primitive | Function | Date | Error | RegExp;
declare const ShallowReactiveMarker: unique symbol;
type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>;
type DeepReadonly<T> = T extends Builtin ? T : T extends Map<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> : T extends WeakMap<infer K, infer V> ? WeakMap<DeepReadonly<K>, DeepReadonly<V>> : T extends Set<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends ReadonlySet<infer U> ? ReadonlySet<DeepReadonly<U>> : T extends WeakSet<infer U> ? WeakSet<DeepReadonly<U>> : T extends Promise<infer U> ? Promise<DeepReadonly<U>> : T extends Ref<infer U, unknown> ? Readonly<Ref<DeepReadonly<U>>> : T extends {} ? {
    readonly [K in keyof T]: DeepReadonly<T[K]>;
} : Readonly<T>;
declare const toReactive: <T extends unknown>(a: T) => T;
declare const toReadonly: <T extends unknown>(a: T) => T;
declare const toShallow: <T extends unknown>(a: T) => T;
declare function toRaw<T>(observed: T): T;
declare function isReactive(value: any): boolean;
declare function isReadonly(value: any): boolean;
declare function isShallow(value: any): boolean;
declare function isProxy(value: any): boolean;
declare function markRaw<T extends object>(value: T): T;
declare function reactive<T extends object>(target: T): T;
declare function shallowReactive<T extends object>(target: T): T;
declare function readonly<T extends object>(target: T): DeepReadonly<UnwrapNestedRefs<T>>;
declare function shallowReadonly<T extends object>(target: T): T;
declare function proxyRefs<T>(objectWithRefs: T): T;

declare const ComputedRefSymbol: unique symbol;
declare const WritableComputedRefSymbol: unique symbol;
interface BaseComputedRef<T, S = T> extends Ref<T, S> {
    [ComputedRefSymbol]: true;
    effect: Watcher;
}
interface ComputedRef<T = any> extends BaseComputedRef<T> {
    readonly value: T;
}
interface WritableComputedRef<T, S = T> extends BaseComputedRef<T, S> {
    [WritableComputedRefSymbol]: true;
}
type ComputedGetter<T> = (oldValue?: T) => T;
type ComputedSetter<T> = (newValue: T) => void;
interface WritableComputedOptions<T, S = T> {
    get: ComputedGetter<T>;
    set: ComputedSetter<S>;
}
type ComputedTarget = Target & Record<any, any> & DebuggerOptions;
declare class ComputedRefImpl<T> implements ComputedTarget {
    private getter;
    private setter;
    readonly effect: Watcher;
    private _value;
    readonly [ReactiveFlags.IS_READONLY]: boolean;
    readonly [ReactiveFlags.IS_REF] = true;
    onTrack?: (event: DebuggerEvent) => void;
    onTrigger?: (event: DebuggerEvent) => void;
    constructor(getter: ComputedGetter<T>, setter: ComputedSetter<T> | void, vm?: ComponentInstance);
    get value(): T;
    set value(newValue: T);
    get dep(): Dep | void;
}
declare function computed<T>(getter: ComputedGetter<T>, debugOptions?: DebuggerOptions): ComputedRef<T>;
declare function computed<T, S = T>(options: WritableComputedOptions<T, S>, debugOptions?: DebuggerOptions): WritableComputedRef<T, S>;

type OnCleanup = (cleanupFn: () => void) => void;
type WatchEffect = (onCleanup: OnCleanup) => void;
type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T);
type WatchCallback<V = any, OV = any> = (value: V, oldValue: OV, onCleanup: OnCleanup) => any;
interface WatchOptionsBase extends DebuggerOptions {
    flush?: "pre" | "post" | "sync";
}
interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
    immediate?: Immediate;
    deep?: boolean;
    once?: boolean;
}
type MultiWatchSources = (WatchSource<unknown> | object)[];
type MapSources<T, Immediate> = {
    [K in keyof T]: T[K] extends WatchSource<infer V> ? Immediate extends true ? V | undefined : V : T[K] extends object ? Immediate extends true ? T[K] | undefined : T[K] : never;
};
type WatchStopHandle = () => void;
declare function traverse(val: any, seen: Set<any>): void;
declare function watch<T extends MultiWatchSources, Immediate extends Readonly<boolean> = false>(sources: [...T], cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>, options?: WatchOptions<Immediate>): WatchStopHandle;
declare function watch<T extends Readonly<MultiWatchSources>, Immediate extends Readonly<boolean> = false>(source: T, cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>, options?: WatchOptions<Immediate>): WatchStopHandle;
declare function watch<T, Immediate extends Readonly<boolean> = false>(source: WatchSource<T>, cb: WatchCallback<T, Immediate extends true ? T | undefined : T>, options?: WatchOptions<Immediate>): WatchStopHandle;
declare function watch<T extends object, Immediate extends Readonly<boolean> = false>(source: T, cb: WatchCallback<T, Immediate extends true ? T | undefined : T>, options?: WatchOptions<Immediate>): WatchStopHandle;
declare function watchEffect(effect: WatchEffect, options?: WatchOptionsBase): WatchStopHandle;
declare function watchPostEffect(effect: WatchEffect, options?: DebuggerOptions): WatchStopHandle;
/**
 * @example
 *
 *   watchSyncEffect(() => {
 *      console.log("This will run synchronously");
 *   },{
 *    onTrack(e) {},
 *    onTrigger(e) {},
 *   });
 *
 *   var stop = watchSyncEffect(() => {
 *      console.log("This will run synchronously");
 *   });
 *   stop()
*/
declare function watchSyncEffect(effect: WatchEffect, options?: DebuggerOptions): WatchStopHandle;
/**
 * Registers a cleanup callback on the current active effect. This
 * registered cleanup callback will be invoked right before the
 * associated effect re-runs.
 *
 * @param cleanupFn - The callback function to attach to the effect's cleanup.
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 * @param owner - The effect that this cleanup function should be attached to.
 * By default, the current active effect.
 */
declare function onWatcherCleanup(cleanupFn: () => void, failSilently?: boolean, owner?: Watcher | undefined): void;
declare function getCurrentWatcher(): Watcher | null;

declare class Observer<T> {
    readonly value: T;
    readonly shallow: boolean;
    readonly mock: boolean;
    vmCount: number;
    constructor(value: T, shallow?: boolean, mock?: boolean);
    readonly dep: Dep;
}

declare class EffectScope {
    private detached;
    private _active;
    private effects;
    cleanups: any[];
    private parent;
    private index;
    scopes?: any[];
    constructor(detached?: boolean);
    get active(): boolean;
    run(fn: () => void): void;
    on(): void;
    off(): void;
    stop(fromParent?: boolean): void;
}
/**
 * Returns the current active effect scope if there is one.
 */
declare function getCurrentScope(): EffectScope | null;
/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 */
declare function onScopeDispose(fn: () => void): void;

declare const vm: ComponentInstance;

declare const nextTick: typeof vm.$nextTick;

declare function onUpdated(fn: () => void): void;
declare function onBeforeUnmount(fn: () => void): void;
declare function onUnmounted(fn: () => void): void;
declare function onBeforeUpdate(fn: () => void): void;
declare function onMounted(fn: () => void): void;
declare function onBeforeMount(fn: () => void): void;
declare function onActivated(fn: () => void): void;
declare function onDeactivated(fn: () => void): void;
declare function onServerPrefetch(fn: () => void): void;
declare function onRenderTracked(fn: () => void): void;
declare function onRenderTriggered(fn: () => void): void;
type ErrorCapturedHook<TError = unknown> = (err: TError, instance: any, info: string) => boolean | void;
declare function onErrorCaptured<TError = Error>(hook: ErrorCapturedHook<TError>, target?: vue_types_vue.CombinedVueInstance<vue.default<Record<string, any>, Record<string, any>, never, never, (event: string, ...args: any[]) => vue.default>, object, object, object, Record<never, any>, {}, vue.ComponentOptionsMixin, vue.ComponentOptionsMixin, vue_types_v3_component_public_instance.OptionTypesType<{}, {}, {}, {}, {}, {}>> | null): void;

interface InjectionKey<T> extends Symbol {
}
declare function provide<T>(key: InjectionKey<T> | string | number, value: T): void;
declare function inject<T>(key: InjectionKey<T> | string): T | undefined;
declare function inject<T>(key: InjectionKey<T> | string, defaultValue: T, treatDefaultAsFactory?: false): T;
declare function inject<T>(key: InjectionKey<T> | string, defaultValue: T | (() => T), treatDefaultAsFactory: true): T;

declare function h(tag?: string | Component<any, any, any, any> | AsyncComponent<any, any, any, any> | (() => Component), children?: VNodeChildren): VNode;
declare function h(tag?: string | Component<any, any, any, any> | AsyncComponent<any, any, any, any> | (() => Component), data?: VNodeData, children?: VNodeChildren): VNode;

declare function getCurrentInstance(): {
    proxy: ComponentInstance;
} | null;

declare module "vue/types/vue" {
    interface Vue {
        _scope?: EffectScope;
    }
}
/**
 * Creates an effect scope object which can capture the reactive effects (i.e.
 * computed and watchers) created within it so that these effects can be
 * disposed together. For detailed use cases of this API, please consult its
 *
 * @param detached - Can be used to create a "detached" effect scope.
 */
declare const effectScope: () => EffectScope;
declare function effect(fn: () => any, scheduler?: (cb: Function) => void): void;

declare enum SetupFlag {
    SETUPCOMPONENTREF = "_setup",
    USERNATIVESETUP = "useNativeSetup"
}
interface SetupContext {
    attrs: Record<string, any>;
    slots: Record<string, (state?: any) => VNode$1[]>;
    listeners: Record<string, Function | Function[]>;
    emit: (event: string, ...args: any[]) => any;
    expose: (exposed: Record<string, any>) => void;
}
declare module "vue/types/vue" {
    interface Vue {
        setupContext?: SetupContext;
    }
}
declare function useSlots(): SetupContext["slots"];
declare function useAttrs(): SetupContext["attrs"];
declare function getContext(): SetupContext | undefined;
declare function useModel<T extends Record<any, any>, K extends keyof T, T2 = T[K]>(props: T, name: K, options?: Readonly<any>): Ref<unknown, unknown>;
declare function useCssVars(getter: (vm: Record<string, any>, setupProxy: Record<string, any>) => Record<string, string>): void;
declare function defineComponent(options: ComponentOptions<ComponentInstance> | Function): void;

type DefaultData<V> = object | ((this: V) => object);
type DefaultProps = Record<string, any>;
type DefaultMethods<V> = {
    [key: string]: (this: V, ...args: any[]) => any;
};
type DefaultComputed = {
    [key: string]: any;
};
declare global {
    namespace Vue {
        interface ComponentOptions<V extends typeof Vue, Data = DefaultData<V>, Methods = DefaultMethods<V>, Computed = DefaultComputed, PropsDef = PropsDefinition<DefaultProps>, Props = DefaultProps, RawBindings = {}, Mixin extends ComponentOptionsMixin = ComponentOptionsMixin, Extends extends ComponentOptionsMixin = ComponentOptionsMixin> {
            setup?: (this: void, props: Props, ctx: SetupContext) => Promise<RawBindings> | RawBindings | ((h: CreateElement) => VNode) | void;
            _setup?: (this: void, props: Props, ctx: SetupContext) => Promise<RawBindings> | RawBindings | ((h: CreateElement) => VNode) | void;
            [SetupFlag.USERNATIVESETUP]?: boolean;
        }
    }
}
declare class Vue2Hooks {
    constructor();
    static vue2OriginPrototype: typeof vue__default.prototype;
    static install(vue: typeof vue__default): void;
}

export { ComputedRefImpl, Dep, EffectScope, Observer, RawSymbol, ReactiveFlags, ShallowReactiveMarker, TrackOpTypes, TriggerOpTypes, Watcher, computed, customRef, Vue2Hooks as default, defineComponent, effect, effectScope, getContext, getCurrentInstance, getCurrentScope, getCurrentWatcher, h, inject, isProxy, isReactive, isReadonly, isRef, isShallow, markRaw, nextTick, onActivated, onBeforeMount, onBeforeUnmount, onBeforeUpdate, onDeactivated, onErrorCaptured, onMounted, onRenderTracked, onRenderTriggered, onScopeDispose, onServerPrefetch, onUnmounted, onUpdated, onWatcherCleanup, provide, proxyRefs, reactive, readonly, ref, shallowReactive, shallowReadonly, shallowRef, toRaw, toReactive, toReadonly, toRef, toRefs, toShallow, toValue, track, traverse, trigger, triggerRef, unref, useAttrs, useCssVars, useModel, useSlots, watch, watchEffect, watchPostEffect, watchSyncEffect };
export type { Builtin, ComputedGetter, ComputedRef, ComputedSetter, CustomRefFactory, DeepReadonly, DepTarget, ErrorCapturedHook, MaybeRef, MaybeRefOrGetter, OnCleanup, Ref, RefUnwrapBailTypes, ShallowRef, ShallowUnwrapRef, Target, ToRef, ToRefs, UnwrapNestedRefs, UnwrapRef, UnwrapRefSimple, WatchCallback, WatchEffect, WatchOptions, WatchSource, WatchStopHandle, WatcherOptions, WritableComputedOptions, WritableComputedRef };
