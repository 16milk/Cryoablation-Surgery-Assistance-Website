import { ActivatePanelTriggers } from '../../types';
import { Subscription } from '../../types/IPubSub';
import { PubSubService } from '../_shared/pubSubServiceInterface';
import { ExtensionManager } from '../../extensions';
export declare const EVENTS: {
    PANELS_CHANGED: string;
    ACTIVATE_PANEL: string;
};
type PanelData = {
    id: string;
    iconName: string;
    iconLabel: string;
    label: string;
    name: string;
    content: unknown;
};
export declare enum PanelPosition {
    Left = "left",
    Right = "right",
    Bottom = "bottom"
}
export default class PanelService extends PubSubService {
    private _extensionManager;
    static REGISTRATION: {
        name: string;
        create: ({ extensionManager }: {
            extensionManager: any;
        }) => PanelService;
    };
    private _panelsGroups;
    constructor(extensionManager: ExtensionManager);
    get PanelPosition(): typeof PanelPosition;
    private _getPanelComponent;
    private _getSimilarPanels;
    private _calculateSimilarity;
    getPanelData(panelId: any): PanelData;
    addPanel(position: PanelPosition, panelId: string, options: any): void;
    addPanels(position: PanelPosition, panelsIds: string[], options: any): void;
    setPanels(panels: {
        [key in PanelPosition]: string[];
    }, options: any): void;
    getPanels(position: PanelPosition): PanelData[];
    reset(): void;
    onModeExit(): void;
    /**5
     * Activates the panel with the given id. If the forceActive flag is false
     * then it is up to the component containing the panel whether to activate
     * it immediately or not. For instance, the panel might not be activated when
     * the forceActive flag is false in the case where the user might have
     * activated/displayed and then closed the panel already.
     * Note that this method simply fires a broadcast event: ActivatePanelEvent.
     * @param panelId the panel's id
     * @param forceActive optional flag indicating if the panel should be forced to be activated or not
     */
    activatePanel(panelId: string, forceActive?: boolean): void;
    /**
     * Adds a mapping of events (activatePanelTriggers.sourceEvents) broadcast by
     * activatePanelTrigger.sourcePubSubService that
     * when fired/broadcasted must in turn activate the panel with the given id.
     * The subscriptions created are returned such that they can be managed and unsubscribed
     * as appropriate.
     * @param panelId the id of the panel to activate
     * @param activatePanelTriggers an array of triggers
     * @param forceActive optional flag indicating if the panel should be forced to be activated or not
     * @returns an array of the subscriptions subscribed to
     */
    addActivatePanelTriggers(panelId: string, activatePanelTriggers: ActivatePanelTriggers[], forceActive?: boolean): Subscription[];
}
export {};
