/**
 * Returns a filter function which filters for measurements belonging to both
 * the study and series.
 */
export declare function filterMeasurementsBySeriesUID(selectedSeries: string[]): (measurement: any) => boolean;
/** A filter that filters for measurements belonging to the study */
export declare function filterMeasurementsByStudyUID(studyUID: any): (measurement: any) => boolean;
/**
 * @returns true for measurements include referencedImageId (coplanar with an image)
 */
export declare function filterPlanarMeasurement(measurement: any): any;
export declare function filterTool(toolName: string): (annotation: any) => boolean;
/** A filter that always returns true */
export declare function filterAny(_measurement: any): boolean;
/** A filter that excludes everything */
export declare function filterNone(_measurement: any): boolean;
/**
 *  Filters the measurements which are found in any of the specified
 * filters.  Strings will be looked up by name.
 */
export declare function filterOr(...filters: any[]): (item: any) => boolean;
/**
 * Filters for additional findings, that is, measurements with
 * a value of type point, and having a referenced image
 */
export declare function filterAdditionalFindings(dm: any): any;
/**
 * Returns a filter that applies the second filter unless the first filter would
 * include the given measurement.
 * That is, (!filterUnless) && filterThen
 */
export declare function filterUnless(filterUnless: any, filterThen: any): (item: any) => any;
/**
 * Returns true if all the filters return true.
 * Any filter can be a string name of a filter on the "this" object
 * called on the final filter call.
 */
export declare function filterAnd(...filters: any[]): any;
/**
 * Returns a filter that returns true if none of the filters supplied return true.
 * Any filter supplied can be a name, in which case hte filter will be retrieved
 * from "this" object on the call.
 *
 * For example, for filterNot("otherFilterName"), if that is called on
 * `{ otherFilterName: filterNone }`
 * then otherFilterName will be called, returning false in this case and
 * filterNot will return true.
 *
 *
 */
export declare function filterNot(...filters: any[]): any;
