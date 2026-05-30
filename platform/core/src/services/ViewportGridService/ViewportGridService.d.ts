import { PubSubService } from '../_shared/pubSubServiceInterface';
type PresentationIdProvider = (id: string, { viewport, viewports, isUpdatingSameViewport }: {
    viewport: any;
    viewports: any;
    isUpdatingSameViewport: any;
}) => unknown;
declare class ViewportGridService extends PubSubService {
    static readonly EVENTS: {
        ACTIVE_VIEWPORT_ID_CHANGED: string;
        LAYOUT_CHANGED: string;
        GRID_STATE_CHANGED: string;
        GRID_SIZE_CHANGED: string;
        VIEWPORTS_READY: string;
        VIEWPORT_ONDROP_HANDLED: string;
    };
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ configuration, servicesManager }: {
            configuration?: {};
            servicesManager: any;
        }) => ViewportGridService;
    };
    serviceImplementation: {};
    servicesManager: AppTypes.ServicesManager;
    presentationIdProviders: Map<string, PresentationIdProvider>;
    constructor({ servicesManager }: {
        servicesManager: any;
    });
    addPresentationIdProvider(id: string, provider: PresentationIdProvider): void;
    /**
     * Gets the presentation provider with the given id.
     */
    getPresentationIdProvider(id: string): PresentationIdProvider;
    getPresentationId(id: string, viewportId: string): string | null;
    private _getPresentationId;
    getPresentationIds({ viewport, viewports }: {
        viewport: any;
        viewports: any;
    }): {};
    setServiceImplementation({ getState: getStateImplementation, setActiveViewportId: setActiveViewportIdImplementation, setDisplaySetsForViewports: setDisplaySetsForViewportsImplementation, setLayout: setLayoutImplementation, reset: resetImplementation, onModeExit: onModeExitImplementation, set: setImplementation, getNumViewportPanes: getNumViewportPanesImplementation, setViewportIsReady: setViewportIsReadyImplementation, getViewportState: getViewportStateImplementation, }: {
        getState: any;
        setActiveViewportId: any;
        setDisplaySetsForViewports: any;
        setLayout: any;
        reset: any;
        onModeExit: any;
        set: any;
        getNumViewportPanes: any;
        setViewportIsReady: any;
        getViewportState: any;
    }): void;
    publishViewportsReady(): void;
    publishViewportOnDropHandled(eventData: any): void;
    setActiveViewportId(id: string): void;
    getState(): AppTypes.ViewportGrid.State;
    getViewportState(viewportId: string): any;
    setViewportIsReady(viewportId: any, callback: any): void;
    getActiveViewportId(): string;
    setViewportGridSizeChanged(): void;
    setDisplaySetsForViewport(props: any): void;
    setDisplaySetsForViewports(viewportsToUpdate: any): Promise<void>;
    /**
     * Retrieves the display set instance UIDs for a given viewport.
     * @param viewportId The ID of the viewport.
     * @returns An array of display set instance UIDs.
     */
    getDisplaySetsUIDsForViewport(viewportId: string): string[];
    /**
     *
     * @param numCols, numRows - the number of columns and rows to apply
     * @param findOrCreateViewport is a function which takes the
     *    index position of the viewport, the position id, and a set of
     *    options that is initially provided as {} (eg to store intermediate state)
     *    The function returns a viewport object to use at the given position.
     */
    setLayout({ numCols, numRows, layoutOptions, layoutType, activeViewportId, findOrCreateViewport, isHangingProtocolLayout, }: {
        numCols: any;
        numRows: any;
        layoutOptions: any;
        layoutType?: string;
        activeViewportId?: any;
        findOrCreateViewport?: any;
        isHangingProtocolLayout?: boolean;
    }): Promise<void>;
    reset(): void;
    /**
     * The onModeExit must set the state of the viewport grid to a standard/clean
     * state.  To implement store/recover of the viewport grid, perform
     * a state store in the mode or extension onModeExit, and recover that
     * data if appropriate in the onModeEnter of the mode or extension.
     */
    onModeExit(): void;
    set(newState: any): void;
    getNumViewportPanes(): any;
    getLayoutOptionsFromState(state: any): {
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
}
export default ViewportGridService;
