import MODULE_TYPES from './MODULE_TYPES';
import { PubSubService, ServiceProvidersManager } from '../services';
import { HotkeysManager, CommandsManager } from '../classes';
import type { DataSourceDefinition } from '../types';
import type AppTypes from '../types/AppTypes';
/**
 * This is the arguments given to create the extension.
 */
export interface ExtensionConstructor {
    servicesManager: AppTypes.ServicesManager;
    serviceProvidersManager: ServiceProvidersManager;
    commandsManager: CommandsManager;
    hotkeysManager: HotkeysManager;
    appConfig: AppTypes.Config;
}
/**
 * The configuration of an extension.
 * This uses type as the extension manager only knows that the configuration
 * is an object of some sort, and doesn't know anything else about it.
 */
export type ExtensionConfiguration = Record<string, unknown>;
/**
 * The parameters passed to the extension.
 */
export interface ExtensionParams extends ExtensionConstructor {
    extensionManager: ExtensionManager;
    servicesManager: AppTypes.ServicesManager;
    serviceProvidersManager: ServiceProvidersManager;
    configuration?: ExtensionConfiguration;
    peerImport: (moduleId: string) => Promise<any>;
}
/**
 * The type of an actual extension instance.
 * This is an interface as it declares possible calls, but extensions can
 * have more values than this.
 */
export interface Extension {
    id: string;
    preRegistration?: (p: ExtensionParams) => Promise<void> | void;
    getHangingProtocolModule?: (p: ExtensionParams) => unknown;
    getCommandsModule?: (p: ExtensionParams) => CommandsModule;
    getViewportModule?: (p: ExtensionParams) => unknown;
    getUtilityModule?: (p: ExtensionParams) => unknown;
    getCustomizationModule?: (p: ExtensionParams) => unknown;
    getSopClassHandlerModule?: (p: ExtensionParams) => unknown;
    getToolbarModule?: (p: ExtensionParams) => unknown;
    getPanelModule?: (p: ExtensionParams) => unknown;
    onModeEnter?: (p: AppTypes) => void;
    onModeExit?: (p: AppTypes) => void;
}
export type ExtensionRegister = {
    id: string;
    create: (p: ExtensionParams) => Extension;
};
export type CommandsModule = {
    actions: Record<string, unknown>;
    definitions: Record<string, unknown>;
    defaultContext?: string;
};
export default class ExtensionManager extends PubSubService {
    static readonly EVENTS: {
        ACTIVE_DATA_SOURCE_CHANGED: string;
    };
    static readonly MODULE_TYPES: typeof MODULE_TYPES;
    private _commandsManager;
    private _servicesManager;
    private _hotkeysManager;
    private _serviceProvidersManager;
    private modulesMap;
    private modules;
    private registeredExtensionIds;
    private moduleTypeNames;
    private _appConfig;
    private _extensionLifeCycleHooks;
    private dataSourceMap;
    private dataSourceDefs;
    private _activeDataSourceName;
    constructor({ commandsManager, servicesManager, serviceProvidersManager, hotkeysManager, appConfig, }: ExtensionConstructor);
    setActiveDataSource(dataSource: string): void;
    getRegisteredExtensionIds(): string[];
    private getUniqueServicesList;
    /**
     * Calls all the services and extension on mode enters.
     * The service onModeEnter is called first
     * Then registered extensions onModeEnter is called
     * This is supposed to setup the extension for a standard entry.
     */
    onModeEnter(): void;
    onModeExit(): void;
    /**
     * An array of extensions, or an array of arrays that contains extension
     * configuration pairs.
     *
     * @param {Object[]} extensions - Array of extensions
     */
    registerExtensions: (extensions: (ExtensionRegister | [ExtensionRegister, ExtensionConfiguration])[], dataSources?: unknown[]) => Promise<void>;
    /**
     *
     * TODO: Id Management: SopClassHandlers currently refer to viewport module by id; setting the extension id as viewport module id is a workaround for now
     * @param {Object} extension
     * @param {Object} configuration
     */
    registerExtension: (extension: ExtensionRegister, configuration?: {}, dataSources?: any[]) => Promise<void>;
    /**
     * Retrieves the module entry associated with the given string entry
     * @param stringEntry - The string entry to retrieve the module entry for which is
     * in the format of `${extensionId}.${moduleType}.${moduleName}`
     * @returns The module entry associated with the given string entry.
     */
    getModuleEntry: (stringEntry: any) => unknown;
    /**
     * Retrieves all modules of a given type for all registered extensions.
     *
     * @param moduleType - The type of modules to retrieve.
     * @returns An array of modules of the specified type.
     */
    getModulesByType: (moduleType: string) => any[];
    getDataSources: (dataSourceName: any) => any;
    getDataSourceInstance: (dataSourceName: any) => any;
    getActiveDataSource: () => any;
    getActiveDataSourceOrNull: () => any;
    /**
     * Gets the data source definition for the given data source name.
     * If no data source name is provided, the active data source definition is
     * returned.
     * @param dataSourceName the data source name
     * @returns the data source definition
     */
    getDataSourceDefinition: (dataSourceName: any) => any;
    /**
     * Gets the data source definition for the active data source.
     */
    getActiveDataSourceDefinition: () => any;
    /**
     * Gets a formatted list of data sources suitable for UI display/selection.
     * Only returns data sources that support STOW or have a WADO root.
     * @returns Array of data source options with value, label, and placeholder
     */
    getDataSourcesForUI: () => {
        value: string;
        label: string;
        placeHolder: string;
    }[];
    /**
     * @private
     * @param {string} moduleType
     * @param {Object} extension
     * @param {string} extensionId - Used for logging warnings
     */
    _getExtensionModule: (moduleType: any, extension: any, extensionId: any, configuration: any) => any;
    _initHangingProtocolsModule: (extensionModule: any, extensionId: any) => void;
    _initPanelModule: (extensionModule: any, extensionId: any) => void;
    _initToolbarModule: (extensionModule: any, extensionId: any) => void;
    /**
     * Processes an extension module.
     * @param extensionModule - The extension module to process.
     * @param extensionId - The ID of the extension.
     * @param moduleType - The type of the module.
     */
    private processExtensionModule;
    /**
     * Adds the given data source and optionally sets it as the active data source.
     * The method does this by first creating the data source.
     * @param dataSourceDef the data source definition to be added
     * @param activate flag to indicate if the added data source should be set to the active data source
     */
    addDataSource(dataSourceDef: DataSourceDefinition, options?: {
        activate: boolean;
    }): void;
    /**
     * Updates the configuration of the given data source name. It first creates a new data source with
     * the existing definition and the new configuration passed in.
     * @param dataSourceName the name of the data source to update
     * @param dataSourceConfiguration the new configuration to update the data source with
     */
    updateDataSourceConfiguration(dataSourceName: string, dataSourceConfiguration: any): void;
    /**
     * Creates a data source instance from the given definition. The definition is
     * added to dataSourceDefs and the created instance is added to dataSourceMap.
     * @param dataSourceDef
     * @returns
     */
    _createDataSourceInstance(dataSourceDef: DataSourceDefinition): void;
    _initDataSourcesModule(extensionModule: any, extensionId: any, dataSources?: Array<DataSourceDefinition>): void;
    /**
     *
     * @private
     * @param {Object[]} commandDefinitions
     */
    _initCommandsModule: (extensionModule: any) => void;
    get appConfig(): any;
    get activeDataSourceName(): string;
}
