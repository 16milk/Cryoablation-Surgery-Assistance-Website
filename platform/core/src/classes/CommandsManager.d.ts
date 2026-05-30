import { Command, Commands } from '../types/Command';
export type RunInput = Command | Commands | Command[] | string | undefined;
/**
 * The definition of a command
 *
 * @typedef {Object} CommandDefinition
 * @property {Function} commandFn - Command to call
 * @property {Object} options - Object of params to pass action
 */
/**
 * The Commands Manager tracks named commands (or functions) that are scoped to
 * a context. When we attempt to run a command with a given name, we look for it
 * in our active contexts. If found, we run the command, passing in any application
 * or call specific data specified in the command's definition.
 *
 * NOTE: A more robust version of the CommandsManager lives in v1. If you're looking
 * to extend this class, please check it's source before adding new methods.
 */
export declare class CommandsManager {
    private contexts;
    private contextOrder;
    constructor(_options?: {});
    /**
     * Allows us to create commands "per context". An example would be the "Cornerstone"
     * context having a `SaveImage` command, and the "VTK" context having a `SaveImage`
     * command. The distinction of a context allows us to call the command in either
     * context, and have faith that the correct command will be run.
     *
     * @method
     * @param {string} contextName - Namespace for commands
     * @returns {undefined}
     */
    createContext(contextName: any, priority?: number): void;
    /**
     * Returns all command definitions for a given context
     *
     * @method
     * @param {string} contextName - Namespace for commands
     * @returns {Object} - the matched context
     */
    getContext(contextName: any): any;
    /**
     * Clears all registered commands for a given context.
     *
     * @param {string} contextName - Namespace for commands
     * @returns {undefined}
     */
    clearContext(contextName: any): void;
    /**
     * Register a new command with the command manager. Scoped to a context, and
     * with a definition to assist command callers w/ providing the necessary params
     *
     * @method
     * @param {string} contextName - Namespace for command; often scoped to the extension that added it
     * @param {string} commandName - Unique name identifying the command
     * @param {CommandDefinition} definition - {@link CommandDefinition}
     */
    registerCommand(contextName: any, commandName: any, definition: any): void;
    /**
     * Finds a command with the provided name if it exists in the specified context,
     * or a currently active context.
     *
     * @method
     * @param {String} commandName - Command to find
     * @param {String} [contextName] - Specific command to look in. Defaults to current activeContexts.
     *                 Also allows an array of contexts to look in.
     */
    getCommand: (commandName: string, contextName?: string | string[]) => any;
    /**
     *
     * @method
     * @param {String} commandName
     * @param {Object} [options={}] - Extra options to pass the command. Like a mousedown event
     * @param {String} [contextName]
     */
    runCommand(commandName: string, options?: {}, contextName?: string | string[]): any;
    static convertCommands(toRun: Command | Commands | Command[] | string | Function): any;
    private validate;
    /**
     * Run one or more commands with specified extra options.
     * Returns the result of the last command run.
     *
     * Example commands to run are:
     * * 'updateMeasurement'
     * * `{ commandName: 'displayWhatever'}`
     * * `['updateMeasurement', {commandName: 'displayWhatever'}]`
     * * `{ commands: 'updateMeasurement' }`
     * * `{ commands: ['updateMeasurement', {commandName: 'displayWhatever'}]}`
     *
     * Note how the various styles can be mixed, simplifying the declaration of
     * sets of commands.
     *
     * @param toRun - A specification of one or more commands,
     *  typically an object of { commandName, commandOptions, context }
     * or an array of such objects. It can also be a single commandName as string
     * if no options are needed.
     * @param options - to include in the commands run beyond
     *   the commandOptions specified in the base.
     */
    run(input: RunInput, options?: Record<string, unknown>): unknown;
    /** Like run, but await each command before continuing */
    runAsync(input: RunInput, options?: Record<string, unknown>): Promise<unknown>;
}
export default CommandsManager;
