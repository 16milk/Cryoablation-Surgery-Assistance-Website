export declare const compare: (a: any, b: any) => 0 | 1 | -1;
/**
 * Adds a comparison for same series display sets.
 * Supply null for compareF to delete the function.
 */
export declare function addSameSeriesCompare(name: string, compareF: (a: any, b: any) => number, priority: number): void;
/**
 * When the "series" sort is used on display sets, it is possible to get the
 * same series twice.  This method compares two display sets from the same series
 *
 * If both display sets have the same compareSameSeries name, then the
 * function registered for that name will be used.
 *
 * If they differ, then the priority between the two functions will be used.
 *
 * Otherwise, the instance compare will be used on the default instance.
 *
 * This provides a configurable well defined sorting order.
 */
export declare const compareSameSeriesDisplaySet: (a: any, b: any) => number;
export declare const compareSeriesUID: (a: any, b: any) => number;
export declare const compareSeriesDateTime: (a: any, b: any) => number;
export declare const defaultSeriesSort: (a: any, b: any) => number;
/**
 * Series sorting criteria: series considered low priority are moved to the end
 * of the list and series number is used to break ties
 * @param {Object} firstSeries
 * @param {Object} secondSeries
 */
export declare function seriesInfoSortingCriteria(firstSeries: any, secondSeries: any): number;
export declare const seriesSortCriteria: {
    default: typeof seriesInfoSortingCriteria;
    seriesInfoSortingCriteria: typeof seriesInfoSortingCriteria;
    compareSameSeries: (a: any, b: any) => number;
    compareSeriesDateTime: (a: any, b: any) => number;
    compareSeriesUID: (a: any, b: any) => number;
};
/**
 * Compares two instances first by instance number, and then by
 * sop and frame numbers.
 * Handles undefined values for use with display set comparison.
 */
export declare const sortByInstanceNumber: (a: any, b: any) => number;
export declare const instancesSortCriteria: {
    default: (a: any, b: any) => number;
    sortByInstanceNumber: (a: any, b: any) => number;
};
export declare const sortingCriteria: {
    seriesSortCriteria: {
        default: typeof seriesInfoSortingCriteria;
        seriesInfoSortingCriteria: typeof seriesInfoSortingCriteria;
        compareSameSeries: (a: any, b: any) => number;
        compareSeriesDateTime: (a: any, b: any) => number;
        compareSeriesUID: (a: any, b: any) => number;
    };
    instancesSortCriteria: {
        default: (a: any, b: any) => number;
        sortByInstanceNumber: (a: any, b: any) => number;
    };
};
export type SortDisplaySetsCopyOptions = {
    /**
     * Display sets for this study are sorted by series criteria and listed first;
     * all other display sets follow in their original relative order.
     */
    studyInstanceUIDFirst?: string;
    /** Defaults to {@link seriesSortCriteria.default} (not app customization). */
    seriesSortingCriteria?: (a: any, b: any) => number;
};
/**
 * Returns a new array of display sets sorted by default series order
 * ({@link seriesSortCriteria.default} / {@link seriesInfoSortingCriteria}), not
 * the app customization. Does not mutate the input.
 *
 * With `studyInstanceUIDFirst`, only that study's display sets are sorted; they
 * are placed before the rest, which keeps source order (e.g. load order).
 */
export declare function sortDisplaySetsCopy(displaySets: any, options?: SortDisplaySetsCopyOptions | null): any[];
/**
 * Sorts given series or display sets
 * The default criteria is based on series number in ascending order.
 *
 * @param series -  List of series (modified in place)
 * @param seriesSortingCriteria - method for sorting
 * @returns sorted series object
 */
export declare const sortStudySeries: (series: any, seriesSortingCriteria?: typeof seriesInfoSortingCriteria, sortFunction?: any) => any;
/**
 * Sorts given instancesList (given param is modified)
 * The default criteria is based on instance number in ascending order.
 *
 * @param {Array} instancesList List of series
 * @param {function} instancesSortingCriteria method for sorting
 * @returns {Array} sorted instancesList object
 */
export declare const sortStudyInstances: (instancesList: any, instancesSortingCriteria?: (a: any, b: any) => number) => any;
/**
 * Sorts the series and instances (by default) inside a study instance based on sortingCriteria (given param is modified)
 * The default criteria is based on series and instance numbers in ascending order.
 *
 * @param {Object} study The study instance
 * @param {boolean} [deepSort = true] to sort instance also
 * @param {function} [seriesSortingCriteria = seriesSortCriteria.default] method for sorting series
 * @param {function} [instancesSortingCriteria = instancesSortCriteria.default] method for sorting instances
 * @returns {Object} sorted study object
 */
export declare function sortStudy(study: any, deepSort?: boolean, seriesSortingCriteria?: typeof seriesInfoSortingCriteria, instancesSortingCriteria?: (a: any, b: any) => number): any;
export declare function isValidForPositionSort(images: any): boolean;
/**
 * Sort by image position, calculated using imageOrientationPatient and ImagePositionPatient
 * If imageOrientationPatient or ImagePositionPatient is not available, Images will be sorted by the provided sortingCriteria
 * Note: Images are sorted in-place and a reference to the sorted image array is returned.
 *
 * @returns images - reference to images after sorting
 */
export declare const sortImagesByPatientPosition: (images: any) => any;
export default sortStudy;
