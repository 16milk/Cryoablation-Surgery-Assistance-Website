import Hotkey from './Hotkey';
/**
 *
 *
 * @typedef {Object} HotkeyDefinition
 * @property {String} commandName - Command to call
 * @property {Object} commandOptions - Command options
 * @property {String} label - Display name for hotkey
 * @property {String[]} keys - Keys to bind; Follows Mousetrap.js binding syntax
 */
export declare class HotkeysManager {
    private _servicesManager;
    private _commandsManager;
    private isEnabled;
    hotkeyDefinitions: Record<string, any>;
    hotkeyDefaults: any[];
    static EVENTS: Record<string, string>;
    EVENTS: Record<string, string>;
    listeners: Record<string, Array<{
        id: string;
        callback: (data: unknown) => void;
    }> | undefined>;
    subscribe: (eventName: string, callback: (data: unknown) => void) => {
        unsubscribe: () => void;
    };
    _broadcastEvent: (eventName: string, callbackProps: unknown) => void;
    _unsubscribe: (eventName: string, listenerId: string) => void;
    _isValidEvent: (eventName: string) => boolean;
    constructor(commandsManager: AppTypes.CommandsManager, servicesManager: AppTypes.ServicesManager);
    /**
     * Exposes Mousetrap.js's `.record` method, added by the record plugin.
     *
     * @param {*} event
     */
    record(event: any): any;
    cancel(): void;
    /**
     * Disables all hotkeys. Hotkeys added while disabled will not listen for
     * input.
     */
    disable(): void;
    /**
     * Enables all hotkeys.
     */
    enable(): void;
    /**
     * Uses most recent
     *
     * @returns {undefined}
     */
    restoreDefaultBindings(): void;
    /**
     *
     */
    destroy(): void;
    /**
     * Registers a list of hotkey definitions.
     *
     * @param {HotkeyDefinition[] | Object} [hotkeyDefinitions=[]] Contains hotkeys definitions
     */
    setHotkeys(hotkeyDefinitions?: any[]): void;
    generateHash(definition: any): any;
    /**
     * Set default hotkey bindings. These
     * values are used in `this.restoreDefaultBindings`.
     *
     * @param {HotkeyDefinition[] | Object} [hotkeyDefinitions=[]] Contains hotkeys definitions
     */
    setDefaultHotKeys(hotkeyDefinitions?: any[]): void;
    /**
     * Take hotkey definitions that can be an array or object and make sure that it
     * returns an array of hotkeys
     *
     * @param {HotkeyDefinition[] | Object} [hotkeyDefinitions=[]] Contains hotkeys definitions
     */
    getValidDefinitions(hotkeyDefinitions: any): any[];
    /**
     * Take hotkey definitions that can be an array and make sure that it
     * returns an object of hotkeys definitions
     *
     * @param {HotkeyDefinition[]} [hotkeyDefinitions=[]] Contains hotkeys definitions
     * @returns {Object}
     */
    getValidHotkeyDefinitions(hotkeyDefinitions: any): {};
    /**
     * It parses given object containing hotkeyDefinition to array like.
     * Each property of given object will be mapped to an object of an array. And its property name will be the value of a property named as commandName
     *
     * @param {HotkeyDefinition[] | Object} [hotkeyDefinitions={}] Contains hotkeys definitions
     * @returns {HotkeyDefinition[]}
     */
    _parseToArrayLike(hotkeyDefinitionsObj?: {}): any[];
    /**
     * Return HotkeyDefinition object like based on given property name and property value
     * @param {string} propertyName property name of hotkey definition object
     * @param {object} propertyValue property value of hotkey definition object
     */
    _parseToHotKeyObj(propertyName: any, propertyValue: any): any;
    /**
     * (Unbinds and) binds the specified command to one or more key combinations.
     * When the hotkey combination is triggered, the command name and active contexts
     * are used to locate and execute the appropriate command.
     *
     * @param hotkey - The hotkey definition object.
     * @throws {Error} Throws an error if no commandName is provided.
     */
    registerHotkeys({ commandName, commandOptions, context, keys, label, isEditable, }: Hotkey): void;
    /**
     * Binds one or more set of hotkey combinations for a given command
     *
     * @private
     * @param {string} commandName - The name of the command to trigger when hotkeys are used
     * @param {string[]} keys - One or more key combinations that should trigger command
     * @returns {undefined}
     */
    _bindHotkeys(commandName: any, commandOptions: {}, context: any, keys: any): void;
    /**
     * unbinds one or more set of hotkey combinations for a given command
     *
     * @private
     * @param {string} commandName - The name of the previously bound command
     * @param {string[]} keys - One or more sets of previously bound keys
     * @returns {undefined}
     */
    _unbindHotkeys(commandName: any, keys: any): void;
}
export default HotkeysManager;
