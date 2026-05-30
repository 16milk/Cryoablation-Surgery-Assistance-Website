/**
 * Migrates old hotkey definitions from localStorage to the new format
 * Old format: 'hotkey-definitions' containing full hotkey definitions array
 * New format: 'user-preferred-keys' containing hashed command keys with their key bindings
 *
 * @private
 */
declare function migrateOldHotkeyDefinitions({ generateHash, }: {
    generateHash: (definition: Record<string, unknown>) => string;
}): void;
export default migrateOldHotkeyDefinitions;
