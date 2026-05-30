/** Indicates if the given display set is the one specified in the
 * displaySet parameter in the URL
 * The parameters are:
 *    initialSeriesInstanceUID
 *    initialSOPInstanceUID
 */
declare const isDisplaySetFromUrl: (displaySet: any) => boolean;
/** Returns the index location of the requested image, or the defaultValue in this.
 * Returns undefined to fallback to the defaultValue
 */
declare function sopInstanceLocation(displaySets: any): {
    index: any;
};
export { isDisplaySetFromUrl, sopInstanceLocation };
