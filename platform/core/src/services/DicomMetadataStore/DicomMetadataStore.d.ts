declare function _setMetaDataProvider(metaData: any): void;
declare function _getStudyInstanceUIDs(): any[];
/**
 * Gets a study (a collection of series) using it's StudyInstanceUID
 * @param {*} StudyInstanceUID - Unique Identifier for the study
 * @returns {*} A study object
 */
declare function _getStudy(StudyInstanceUID: any): any;
/**
 * Gets a series (a collection of images) using both
 * the Study and Series InstanceUID's
 * @param {*} StudyInstanceUID - Unique Identifier for the study
 * @param {*} SeriesInstanceUID - Unique Identifier for the series
 * @returns {*} A series object
 */
declare function _getSeries(StudyInstanceUID: any, SeriesInstanceUID: any): any;
/**
 * Gets an instance (a single image or object)
 * @param {*} StudyInstanceUID - Unique Identifier for the study
 * @param {*} SeriesInstanceUID - Unique Identifier for the series
 * @param {*} SOPInstanceUID Unique Identifier for a specific instance
 * @returns an instance object
 */
declare function _getInstance(StudyInstanceUID: any, SeriesInstanceUID: any, SOPInstanceUID: any): any;
/**
 * Gets the frame module from the OHIF metadata provider, and then
 * uses the study/series/instance uids to get the instance data.
 */
declare function _getInstanceByImageId(imageId: any): any;
/**
 * Update the metadata of a specific series
 * @param {*} StudyInstanceUID
 * @param {*} SeriesInstanceUID
 * @param {*} metadata metadata inform of key value pairs
 * @returns
 */
declare function _updateMetadataForSeries(StudyInstanceUID: any, SeriesInstanceUID: any, metadata: any): void;
declare const DicomMetadataStore: {
    EVENTS: {
        STUDY_ADDED: string;
        INSTANCES_ADDED: string;
        SERIES_ADDED: string;
        SERIES_UPDATED: string;
    };
    listeners: {};
    addInstance(dicomJSONDatasetOrP10ArrayBuffer: any): void;
    addInstances(instances: any, madeInClient?: boolean): void;
    updateSeriesMetadata(seriesMetadata: any): void;
    addSeriesMetadata(seriesSummaryMetadata: any, madeInClient?: boolean): void;
    addStudy(study: any): void;
    getStudyInstanceUIDs: typeof _getStudyInstanceUIDs;
    getStudy: typeof _getStudy;
    getSeries: typeof _getSeries;
    getInstance: typeof _getInstance;
    getInstanceByImageId: typeof _getInstanceByImageId;
    updateMetadataForSeries: typeof _updateMetadataForSeries;
    setMetaDataProvider: typeof _setMetaDataProvider;
} & {
    subscribe: (eventName: any, callback: any) => {
        unsubscribe: () => any;
    };
    _broadcastEvent: (eventName: any, callbackProps: any) => void;
    _unsubscribe: (eventName: any, listenerId: any) => void;
    _isValidEvent: (eventName: any) => boolean;
};
export { DicomMetadataStore };
export default DicomMetadataStore;
