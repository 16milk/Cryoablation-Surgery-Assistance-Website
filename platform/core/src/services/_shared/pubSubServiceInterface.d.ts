/**
 * Consumer must implement:
 * this.listeners = {}
 * this.EVENTS = { "EVENT_KEY": "EVENT_VALUE" }
 */
declare const _default: {
    subscribe: typeof subscribe;
    _broadcastEvent: typeof _broadcastEvent;
    _unsubscribe: typeof _unsubscribe;
    _isValidEvent: typeof _isValidEvent;
};
export default _default;
/**
 * Subscribe to updates.
 *
 * @param {string} eventName The name of the event
 * @param {Function} callback Events callback
 * @return {Object} Observable object with actions
 */
declare function subscribe(eventName: any, callback: any): {
    unsubscribe: () => any;
};
/**
 * Unsubscribe to measurement updates.
 *
 * @param {string} eventName The name of the event
 * @param {string} listenerId The listeners id
 * @return void
 */
declare function _unsubscribe(eventName: any, listenerId: any): void;
/**
 * Check if a given event is valid.
 *
 * @param {string} eventName The name of the event
 * @return {boolean} Event name validation
 */
declare function _isValidEvent(eventName: any): boolean;
/**
 * Broadcasts changes.
 *
 * @param {string} eventName - The event name
 * @param {func} callbackProps - Properties to pass callback
 * @return void
 */
declare function _broadcastEvent(eventName: any, callbackProps: any): void;
/** Export a PubSubService class to be used instead of the individual items */
export declare class PubSubService {
    EVENTS: Record<string, string>;
    subscribe: (eventName: string, callback: (data: unknown) => void) => {
        unsubscribe: () => void;
    };
    _broadcastEvent: (eventName: string, callbackProps: unknown) => void;
    _unsubscribe: (eventName: string, listenerId: string) => void;
    _isValidEvent: (eventName: string) => boolean;
    listeners: Record<string, Array<{
        id: string;
        callback: (data: unknown) => void;
    }> | undefined>;
    unsubscriptions: Array<() => void>;
    constructor(EVENTS: Record<string, string>);
    /**
     * Subscribe to updates with debouncing to limit callback execution frequency
     * @param eventName - The name of the event
     * @param callback - Events callback
     * @param wait - Debounce wait time in milliseconds
     * @param immediate - If true, trigger on the leading edge instead of trailing
     */
    subscribeDebounced(eventName: string, callback: (data: unknown) => void, wait?: number, immediate?: boolean): {
        unsubscribe: () => void;
    };
    reset(): void;
    /**
     * Creates an event that records whether or not someone
     * has consumed it.  Call eventData.consume() to consume the event.
     * Check eventData.isConsumed to see if it is consumed or not.
     * @param props - to include in the event
     */
    protected createConsumableEvent<T extends Record<string, unknown>>(props: T): T & {
        isConsumed: boolean;
        consume: () => void;
    };
}
