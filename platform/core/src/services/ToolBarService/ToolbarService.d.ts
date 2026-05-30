import { CommandsManager } from '../../classes';
import { ExtensionManager } from '../../extensions';
import { PubSubService } from '../_shared/pubSubServiceInterface';
import type { RunCommand } from '../../types/Command';
import { Button, ButtonOptions, ButtonProps, EvaluateFunction, EvaluatePublic } from './types';
/**
 * Predefined toolbar sections used throughout the application
 */
export declare const TOOLBAR_SECTIONS: {
    /**
     * Main toolbar
     */
    primary: string;
    /**
     * Secondary toolbar
     */
    secondary: string;
    /**
     * Viewport action menu sections
     */
    viewportActionMenu: {
        topLeft: string;
        topRight: string;
        bottomLeft: string;
        bottomRight: string;
        topMiddle: string;
        bottomMiddle: string;
        leftMiddle: string;
        rightMiddle: string;
    };
    labelMapSegmentationToolbox: string;
    contourSegmentationToolbox: string;
    labelMapSegmentationUtilities: string;
    contourSegmentationUtilities: string;
    dynamicToolbox: string;
    roiThresholdToolbox: string;
};
export declare enum ButtonLocation {
    TopLeft = 0,
    TopMiddle = 1,
    TopRight = 2,
    LeftMiddle = 3,
    RightMiddle = 4,
    BottomLeft = 5,
    BottomMiddle = 6,
    BottomRight = 7
}
export default class ToolbarService extends PubSubService {
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ commandsManager, extensionManager, servicesManager }: {
            commandsManager: any;
            extensionManager: any;
            servicesManager: any;
        }) => ToolbarService;
    };
    static TOOLBAR_SECTIONS: {
        /**
         * Main toolbar
         */
        primary: string;
        /**
         * Secondary toolbar
         */
        secondary: string;
        /**
         * Viewport action menu sections
         */
        viewportActionMenu: {
            topLeft: string;
            topRight: string;
            bottomLeft: string;
            bottomRight: string;
            topMiddle: string;
            bottomMiddle: string;
            leftMiddle: string;
            rightMiddle: string;
        };
        labelMapSegmentationToolbox: string;
        contourSegmentationToolbox: string;
        labelMapSegmentationUtilities: string;
        contourSegmentationUtilities: string;
        dynamicToolbox: string;
        roiThresholdToolbox: string;
    };
    /**
     * Access to predefined toolbar sections for autocomplete support
     */
    get sections(): {
        /**
         * Main toolbar
         */
        primary: string;
        /**
         * Secondary toolbar
         */
        secondary: string;
        /**
         * Viewport action menu sections
         */
        viewportActionMenu: {
            topLeft: string;
            topRight: string;
            bottomLeft: string;
            bottomRight: string;
            topMiddle: string;
            bottomMiddle: string;
            leftMiddle: string;
            rightMiddle: string;
        };
        labelMapSegmentationToolbox: string;
        contourSegmentationToolbox: string;
        labelMapSegmentationUtilities: string;
        contourSegmentationUtilities: string;
        dynamicToolbox: string;
        roiThresholdToolbox: string;
    };
    static createButton(options: {
        id: string;
        label: string;
        commands: RunCommand;
        icon?: string;
        tooltip?: string;
        evaluate?: EvaluatePublic;
        listeners?: Record<string, RunCommand>;
    }): ButtonProps;
    state: {
        buttons: Record<string, Button>;
        buttonSections: Record<string, string[]>;
    };
    _commandsManager: CommandsManager;
    _extensionManager: ExtensionManager;
    _servicesManager: AppTypes.ServicesManager;
    _evaluateFunction: Record<string, EvaluateFunction>;
    _serviceSubscriptions: any[];
    constructor(commandsManager: CommandsManager, extensionManager: ExtensionManager, servicesManager: AppTypes.ServicesManager);
    reset(): void;
    onModeEnter(): void;
    /**
     * Registers an evaluate function with the specified name.
     *
     * @param name - The name of the evaluate function.
     * @param handler - The evaluate function handler.
     */
    registerEvaluateFunction(name: string, handler: EvaluateFunction): void;
    /**
     * Registers a service and its event to listen for updates and refreshes the toolbar state when the event is triggered.
     * @param service - The service to register.
     * @param event - The event to listen for.
     */
    registerEventForToolbarUpdate(service: any, events: any): void;
    /**
     * Removes buttons from the toolbar.
     * @param buttonId - The button to be removed.
     */
    removeButton(buttonId: string): void;
    /**
     * Adds buttons to the toolbar.
     * @param buttons - The buttons to be added.
     * @param replace - Flag indicating if any existing button with the same id as one being added should be replaced
     */
    register(buttons: Button[], replace?: boolean): void;
    /**
     *
     * @param {*} interaction - can be undefined to run nothing
     * @param {*} options is an optional set of extra commandOptions
     *    used for calling the specified interaction.  That is, the command is
     *    called with {...commandOptions,...options}
     */
    recordInteraction(interaction: any, options?: {
        refreshProps: Record<string, unknown>;
        [key: string]: unknown;
    }): void;
    /**
     * Consolidates the state of the toolbar after an interaction, it accepts
     * props that get passed to the buttons
     *
     * @param refreshProps - The props that buttons need to get evaluated, they can be
     * { viewportId, toolGroup} for cornerstoneTools.
     *
     * Todo: right now refreshToolbarState should be used in the context where
     * we have access to the toolGroup and viewportId, but we should be able to
     * pass the props to the toolbar service and it should be able to decide
     * which buttons to evaluate based on the props
     */
    refreshToolbarState(refreshProps: any): {
        buttons: Record<string, Button>;
        buttonSections: Record<string, string[]>;
    };
    /**
     * Sets the buttons for the toolbar, don't use this method to record an
     * interaction, since it doesn't update the state of the buttons, use
     * this if you know the buttons you want to set and you want to set them
     * all at once.
     * @param buttons - The buttons to set.
     */
    setButtons(buttons: any): void;
    /**
     * Retrieves a button by its ID.
     * @param id - The ID of the button to retrieve.
     * @returns The button with the specified ID.
     */
    getButton(id: string): Button;
    /**
     * @deprecated Use register() instead. This method will be removed in a future version.
     * Adds buttons to the toolbar.
     * @param buttons - The buttons to be added.
     * @param replace - Flag indicating if any existing button with the same id as one being added should be replaced
     */
    addButtons(buttons: Button[], replace?: boolean): void;
    /**
     * Retrieves the buttons from the toolbar service.
     * @returns An array of buttons.
     */
    getButtons(): Record<string, Button>;
    /**
     * Retrieves the button properties for the specified button ID.
     * It prioritizes nested buttons over regular buttons if the ID is found
     * in both.
     *
     * @param id - The ID of the button.
     * @returns The button properties.
     */
    getButtonProps(id: string): ButtonProps;
    _getButtonUITypes(): any;
    /**
     * Creates a button section with the specified key and buttons.
     * Buttons already in the section (i.e. with the same ids) will NOT be added twice.
     * @param {string} key - The key of the button section.
     * @param {Array} buttons - The buttons to be added to the section.
     */
    updateSection(key: any, buttons: any): void;
    /**
     * @deprecated Use updateSection() instead. This method will be removed in a future version.
     * Creates a button section with the specified key and buttons.
     * @param {string} key - The key of the button section.
     * @param {Array} buttons - The buttons to be added to the section.
     */
    createButtonSection(key: any, buttons: any): void;
    /**
     * Retrieves the button section with the specified sectionId.
     *
     * @param sectionId - The ID of the button section to retrieve.
     * @param props - Optional additional properties for mapping the button to display.
     * @returns An array of buttons in the specified section, mapped to their display representation.
     */
    getButtonSection(sectionId: string, props?: Record<string, unknown>): {
        id: string;
        Component: import("react").ComponentType<any>;
        componentProps: {
            id: string;
        } & ButtonProps & Record<string, unknown>;
    }[];
    getButtonPropsInButtonSection(sectionId: string): ButtonProps[];
    /**
     * Retrieves the tool name for a given button.
     * @param button - The button object.
     * @returns The tool name associated with the button.
     */
    getToolNameForButton(button: any): any;
    /**
     *
     * @param {*} btn
     * @param {*} btnSection
     * @param {*} metadata
     * @param {*} props - Props set by the Viewer layer
     */
    _mapButtonToDisplay(btn: Button, props: Record<string, unknown>): {
        id: string;
        Component: import("react").ComponentType<any>;
        componentProps: {
            id: string;
        } & ButtonProps & Record<string, unknown>;
    };
    handleEvaluateNested: (props: any) => void;
    handleEvaluate: (props: any) => void;
    getButtonComponentForUIType(uiType: string): any;
    clearButtonSection(buttonSection: string): void;
    /**
     * Checks if a button exists in any toolbar section.
     *
     * @param buttonId - The button ID to check for
     * @returns True if the button exists in any section, false otherwise
     */
    isInAnySection(buttonId: string): boolean;
    /**
     * Returns the alignment and side for a specific viewport corner location.
     * Used for menu positioning based on the corner location.
     *
     * @param location - The viewport corner location
     * @returns An object with align and side properties
     */
    getAlignAndSide(location: ButtonLocation | string): {
        align: 'start' | 'end' | 'center';
        side: 'top' | 'bottom' | 'left' | 'right';
    };
    /**
     * Retrieves an option by its ID from a button's options array.
     * @param button - The button object.
     * @param optionId - The ID of the option to retrieve.
     * @returns The option with the specified ID.
     */
    getOptionById(button: Button, optionId: string): ButtonOptions;
}
