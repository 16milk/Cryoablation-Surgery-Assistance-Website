declare class UIModalService {
    static REGISTRATION: {
        name: string;
        altName: string;
        create: () => UIModalService;
    };
    readonly name = "uiModalService";
    /**
     * Show a new UI modal;
     *
     * @param {ModalProps} props { content, contentProps, shouldCloseOnEsc, isOpen, closeButton, title, customClassName }
     */
    show({ content, contentProps, title, className, shouldCloseOnEsc, shouldCloseOnOverlayClick, containerClassName, }: {
        content?: any;
        contentProps?: any;
        title?: any;
        className?: any;
        shouldCloseOnEsc?: boolean;
        shouldCloseOnOverlayClick?: boolean;
        containerClassName?: any;
    }): void;
    /**
     * Hides/dismisses the modal, if currently shown
     *
     * @returns void
     */
    hide(): void;
    /**
     * This provides flexibility in customizing the Modal's default component
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
     * }
     */
    setServiceImplementation({ hide: hideImplementation, show: showImplementation, customComponent: customComponentImplementation, }: {
        hide: any;
        show: any;
        customComponent: any;
    }): void;
}
export default UIModalService;
