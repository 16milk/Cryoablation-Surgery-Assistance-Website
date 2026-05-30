import CommandsManager from '../classes/CommandsManager';
export default class ServicesManager {
    services: AppTypes.Services;
    registeredServiceNames: string[];
    private _commandsManager;
    private _extensionManager;
    constructor(commandsManager: CommandsManager);
    setExtensionManager(extensionManager: any): void;
    /**
     * Registers a new service.
     *
     * @param {Object} service
     * @param {Object} configuration
     */
    registerService(service: any, configuration?: {}): void;
    /**
     * An array of services, or an array of arrays that contains service
     * configuration pairs.
     *
     * @param {Object[]} services - Array of services
     */
    registerServices(services: any): void;
}
