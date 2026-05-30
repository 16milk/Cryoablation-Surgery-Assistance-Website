declare class MetadataProvider {
    private readonly imageURIToUIDs;
    private readonly customMetadata;
    addImageIdToUIDs(imageId: any, uids: any): void;
    addCustomMetadata(imageId: any, type: any, metadata: any): void;
    _getInstance(imageId: any): any;
    get(query: any, imageId: any, options?: {
        fallback: boolean;
    }): any;
    getTag(query: any, imageId: any, options: any): any;
    getInstance(imageId: any): any;
    getTagFromInstance(naturalizedTagOrWADOImageLoaderTag: any, instance: any, options?: {
        fallback: boolean;
    }): any;
    /**
     * Adds a new handler for the given tag.  The handler will be provided an
     * instance object that it can read values from.
     */
    addHandler(wadoImageLoaderTag: string, handler: any): void;
    _getCornerstoneDICOMImageLoaderTag(wadoImageLoaderTag: any, instance: any): any;
    /**
     * Retrieves the frameNumber information, depending on the url style
     * wadors /frames/1
     * wadouri &frame=1
     * @param {*} imageId
     * @returns
     */
    getFrameInformationFromURL(imageId: any): string;
    getUIDsFromImageID(imageId: any): any;
}
declare const metadataProvider: MetadataProvider;
export default metadataProvider;
