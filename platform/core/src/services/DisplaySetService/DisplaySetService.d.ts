import { ExtensionManager } from '../../extensions';
import { DisplaySet, InstanceMetadata, ReferencedSeriesSequence } from '../../types';
import { PubSubService } from '../_shared/pubSubServiceInterface';
export default class DisplaySetService extends PubSubService {
    static REGISTRATION: {
        altName: string;
        name: string;
        create: ({ configuration }: {
            configuration?: {};
        }) => DisplaySetService;
    };
    activeDisplaySets: any[];
    unsupportedSOPClassHandler: any;
    extensionManager: ExtensionManager;
    protected activeDisplaySetsMap: Map<string, DisplaySet>;
    protected activeDisplaySetsChanged: boolean;
    constructor();
    init(extensionManager: any, SOPClassHandlerIds: any): void;
    _addDisplaySetsToCache(displaySets: DisplaySet[]): void;
    _addActiveDisplaySets(displaySets: DisplaySet[]): void;
    /**
     * Sets the handler for unsupported sop classes
     * @param sopClassHandlerUID
     */
    setUnsuportedSOPClassHandler(sopClassHandler: any): void;
    /**
     * Adds new display sets directly, as specified.
     * Use this function when the display sets are created externally directly
     * rather than using the default sop class handlers to create display sets.
     */
    addDisplaySets(...displaySets: DisplaySet[]): string[];
    getDisplaySetCache(): Map<string, DisplaySet>;
    getMostRecentDisplaySet(): DisplaySet;
    getActiveDisplaySets(): DisplaySet[];
    /**
     * Gets the set of display sets with this series instance UID
     *
     * <b>WARNING: Do not use this method when you have a referenced series sequence
     * as this method does NOT check sop instances.  Instead, use getDisplaySetsForReference
     * to get those with the correct sop instances in them.</b>
     */
    getDisplaySetsForSeries: (seriesInstanceUID: string) => DisplaySet[];
    /**
     * Given a reference to a series/sop, returns the set of display sets
     * containing an instance from the references.
     */
    getDisplaySetsForReferences: (references: ReferencedSeriesSequence | ReferencedSeriesSequence[]) => DisplaySet[];
    getDisplaySetForSOPInstanceUID(sopInstanceUID: string, seriesInstanceUID: string, _frameNumber?: number): DisplaySet;
    setDisplaySetMetadataInvalidated(displaySetInstanceUID: string, invalidateData?: boolean): void;
    deleteDisplaySet(displaySetInstanceUID: any): void;
    /**
     * @param {string} displaySetInstanceUID
     * @returns {object} displaySet
     */
    getDisplaySetByUID: (displaySetInstanceUid: string) => DisplaySet;
    /**
     *
     * @param {*} input
     * @param {*} param1: settings: initialViewportSettings by HP or callbacks after rendering
     * @returns {string[]} - added displaySetInstanceUIDs
     */
    makeDisplaySets: (input: any, { batch, madeInClient, settings }?: {
        batch?: boolean;
        madeInClient?: boolean;
        settings?: {};
    }) => DisplaySet[];
    /**
     * The onModeExit returns the display set service to the initial state,
     * that is without any display sets.  To avoid recreating display sets,
     * the mode specific onModeExit is called before this method and should
     * store the active display sets and the cached data.
     */
    onModeExit(): void;
    /**
     * This function hides the old makeDisplaySetForInstances function to first
     * separate the instances by sopClassUID so each call have only instances
     * with the same sopClassUID, to avoid a series composed by different
     * sopClassUIDs be filtered inside one of the SOPClassHandler functions and
     * didn't appear in the series list.
     * @param instancesSrc
     * @param settings
     * @returns
     */
    makeDisplaySetForInstances(instancesSrc: InstanceMetadata[], settings: any): DisplaySet[];
    /**
     * Creates new display sets for the instances contained in instancesSrc
     * according to the sop class handlers registered.
     * This is idempotent in that calling it a second time with the
     * same set of instances will not result in new display sets added.
     * However, the response for the subsequent call will be empty as the data
     * is already present.
     * Calling it with some new instances and some existing instances will
     * result in the new instances being added to existing display sets if
     * they support the addInstances call, OR to new instances otherwise.
     * Only the new instances are returned - the others are updated.
     *
     * @param instancesSrc are instances to add
     * @param settings are settings to add
     * @returns Array of the display sets added.
     */
    private _makeDisplaySetForInstances;
    /**
     * Iterates over displaysets and invokes comparator for each element.
     * It returns a list of items that has being succeed by comparator method.
     *
     * @param comparator - method to be used on the validation
     * @returns list of displaysets
     */
    getDisplaySetsBy(comparator: (DisplaySet: any) => boolean): DisplaySet[];
    /**
     *
     * @param sortFn function to sort the display sets
     * @param direction direction to sort the display sets.  Ascending means
     *    increasing in value, which will typically put the lowest series numbers
     *    first, with low priority display sets last with newest first.
     *    The meaning of this flag may change to leave the image/non-image display
     *    set sorting alone and only affect sorting within groups, or have additional
     *    values for specific changes to the sort.
     * @returns void
     */
    sortDisplaySets(sortFn: (a: DisplaySet, b: DisplaySet) => number, direction?: 'ascending' | 'descending', suppressEvent?: boolean): void;
}
