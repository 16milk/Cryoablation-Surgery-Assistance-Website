import { PubSubService } from '../_shared/pubSubServiceInterface';
import type { Customization } from './types';
import type { CommandsManager } from '../../classes';
import type { ExtensionManager } from '../../extensions';
/**
 * Enum representing the different scopes of customizations available in the system.
 */
export declare enum CustomizationScope {
    /**
     * Global customizations that override both mode and default customizations.
     * These are applied universally across the application.
     */
    Global = "global",
    /**
     * Mode-specific customizations that are only active during a particular mode.
     * These are cleared and reset when switching between modes.
     */
    Mode = "mode",
    /**
     * Default customizations that serve as fallbacks when no global or mode-specific
     * customizations are defined. These can only be defined once.
     */
    Default = "default"
}
/**
 * The CustomizationService allows for retrieving of custom components
 * and configuration for mode and global values.
 * The intent of the items is to provide a react component.  This can be
 * done by straight out providing an entire react component or else can be
 * done by configuring a react component, or configuring a part of a react
 * component.  These are intended to be fairly indistinguishable in use of
 * it, although the internals of how that is implemented may need to know
 * about the customization service.
 *
 * A customization value can be:
 *   1. React function, taking (React, props) and returning a rendered component
 *      For example, createLogoComponentFn renders a component logo for display
 *   2. Custom UI component configuration, as defined by the component which uses it.
 *      For example, context menus define a complex structure allowing site-determined
 *      context menus to be set.
 *   3. A string name, being the extension id for retrieving one of the above.
 *
 * The default values for the extension come from the app_config value 'whiteLabeling',
 * The whiteLabelling can have lists of extensions to load for the default global and
 * mode extensions.  These are:
 *    'globalExtensions' which is a list of extension id's to load for global values
 *    'modeExtensions'   which is a list of extension id's to load for mode values
 * They default to the list ['*'] if not otherwise provided, which means to check
 * every module for the given id and to load it/add it to the extensions.
 */
export default class CustomizationService extends PubSubService {
    static EVENTS: {
        MODE_CUSTOMIZATION_MODIFIED: string;
        GLOBAL_CUSTOMIZATION_MODIFIED: string;
        DEFAULT_CUSTOMIZATION_MODIFIED: string;
    };
    Scope: typeof CustomizationScope;
    static REGISTRATION: {
        name: string;
        create: ({ configuration, commandsManager }: {
            configuration: any;
            commandsManager: any;
        }) => CustomizationService;
    };
    commandsManager: CommandsManager;
    extensionManager: ExtensionManager;
    /**
     * A collection of global customizations that act as a priority layer.
     * These customizations are applied universally, overriding both mode-specific
     * and default customizations. Ideal for system-wide changes.
     */
    private globalCustomizations;
    /**
     * A collection of mode-specific customizations. These allow modes to define
     * their own behavior without impacting other modes. These customizations
     * are cleared and redefined whenever a mode changes, ensuring isolation
     * between modes. Read more about modes in the modes documentation.
     */
    private modeCustomizations;
    /**
     * A collection of default customizations used as fallbacks. These serve as
     * the base configuration and are registered at setup. Default customizations
     * provide baseline values that can be overridden by mode or global customizations.
     * Use these for cases where default values are necessary for predictable behavior.
     */
    private defaultCustomizations;
    /**
     * Has the transformed/final customization value.  This avoids needing to
     * transform every time a customization is requested.
     */
    private transformedCustomizations;
    private configuration;
    constructor({ configuration, commandsManager }: {
        configuration: any;
        commandsManager: any;
    });
    init(extensionManager: ExtensionManager): void;
    onModeEnter(): void;
    onModeExit(): void;
    private clearTransformedCustomizations;
    /**
     * Unified getter for customizations.
     *
     * @param customizationId - The ID of the customization to retrieve.
     * @param scope - (Optional) The scope to retrieve from: 'global', 'mode', or 'default'.
     *                 If not specified, it retrieves based on priority: global > mode > default.
     * @returns The requested customization, or undefined if not found
     */
    getCustomization(customizationId: string): Customization | undefined;
    /**
     * Takes an object with multiple properties, each property containing
     * immutability-helper commands, and applies them one by one.
     *
     * Example:
     *   customizationService.setCustomizations({
     *     showAddSegment: { $set: false },
     *     NumbersList: { $push: [99] },
     *   }, CustomizationScope.Mode)
     *
     * Or you can simply apply a list of strings that are customization module items in the
     * extension.
     *
     * Example:
     *   customizationService.setCustomizations(['@ohif/extension-cornerstone-dicom-seg.customizationModule.dicom-seg-sorts'], CustomizationScope.Mode)
     */
    setCustomizations(customizations: string[] | Record<string, Customization>, scope?: CustomizationScope): void;
    /**
     * @deprecated Use setCustomizations instead
     */
    setCustomization(customizationId: string, customization: Customization | string, scope?: CustomizationScope): void;
    /**
     * Internal method to set a single customization
     */
    private _setCustomization;
    /**
     * Gets all customizations for a given scope.
     *
     * @param scope - The scope to retrieve customizations from: 'global', 'mode', or 'default'
     * @returns A Map containing all customizations for the specified scope
     */
    getCustomizations(scope: CustomizationScope): Map<string, Customization>;
    /**
     *  Returns true if there is a mode customization.  Doesn't include defaults, but
     * does return global overrides.
     */
    hasCustomization(customizationId: string): boolean;
    /**
     * Applies any inheritance due to UI Type customization.
     * This will look for inheritsFrom in the customization object
     * and if that is found, will assign all iterable values from that
     * type into the new type, allowing default behavior to be configured.
     */
    transform(customization: Customization): Customization;
    /**
     *
     * Sets a mode-specific customization.
     *
     * This method allows you to define or update a customization that applies only to the current mode.
     * Mode customizations are temporary and isolated, reset whenever a mode changes.
     *
     * @param customizationId - The unique identifier for the customization.
     * @param customization - The customization object containing the desired settings.
     */
    private setModeCustomization;
    private setGlobalCustomization;
    private setDefaultCustomization;
    private _findExtensionValue;
    /**
     * Registers a custom command to be used in customization updates.
     * @param commandName - The name of the command (without the $ prefix)
     *   it will be prefixed with $
     * @param handler - Function that handles the command it receives the value and the original value
     */
    registerCustomUpdateCommand(commandName: string, handler: (value: Customization, original: Customization) => Customization): void;
    /**
     * Uses immutability-helper to apply the user's commands (e.g. $set, $push, $apply, etc.)
     * Takes into account the 'mergeType' if it's explicitly 'Replace'; otherwise does a normal update.
     */
    private _update;
    private _cloneIfNeeded;
    _addReference(value?: any, type?: CustomizationScope): void;
    /**
     * Customizations can be specified as an array of strings or customizations,
     * or as an object whose key is the reference id, and the value is the string
     * or customization.
     */
    addReferences(references?: any, type?: CustomizationScope): void;
}
