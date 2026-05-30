/**
 * Hook that provides a runCommand function for executing commands
 * @returns A memoized runCommand function
 */
export declare function useRunCommand(): (commandName: string, commandOptions?: Record<string, unknown>) => any;
