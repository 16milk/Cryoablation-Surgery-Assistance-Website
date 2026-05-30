export default IWebApiDataSource;
declare namespace IWebApiDataSource {
    export { create };
}
/**
 * Factory function that creates a new "Web API" data source.
 * A "Web API" data source is any source that fetches data over
 * HTTP. This function serves as an "adapter" to wrap those calls
 * so that all "Web API" data sources have the same interface and can
 * be used interchangeably.
 *
 * It's worth noting that a single implementation of this interface
 * can define different underlying sources for "read" and "write" operations.
 */
declare function create({ query, retrieve, store, reject, initialize, deleteStudyMetadataPromise, getImageIdsForDisplaySet, getImageIdsForInstance, getConfig, getStudyInstanceUIDs, }: {
    query: any;
    retrieve: any;
    store: any;
    reject: any;
    initialize: any;
    deleteStudyMetadataPromise: any;
    getImageIdsForDisplaySet: any;
    getImageIdsForInstance: any;
    getConfig: any;
    getStudyInstanceUIDs: any;
}): {
    query: any;
    retrieve: any;
    reject: any;
    store: any;
    initialize: any;
    deleteStudyMetadataPromise: any;
    getImageIdsForDisplaySet: any;
    getImageIdsForInstance: any;
    getConfig: any;
    getStudyInstanceUIDs: any;
};
