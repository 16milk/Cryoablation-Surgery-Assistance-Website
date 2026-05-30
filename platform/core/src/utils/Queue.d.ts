export default class Queue {
    constructor(limit: any);
    limit: any;
    size: number;
    awaiting: any;
    /**
     * Creates a new "proxy" function associated with the current execution queue
     * instance. When the returned function is invoked, the queue limit is checked
     * to make sure the limit of scheduled tasks is respected (throwing an
     * exception when the limit has been reached and before calling the original
     * function). The original function is only invoked after all the previously
     * scheduled tasks have finished executing (their returned promises have
     * resolved/rejected);
     *
     * @param {function} task The function whose execution will be associated
     * with the current Queue instance;
     * @returns {function} The "proxy" function bound to the current Queue
     * instance;
     */
    bind(task: Function): Function;
    bindSafe(task: any, onError: any): (...args: any[]) => Promise<any>;
}
