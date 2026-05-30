import { PubSubService } from '../_shared/pubSubServiceInterface';
import ProtocolEngine from './ProtocolEngine';
import { StudyMetadata } from '../../types/StudyMetadata';
import DisplaySet from '../DisplaySetService/DisplaySet';
import { CommandsManager } from '../../classes';
import * as HangingProtocol from '../../types/HangingProtocol';
import { sopInstanceLocation } from './custom-attribute/isDisplaySetFromUrl';
type Protocol = HangingProtocol.Protocol | HangingProtocol.ProtocolGenerator;
export default class HangingProtocolService extends PubSubService {
    static EVENTS: {
        PROTOCOL_CHANGED: string;
        PROTOCOL_RESTORED: string;
        NEW_LAYOUT: string;
        STAGE_ACTIVATION: string;
        CUSTOM_IMAGE_LOAD_PERFORMED: string;
    };
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ configuration, commandsManager, servicesManager }: {
            configuration?: {};
            commandsManager: any;
            servicesManager: any;
        }) => HangingProtocolService;
    };
    studies: StudyMetadata[];
    protocols: Map<string, Protocol>;
    activeProtocolIds: string[];
    protocol: HangingProtocol.Protocol;
    _originalProtocol: HangingProtocol.Protocol;
    stageIndex: number;
    _commandsManager: CommandsManager;
    _servicesManager: AppTypes.ServicesManager;
    protocolEngine: ProtocolEngine;
    customViewportSettings: any[];
    displaySets: DisplaySet[];
    activeStudy: StudyMetadata;
    debugLogging: false;
    customAttributeRetrievalCallbacks: {
        NumberOfStudyRelatedSeries: {
            name: string;
            callback: (metadata: any) => any;
        };
        NumberOfSeriesRelatedInstances: {
            name: string;
            callback: (metadata: any) => any;
        };
        ModalitiesInStudy: {
            name: string;
            callback: (metadata: any) => any;
        };
        isReconstructable: {
            name: string;
            callback: (displaySet: any) => any;
        };
        isDisplaySetFromUrl: {
            name: string;
            callback: (displaySet: any) => boolean;
        };
        sopInstanceLocation: {
            name: string;
            callback: typeof sopInstanceLocation;
        };
        seriesDescriptions: {
            name: string;
            description: string;
            callback: (study: any, extraData: any) => any;
        };
        numberOfDisplaySetsWithImages: {
            name: string;
            description: string;
            callback: (study: any, extraData: any) => any;
        };
    };
    listeners: {};
    registeredImageLoadStrategies: {};
    activeImageLoadStrategyName: any;
    customImageLoadPerformed: boolean;
    /**
     * displaySetMatchDetails = <displaySetId, match>
     * DisplaySetId is the id defined in the hangingProtocol object itself
     * and match is an object that contains information about
     */
    displaySetMatchDetails: Map<string, // protocol displaySetId in the displayset selector
    HangingProtocol.DisplaySetMatchDetails>;
    /**
     * An array that contains for each viewport (viewportId) specified in the
     * hanging protocol, an object of the form
     */
    viewportMatchDetails: Map<string, // viewportId
    HangingProtocol.ViewportMatchDetails>;
    constructor(commandsManager: CommandsManager, servicesManager: AppTypes.ServicesManager);
    destroy(): void;
    reset(): void;
    /** Leave the hanging protocol in the initialized state */
    onModeEnter(): void;
    /**
     * Gets the active protocol information directly, including the direct
     * protocol, stage and active study objects.
     * Should NOT be stored longer term as the protocol
     * object can change internally or be regenerated.
     * Can be used to store the state to recover from exceptions.
     *
     * @returns protocol, stage, activeStudy
     */
    getActiveProtocol(): {
        protocol: HangingProtocol.Protocol;
        _originalProtocol: HangingProtocol.Protocol;
        stage: HangingProtocol.ProtocolStage;
        stageIndex: number;
        activeStudy?: StudyMetadata;
        viewportMatchDetails: Map<string, HangingProtocol.ViewportMatchDetails>;
        displaySetMatchDetails: Map<string, HangingProtocol.DisplaySetMatchDetails>;
        activeImageLoadStrategyName: string;
    };
    /** Gets the hanging protocol state information, which is a storable
     * state information for the hanging protocol consisting of the:
     * protocolId, stageIndex, stageId and activeStudyUID
     */
    getState(): HangingProtocol.HPInfo;
    /**
     * Filters the series required for running a hanging protocol.
     *
     * This can be extended in the future with more complex selection rules e.g.
     * N series of a given type, and M of a different type, such as all CT series,
     * and all SR, and then everything else.
     *
     * @param protocolId - The ID of the hanging protocol.
     * @param seriesPromises - An array of promises representing the series.
     * @returns An object containing the required series and the remaining series.
     */
    filterSeriesRequiredForRun(protocolId: any, seriesPromises: any): {
        requiredSeries: any;
        remaining: any;
    };
    /** Gets the protocol with id 'default' */
    getDefaultProtocol(): HangingProtocol.Protocol;
    /** Gets the viewport match details.
     * @deprecated because this method is expected to go away as the HP service
     *    becomes more stateless.
     */
    getMatchDetails(): HangingProtocol.HangingProtocolMatchDetails;
    /**
     * It loops over the protocols map object, and checks whether the protocol
     * is a function, if so, it executes it and returns the result as a protocol object
     * otherwise it returns the protocol object itself
     *
     * @returns all the hanging protocol registered in the HangingProtocolService
     */
    getProtocols(): HangingProtocol.Protocol[];
    /**
     * Returns the protocol with the given id, it will get the protocol from the
     * protocols map object and if it is a function, it will execute it and return
     * the result as a protocol object
     *
     * @param protocolId - the id of the protocol
     * @returns protocol - the protocol with the given id
     */
    getProtocolById(protocolId: string, caseInsensitive?: boolean): HangingProtocol.Protocol;
    /**
     * It adds a protocol to the protocols map object. If a protocol with the given
     * id already exists, warn the user and overwrite it.  This can be used to
     * set a new "default" protocol.
     *
     * @param {string} protocolId - The id of the protocol.
     * @param {Protocol} protocol - Protocol - This is the protocol that you want to
     * add to the protocol manager.
     */
    addProtocol(protocolId: string, protocol: Protocol): void;
    /**
     * Add a given protocol object as active.
     * If active protocols ids is null right now, then the specified
     * protocol will become the only active protocol.
     */
    addActiveProtocolId(id: string): void;
    /**
     * Sets the active hanging protocols to use, by name.  If the value is empty,
     * then resets the active protocols to all the named items.
     */
    setActiveProtocolIds(protocolId?: string[] | string): void;
    /**
     * Sets the active study.
     * This is the study that the hanging protocol will consider active and
     * may or may not be the study that is being shown by the protocol currently,
     * for example, a prior view hanging protocol will NOT show the active study
     * specifically, but will show another study instead.
     */
    setActiveStudyUID(activeStudyUID: string): StudyMetadata;
    hasStudyUID(studyUID: string): boolean;
    addStudy(study: any): void;
    /**
     * Run the hanging protocol decisions tree on the active study,
     * studies list and display sets, firing a PROTOCOL_CHANGED event when
     * complete to indicate the hanging protocol is ready, and which stage
     * got applied/activated.
     *
     * Also fires a STAGES_ACTIVE event to indicate which stages are able to be
     * activated.
     *
     * @param params is the dataset to run the hanging protocol on.
     * @param params.activeStudy is the "primary" study to hang  This may or may
     *        not be displayed by the actual viewports.
     * @param params.studies is the list of studies to hang.  If absent, will reuse the previous set.
     * @param params.displaySets is the list of display sets associated with
     *        the studies to display in viewports.
     * @param protocol is a specific protocol to apply.
     */
    run({ studies, displaySets, activeStudy }: {
        studies: any;
        displaySets: any;
        activeStudy: any;
    }, protocolId: any, options?: {}): void;
    /**
     * Returns true, if the hangingProtocol has a custom loading strategy for the images
     * and its callback has been added to the HangingProtocolService
     * @returns A boolean indicating whether a custom image load strategy has been added or not.
     */
    hasCustomImageLoadStrategy(): boolean;
    /**
     * Returns a boolean indicating whether a custom image load has been performed or not.
     * A custom image load is performed when a custom image load strategy is used to load images.
     * This method is used internally by the HangingProtocolService to determine whether to perform
     * a custom image load or not.
     *
     * @returns A boolean indicating whether a custom image load has been performed or not.
     */
    private getCustomImageLoadPerformed;
    /**
     * Returns a boolean indicating whether a custom image load should be performed or not.
     * A custom image load should be performed if a custom image load strategy has been added to the HangingProtocolService
     * and it has not been performed yet.
     *
     * @returns A boolean indicating whether a custom image load should be performed or not.
     */
    getShouldPerformCustomImageLoad(): boolean;
    /**
     * Set the strategy callback for loading images to the HangingProtocolService
     * @param {string} name strategy name
     * @param {Function} callback image loader callback
     */
    registerImageLoadStrategy(name: any, callback: any): void;
    /**
     * Adds a custom attribute to be used in the HangingProtocol UI and matching rules, including a
     * callback that will be used to calculate the attribute value.
     *
     * @param attributeId The ID used to refer to the attribute (e.g. 'timepointType')
     * @param attributeName The name of the attribute to be displayed (e.g. 'Timepoint Type')
     * @param callback The function used to calculate the attribute value from the other attributes at its level (e.g. study/series/image)
     * @param options to add to the "this" object for the custom attribute retriever
     */
    addCustomAttribute(attributeId: string, attributeName: string, callback: (metadata: Record<string, unknown>, extraData?: Record<string, unknown>) => unknown, options?: Record<string, unknown>): void;
    /**
     * Executes the callback function for the custom loading strategy for the images
     * if no strategy is set, the default strategy is used
     */
    runImageLoadStrategy(data: any): boolean;
    _validateProtocol(protocol: HangingProtocol.Protocol): HangingProtocol.Protocol;
    private _getProtocolFromGenerator;
    /**
     * This will return the viewports that need to be updated based on the
     * hanging protocol layout and the displaySetInstanceUID that needs to be updated.
     *
     * This is useful, when for instance we drag and drop a displaySet into a viewport
     * which is in MPR, and we need to update the other viewports that are showing the same
     * layout.
     *
     * However, sometimes since we get out of sync with the hanging protocol layout, when
     * the user use the custom grid layout, we should not update the other viewports, and that is
     * when the isHangingProtocolLayout is set to false.
     *
     * @param viewportId - the id of the viewport that needs to be updated
     * @param displaySetInstanceUID - the displaySetInstanceUID that needs to be updated
     * @param isHangingProtocolLayout - whether the layout is a hanging protocol layout
     * @returns
     */
    getViewportsRequireUpdate(viewportId: any, displaySetInstanceUID: any, isHangingProtocolLayout?: boolean): any[];
    runMatchingRules(metadataArray: any, matchingRules: any, options: any): any;
    private _updateDisplaySetInstanceUIDs;
    /**
     *  Gets a computed options value, or a copy of the options
     * This allows computing values such as the initial image index to use
     * based on custom attribute functions, the same as the validators.
     * Computing individual values is something that can be declared statically
     * as long as the named functions are provided ahead of time, which is much
     * simpler than recomputing the entire protocol.
     */
    getComputedOptions(options: Record<string, unknown> | Array<Record<string, unknown>>, displaySetUIDs: string[]): any;
    /**
     * It applied the protocol to the current studies and display sets based on the
     * protocolId that is provided.
     * @param protocolId - name of the registered protocol to be set
     * @param options - options to be passed to the protocol, this is either an array
     * of the displaySetInstanceUIDs to be set on ALL VIEWPORTS OF THE PROTOCOL or an object
     * that contains viewportId as the key and displaySetInstanceUIDs as the value
     * for each viewport that needs to be set.
     * @param errorCallback - callback to be called if there is an error
     * during the protocol application
     *
     * @returns boolean - true if the protocol was applied and no errors were found
     */
    setProtocol(protocolId: string, options?: HangingProtocol.SetProtocolOptions, errorCallback?: any): void;
    protected matchActivation(matchedViewports: number, activation: HangingProtocol.StageActivation, minViewportsMatched: number): boolean;
    /**
     * Updates the stage activation, setting the stageActivation values to
     * 'disabled', 'active', 'passive' where:
     * * disabled means there are insufficient viewports filled to show this
     * * passive means there aren't enough preferred viewports filled to show
     * this stage by default, but it can be manually selected
     * * enabled means there are enough viewports to select this viewport by default
     *
     * The logic is currently simple, just count how many viewports would be
     * filled, and compare to the required/preferred count, but the intent is
     * to allow more complex rules in the future as required.
     *
     * @returns the stage number to apply initially, given the options.
     */
    private _updateStageStatus;
    private _findStageIndex;
    private _setProtocol;
    getStageIndex(protocolId: string, options: any): number;
    /**
     * Retrieves the number of Stages in the current Protocol or
     * undefined if no protocol or stages are set
     */
    _getNumProtocolStages(): number;
    /**
     * Retrieves the current Stage from the current Protocol and stage index
     *
     * @returns {*} The Stage model for the currently displayed Stage
     */
    _getCurrentStageModel(): HangingProtocol.ProtocolStage;
    /**
     * Gets a new viewport object for missing viewports.  Used to fill
     * new viewports.
     * Looks first for the stage, to see if there is a missingViewport defined,
     * and secondly looks to the overall protocol.
     *
     * Returns a matchInfo object, which can be used to create the actual
     * viewport object (which this class knows nothing about).
     */
    getMissingViewport(protocolId: string, stageIdx: number, options: any): HangingProtocol.ViewportMatchDetails;
    /**
     * Gets a sort function that is consistent with the display set sorting performed
     * to match display sets to viewports.
     * @returns a display set sort function
     */
    getDisplaySetSortFunction(): (displaySetA: DisplaySet, displaySetB: DisplaySet) => number;
    /**
     * Updates the viewports with the selected protocol stage.
     */
    _updateViewports(options?: HangingProtocol.SetProtocolOptions): void;
    private _matchAllViewports;
    protected findDeduplicatedMatchDetails(matchDetails: HangingProtocol.DisplaySetMatchDetails, offset: number, options?: HangingProtocol.SetProtocolOptions): HangingProtocol.DisplaySetMatchDetails;
    protected validateDisplaySetSelectMatch(match: HangingProtocol.DisplaySetMatchDetails, id: string, displaySetUID: string): void;
    protected _matchViewport(viewport: HangingProtocol.Viewport, options: HangingProtocol.SetProtocolOptions, viewportMatchDetails?: Map<string, HangingProtocol.ViewportMatchDetails>, displaySetMatchDetails?: Map<string, HangingProtocol.DisplaySetMatchDetails>): HangingProtocol.ViewportMatchDetails;
    private _validateViewportSpecificMatch;
    areRequiredSelectorsValid(displaySetSelectors: HangingProtocol.DisplaySetSelector[], displaySet: DisplaySet): boolean;
    private _validateRequiredSelectors;
    _validateOptions(options: HangingProtocol.SetProtocolOptions): void;
    protected _matchImages(displaySetRules: any): {
        bestMatch: any;
        matchingScores: any[];
    };
    private _getSeriesSortInfoForDisplaySetSort;
    private _getSeriesFieldForDisplaySetSort;
    /**
     * Check if the next stage is available
     * @return {Boolean} True if next stage is available or false otherwise
     */
    _isNextStageAvailable(): boolean;
    /**
     * Check if the previous stage is available
     * @return {Boolean} True if previous stage is available or false otherwise
     */
    _isPreviousStageAvailable(): boolean;
    /**
     * Changes the current stage to a new stage index in the display set sequence.
     * It checks if the next stage exists.
     *
     * @param {Integer} stageAction An integer value specifying whether next (1) or previous (-1) stage
     * @return {Boolean} True if new stage has set or false, otherwise
     */
    _setCurrentProtocolStage(stageAction: number, options: HangingProtocol.SetProtocolOptions): boolean;
    /** Set this.debugLogging to true to show debug level logging - needed
     * to be able to figure out why hanging protocols are or are not applying.
     */
    debug(...args: any[]): void;
    _copyProtocol(protocol: Protocol): any;
}
export {};
