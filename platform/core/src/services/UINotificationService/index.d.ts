type ToastType = 'success' | 'error' | 'info' | 'warning' | 'loading';
declare class UINotificationService {
    static REGISTRATION: {
        name: string;
        altName: string;
        create: () => UINotificationService;
    };
    /**
     * This provides flexibility in customizing the Notification default component
     *
     * @returns {React.Component}
     */
    getCustomComponent(): any;
    /**
     *
     *
     * @param {*} {
     *   hide: hideImplementation,
     *   show: showImplementation,
     *   component: componentImplementation
     * }
     */
    setServiceImplementation({ hide: hideImplementation, show: showImplementation, customComponent: customComponentImplementation, }: {
        hide: any;
        show: any;
        customComponent: any;
    }): void;
    /**
     * Hides/dismisses the notification, if currently shown
     *
     * @param {number} id - id of the notification to hide/dismiss
     * @returns undefined
     */
    hide(id: string): void;
    /**
     * Create and show a new UI notification; returns the
     * ID of the created notification. Can also handle promises for loading states.
     *
     * @param {object} notification - The notification object
     * @param {string} notification.title - The title of the notification
     * @param {string | function} notification.message - The message content of the notification or a function that returns a message
     * @param {number} [notification.duration=5000] - The duration to show the notification (in milliseconds)
     * @param {'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center'} [notification.position='bottom-right'] - The position of the notification
     * @param {ToastType} [notification.type='info'] - The type of the notification
     * @param {boolean} [notification.autoClose=true] - Whether the notification should auto-close
     * @param {Promise} [notification.promise] - A promise to track for loading, success, and error states
     * @param {object} [notification.promiseMessages] - Custom messages for promise states
     * @param {string} [notification.promiseMessages.loading] - Message to show while promise is pending
     * @param {string | function} [notification.promiseMessages.success] - Message to show when promise resolves
     * @param {string | function} [notification.promiseMessages.error] - Message to show when promise rejects
     * @param {object} [notification.action] - Action button configuration
     * @param {string} notification.action.label - The label for the action button
     * @param {function} notification.action.onClick - The function to call when the action button is clicked
     * @returns {string} id - The ID of the created notification
     */
    show({ title, message, duration, position, type, autoClose, promise, promiseMessages, id, allowDuplicates, deduplicationInterval, action, }: {
        title: string;
        message: string | ((data?: any) => string);
        duration?: number;
        position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
        type?: ToastType;
        autoClose?: boolean;
        promise?: Promise<any>;
        promiseMessages?: {
            loading?: string;
            success?: string | ((data: any) => string);
            error?: string | ((error: any) => string);
        };
        id?: string;
        allowDuplicates?: boolean;
        deduplicationInterval?: number;
        action?: {
            label: string;
            onClick: () => void;
        };
    }): string;
}
export default UINotificationService;
