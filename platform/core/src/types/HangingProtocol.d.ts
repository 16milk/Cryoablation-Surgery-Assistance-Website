import { Command } from './Command';
export type DisplaySetInfo = {
    displaySetInstanceUID?: string;
    displaySetOptions: DisplaySetOptions;
};
export type ViewportMatchDetails = {
    viewportOptions: ViewportOptions;
    displaySetsInfo: DisplaySetInfo[];
};
export type DisplaySetMatchDetails = {
    StudyInstanceUID?: string;
    displaySetInstanceUID: string;
    matchDetails?: any;
    matchingScores?: DisplaySetMatchDetails[];
    sortingInfo?: any;
};
export type DisplaySetAndViewportOptions = {
    displaySetInstanceUIDs: string[];
    viewportOptions: ViewportOptions;
    displaySetOptions: DisplaySetOptions;
};
export interface ViewportUpdate {
    viewportId?: string;
    displaySetInstanceUIDs: string[];
    viewportOptions?: ViewportOptions;
    displaySetOptions?: DisplaySetOptions[];
}
export type DisplayArea = {
    type?: 'SCALE' | 'FIT';
    scale?: number;
    interpolationType?: any;
    imageArea?: [number, number];
    imageCanvasPoint?: {
        imagePoint: [number, number];
        canvasPoint?: [number, number];
    };
    storeAsInitialCamera?: boolean;
};
export type SetProtocolOptions = {
    /** Used to provide a mapping of what keys are provided for which viewport.
     * For example, a Chest XRay might use have the display set selector id of
     * "ChestXRay", then the user might drag an alternate chest xray from the initially chosen one,
     * and then navigate to another stage or protocol.  If that new stage/protocol
     * uses the name "ChestXRay", then that selection will be used instead of
     * matching the display set selectors.  That allows remembering the
     * user selected views by name.
     * Note the keys are not simple display set selector values, but are:
     * `${activeStudyUID}:${displaySetSelectorId}:${matchingDisplaySetIndex || 0}`
     * This is normally transparent to the user of this, but in order to specify
     * specific instances, they can be added like that.
     */
    displaySetSelectorMap?: Record<string, Array<string>>;
    /** Used to define the display sets already in view, in order to allow
     * filling empty viewports with other instances.
     * Only used when the -1 value for matchedDisplaySetsIndex is provided.
     * List of display set instance UID's already displayed.
     */
    inDisplay?: string[];
    /** Select the given stage, either by ID or position.
     * Don't forget that name is used as the ID if ID not provided.
     */
    stageId?: string;
    stageIndex?: number;
    /** Indicates to setup the protocol and fire the PROTOCOL_RESTORED event
     * but don't fire the protocol changed event.  Used to restore the
     * HP service to a previous state.
     */
    restoreProtocol?: boolean;
};
export type HangingProtocolMatchDetails = {
    displaySetMatchDetails: Map<string, DisplaySetMatchDetails>;
    viewportMatchDetails: Map<string, ViewportMatchDetails>;
};
export type ConstraintValue = string | number | boolean | [] | string[] | {
    value: string | number | boolean | [];
};
export type Constraint = {
    equals?: ConstraintValue;
    notEquals?: ConstraintValue;
    containsI?: string;
    contains?: ConstraintValue;
    doesNotContain?: ConstraintValue;
    greaterThan?: ConstraintValue;
};
export type MatchingRule = {
    id?: string;
    weight?: number;
    attribute: string;
    constraint?: Constraint;
    required?: boolean;
};
export type ViewportLayoutOptions = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type ViewportStructure = {
    layoutType: string;
    properties: {
        rows: number;
        columns: number;
        layoutOptions?: ViewportLayoutOptions[];
    };
};
/**
 * Selects the display sets to apply for a given id.
 * This is a set of rules which match the study and display sets
 * and then provides an id for them so that they can re-used in different
 * viewports.
 * The matches are done lazily, so if a stage doesn't need a given match,
 * it won't be selected.
 */
export type DisplaySetSelector = {
    id?: string;
    /**
     *  This can be set to true to allow unmatched views to replace a view showing this instance
     * This is done at hte display set selector level to ensure that viewports sharing a display set
     * don't get different values of allowUnmatchedView
     */
    allowUnmatchedView?: boolean;
    imageMatchingRules?: MatchingRule[];
    seriesMatchingRules: MatchingRule[];
    studyMatchingRules?: MatchingRule[];
};
export type OverlaySelector = {
    id?: string;
    matchingRules: MatchingRule[];
};
export type SyncGroup = {
    type: string;
    id: string;
    source?: boolean;
    target?: boolean;
    options?: object;
};
/** Declares a custom option, that is a computed type value */
export type CustomOptionAttribute<T> = {
    custom: string;
    defaultValue?: T;
};
export type CustomOption<T> = CustomOptionAttribute<T> | T;
export type initialImageOptions = {
    index?: number;
    preset?: string;
};
export type ViewportOptions = {
    toolGroupId?: CustomOption<string>;
    viewportType?: CustomOption<string>;
    id?: string;
    orientation?: CustomOption<string>;
    background?: CustomOption<[number, number, number]>;
    viewportId?: string;
    displayArea?: DisplayArea;
    initialImageOptions?: CustomOption<initialImageOptions>;
    syncGroups?: CustomOption<SyncGroup>[];
    customViewportProps?: Record<string, unknown>;
    /**
     * Set to true to allow non-matching drag and drop or options provided
     * from options.displaySetSelectorsMap
     * @deprecated Moving to display set selector
     */
    allowUnmatchedView?: boolean;
};
export type DisplaySetOptions = {
    id: string;
    /** The offset to allow display secondary series, for example
     * to display the second matching series, use `matchedDisplaySetsIndex==1` */
    matchedDisplaySetsIndex?: number;
    options?: Record<string, unknown>;
};
export type OverlayOptions = {
    id?: string;
    options?: Record<string, unknown>;
};
export type Viewport = {
    viewportOptions: ViewportOptions;
    displaySets: DisplaySetOptions[];
    overlays?: OverlayOptions[];
};
/**
 * disabled stages are missing display sets required in order to view them.
 * enabled stages have all the requiredDisplaySets and at least preferredViewports
 * filled.
 * passive stages have the requiredDisplaySets and at least requiredViewports filled.
 */
export type StageStatus = 'disabled' | 'enabled' | 'passive';
/** Controls whether a stage is activated or not, at the given level, by
 * controlling the status of the stage.
 */
export type StageActivation = {
    minViewportsMatched?: number;
    displaySetSelectorsMatched?: string[];
};
/**
 * Protocol stages are a set of different views which can be applied, for
 * example, a 2x1 and a 1x1 view might be both applied (see default extension
 * for this example).
 */
export type ProtocolStage = {
    /** The id defaults to the name of the protocol if not otherwise specified */
    id?: string;
    /**
     * The display name used for this stage when shown to the user.  This can
     * differ from the id, for example, to use the same name for different
     * stages, only one of which ends up being active.
     */
    name: string;
    /** Indicate if the stage can be applied or not */
    status?: StageStatus;
    viewportStructure: ViewportStructure;
    stageActivation?: {
        enabled?: StageActivation;
        passive?: StageActivation;
    };
    /** A viewport definition used for to fill in manually selected viewports.
     * This allows changing the layout definition for additional viewports without
     * needing to define layouts for each of the 1x1, 2x2 etc modes.
     */
    defaultViewport?: Viewport;
    viewports: Viewport[];
    createdDate?: string;
};
export type ProtocolNotifications = {
    onProtocolExit?: Command[];
    onProtocolEnter?: Command[];
    onLayoutChange?: Command[];
    onViewportDataInitialized?: Command[];
    onStageChange?: Command[];
};
/**
 * A protocol is the top level definition for a hanging protocol.
 * It is a set of rules about when the protocol can be applied at all,
 * as well as a set of stages that represent individual views.
 * Additionally, the display set selectors are used to choose from the existing
 * display sets.  The hanging protocol definition here does NOT allow
 * redefining the display sets to use, but only selects the views to show.
 */
export type Protocol = {
    id: string;
    /** A description of this protocol.  Used as a tool tip for the user. */
    description?: string;
    /** Maps ids to display set selectors to choose display sets */
    displaySetSelectors: Record<string, DisplaySetSelector>;
    /** overlay selectors that decide whether an overlay such as segmentation should be shown or not */
    overlaySelectors?: Record<string, OverlaySelector>;
    /** A default viewport to use for any stage to select new viewport layouts. */
    defaultViewport?: Viewport;
    stages: ProtocolStage[];
    locked?: boolean;
    name?: string;
    createdDate?: string;
    modifiedDate?: string;
    availableTo?: Record<string, unknown>;
    editableBy?: Record<string, unknown>;
    toolGroupIds?: string[];
    callbacks?: ProtocolNotifications;
    imageLoadStrategy?: string;
    protocolMatchingRules?: MatchingRule[];
    numberOfPriorsReferenced?: number;
    syncDataForViewports?: boolean;
    /**
     * Set of minimal conditions necessary to run the hanging protocol.
     */
    hpInitiationCriteria?: {
        minSeriesLoaded: number;
    };
    icon?: string;
    /** Indicates if the protocol is a preset or not. Useful for setting presets for the layout selector */
    isPreset?: true;
};
/** Used to dynamically generate protocols.
 * Try to avoid this as it is difficult to provide active/disabled settings
 * to the GUI when this is used, and it can be expensive to apply.
 * Alternatives include using the custom attributes where possible.
 */
export type ProtocolGenerator = ({ servicesManager, commandsManager }: withAppTypes) => {
    protocol: Protocol;
};
export type HPInfo = {
    protocolId: string;
    stageId: string;
    stageIndex: number;
    activeStudyUID: string;
};
