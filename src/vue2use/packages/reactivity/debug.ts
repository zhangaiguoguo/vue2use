import { TrackOpTypes, TriggerOpTypes } from './operations'

export interface DebuggerOptions {
    onTrack?: (event: DebuggerEvent) => void
    onTrigger?: (event: DebuggerEvent) => void
}

export type DebuggerEvent = {
    effect: any
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
    target: object
    type: TrackOpTypes | TriggerOpTypes
    key?: any
    newValue?: any
    oldValue?: any
}