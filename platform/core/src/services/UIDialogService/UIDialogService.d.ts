import type { ManagedDialogProps } from 'platform/ui-next/src/contextProviders/ManagedDialog';
type DialogOptions = ManagedDialogProps;
declare class UIDialogService {
    static REGISTRATION: {
        name: string;
        altName: string;
        create: () => UIDialogService;
    };
    readonly name = "uiDialogService";
    /**
     * Show a new UI dialog
     *
     * @param {DialogOptions} options - The dialog options
     * @returns {string} The dialog id
     */
    show(options: DialogOptions): string;
    /**
     * Hide a specific dialog by id
     *
     * @param {string} id - The dialog id to hide
     */
    hide(id: string): void;
    /**
     * Hide all currently shown dialogs
     */
    hideAll(): void;
    /**
     * Check if there are any dialogs currently shown
     *
     * @returns {boolean} True if no dialogs are shown
     */
    isEmpty(): boolean;
    /**
     * Update the position of a specific dialog by id
     *
     * @param {string} id - The dialog id to update
     * @param {{ x: number; y: number }} position - The new position
     */
    updatePosition(id: string, position: {
        x: number;
        y: number;
    }): void;
    /**
     * This provides flexibility in customizing the Modal's default component
     *
     * @returns {React.Component}
     */
    getCustomComponent(): any;
    /**
     * Set the service implementation
     */
    setServiceImplementation({ show, hide, hideAll, isEmpty, updatePosition, customComponent, }: any): void;
}
export default UIDialogService;
