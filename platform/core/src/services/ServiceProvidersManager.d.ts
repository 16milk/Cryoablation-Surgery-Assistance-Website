/**
 * The ServiceProvidersManager allows for a React context provider class to be registered
 * for a particular service. This allows for extensions to register services
 * with context providers and the providers will be instantiated and added to the
 * DOM dynamically.
 */
export default class ServiceProvidersManager {
    providers: {};
    constructor();
    registerProvider(serviceName: any, provider: any): void;
}
