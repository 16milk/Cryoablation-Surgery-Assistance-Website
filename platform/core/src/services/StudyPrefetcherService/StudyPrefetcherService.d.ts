import { PubSubService } from '../_shared/pubSubServiceInterface';
import { ExtensionManager } from '../../extensions';
import ServicesManager from '../ServicesManager';
export declare const EVENTS: {
    SERVICE_STARTED: string;
    SERVICE_STOPPED: string;
    DISPLAYSET_LOAD_PROGRESS: string;
    DISPLAYSET_LOAD_COMPLETE: string;
};
/**
 * Order used for prefetching display set
 */
declare enum StudyPrefetchOrder {
    closest = "closest",
    downward = "downward",
    upward = "upward"
}
/**
 * Study Prefetcher configuration
 */
type StudyPrefetcherConfig = {
    enabled: boolean;
    displaySetsCount: number;
    /**
     * Max number of concurrent prefetch requests
     * High numbers may impact on the time to load a new dropped series because
     * the browser will be busy with all prefetching requests. As soon as the
     * prefetch requests get fulfilled the new ones from the new dropped series
     * are sent to the server.
     *
     * TODO: abort all prefetch requests when a new series is loaded on a viewport.
     * (need to add support for `AbortController` on Cornerstone)
     * */
    maxNumPrefetchRequests: number;
    order: StudyPrefetchOrder;
};
interface ICache {
    isImageCached(imageId: string): boolean;
}
interface IImageLoadPoolManager {
    addRequest(requestFn: () => Promise<any>, type: string, additionalDetails: Record<string, unknown>, priority?: number): any;
    clearRequestStack(type: string): void;
}
interface IImageLoader {
    loadAndCacheImage(imageId: string, options: any): Promise<any>;
}
type EventSubscription = {
    unsubscribe: () => void;
};
interface IImageLoadEventsManager {
    addEventListeners(onImageLoaded: (evt: any) => void, onImageLoadFailed: (evt: any) => void): EventSubscription[];
}
declare class StudyPrefetcherService extends PubSubService {
    private _extensionManager;
    private _servicesManager;
    private _subscriptions;
    private _activeDisplaySetsInstanceUIDs;
    private _pendingRequests;
    private _inflightRequests;
    private _isRunning;
    private _displaySetLoadingStates;
    private _imageIdsToDisplaySetsMap;
    private config;
    requestType: string;
    cache: ICache;
    imageLoadPoolManager: IImageLoadPoolManager;
    imageLoader: IImageLoader;
    imageLoadEventsManager: IImageLoadEventsManager;
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ configuration, servicesManager, extensionManager }: {
            configuration: any;
            servicesManager: any;
            extensionManager: any;
        }) => StudyPrefetcherService;
    };
    constructor({ servicesManager, extensionManager, configuration, }: {
        servicesManager: ServicesManager;
        extensionManager: ExtensionManager;
        configuration: StudyPrefetcherConfig;
    });
    onModeEnter(): void;
    /**
     * The onModeExit returns the service to the initial state.
     */
    onModeExit(): void;
    private _addImageLoadingEventsListeners;
    private _addServicesListeners;
    private _addEventListeners;
    private _removeEventListeners;
    private _syncWithActiveViewport;
    private _setActiveDisplaySetsUIDs;
    private _areActiveDisplaySetsLoaded;
    private _getClosestDisplaySets;
    private _getDownwardDisplaySets;
    private _getUpwardDisplaySets;
    private _getSortedDisplaySetsToPrefetch;
    private _getDisplaySets;
    private _updateImageIdsDisplaySetMap;
    private _getImageIdsForDisplaySet;
    private _updateDisplaySetLoadingProgress;
    private _addDisplaySetLoadingState;
    private _loadDisplaySets;
    private _moveImageIdToLoadedSet;
    private _moveImageIdToFailedSet;
    private _triggerDisplaySetEvents;
    private _onImagePrefetchSuccess;
    private _onImagePrefetchFailed;
    private _sendNextRequests;
    private _enqueueDisplaySetImagesRequests;
    /**
     * Start prefetching the display sets based on the active viewport and app configuration.
     */
    private _startPrefetching;
    /**
     * Stop prefetching the display sets.
     * All internal variables are cleared but activeDisplaySetsInstanceUIDs otherwise restart would not work.
     */
    private _stopPrefetching;
    /**
     * Restart prefetching in case it is already running.
     */
    private _restartPrefetching;
}
export { StudyPrefetcherService as default, StudyPrefetcherService };
