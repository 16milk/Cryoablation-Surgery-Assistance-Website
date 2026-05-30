import { PubSubService } from '../_shared/pubSubServiceInterface';
declare const EVENTS: {
    MEASUREMENT_UPDATED: string;
    INTERNAL_MEASUREMENT_UPDATED: string;
    MEASUREMENT_ADDED: string;
    RAW_MEASUREMENT_ADDED: string;
    MEASUREMENT_REMOVED: string;
    MEASUREMENTS_CLEARED: string;
    /**
     *  Indicate some viewport should be jumped to.  This will have to be implemented
     * by a single handler that can look at all viewports to decide who should handle it.
     */
    JUMP_TO_MEASUREMENT: string;
};
declare const VALUE_TYPES: {
    ANGLE: string;
    POLYLINE: string;
    POINT: string;
    BIDIRECTIONAL: string;
    ELLIPSE: string;
    RECTANGLE: string;
    MULTIPOINT: string;
    CIRCLE: string;
    ROI_THRESHOLD: string;
    ROI_THRESHOLD_MANUAL: string;
};
export type MeasurementFilter = (measurement: any) => boolean;
/**
 * MeasurementService class that supports source management and measurement management.
 * Sources can be any library that can provide "annotations" (e.g. cornerstone-tools, cornerstone, etc.)
 * The flow, is that by creating a source and mappings (annotation <-> measurement), we
 * can convert back and forth between the two. MeasurementPanel in OHIF uses the measurement service
 * to manage the measurements, and any edit to the measurements will be reflected back at the
 * library level state (e.g. cornerstone-tools, cornerstone, etc.) by converting the
 * edited measurements back to the original annotations and then updating the annotations.
 *
 * Note and Todo: We should be able to support measurements that are composed of multiple
 * annotations, but that is not the case at the moment.
 */
declare class MeasurementService extends PubSubService {
    static REGISTRATION: {
        name: string;
        altName: string;
        create: (_options: any) => MeasurementService;
    };
    static readonly EVENTS: {
        MEASUREMENT_UPDATED: string;
        INTERNAL_MEASUREMENT_UPDATED: string;
        MEASUREMENT_ADDED: string;
        RAW_MEASUREMENT_ADDED: string;
        MEASUREMENT_REMOVED: string;
        MEASUREMENTS_CLEARED: string;
        /**
         *  Indicate some viewport should be jumped to.  This will have to be implemented
         * by a single handler that can look at all viewports to decide who should handle it.
         */
        JUMP_TO_MEASUREMENT: string;
    };
    static VALUE_TYPES: {
        ANGLE: string;
        POLYLINE: string;
        POINT: string;
        BIDIRECTIONAL: string;
        ELLIPSE: string;
        RECTANGLE: string;
        MULTIPOINT: string;
        CIRCLE: string;
        ROI_THRESHOLD: string;
        ROI_THRESHOLD_MANUAL: string;
    };
    readonly VALUE_TYPES: {
        ANGLE: string;
        POLYLINE: string;
        POINT: string;
        BIDIRECTIONAL: string;
        ELLIPSE: string;
        RECTANGLE: string;
        MULTIPOINT: string;
        CIRCLE: string;
        ROI_THRESHOLD: string;
        ROI_THRESHOLD_MANUAL: string;
    };
    private measurements;
    private isMeasurementDeletedIndividually;
    private sources;
    private mappings;
    constructor();
    /**
     * Adds the given schema to the measurement service schema list.
     * This method should be used to add custom tool schema to the measurement service.
     * @param {Array} schema schema for validation
     */
    addMeasurementSchemaKeys(schema: any): void;
    /**
     * Adds the given valueType to the measurement service valueType object.
     * This method should be used to add custom valueType to the measurement service.
     * @param {*} valueType
     * @returns
     */
    addValueType(valueType: any): void;
    /**
     * Gets measurements, optionally filtered by the filter
     * function.
     *
     * @return {Measurement[]} Array of measurements
     */
    getMeasurements(filter?: MeasurementFilter): any[];
    /**
     * Get specific measurement by its uid.
     *
     * @param {string} uid measurement uid
     * @return {Measurement} Measurement instance
     */
    getMeasurement(measurementUID: string): any;
    setMeasurementSelected(measurementUID: string, selected: boolean): void;
    /**
     * Create a new source.
     *
     * @param {string} name Name of the source
     * @param {string} version Source name
     * @return {MeasurementSource} Measurement source instance
     */
    createSource(name: any, version: any): any;
    getSource(name: any, version: any): any;
    getSourceMappings(name: any, version: any): any;
    /**
     * Add a new measurement matching criteria along with mapping functions.
     *
     * @param {MeasurementSource} source Measurement source instance
     * @param {string} annotationType annotation type to match which can be e.g., Length, Bidirectional, etc.
     * @param {MatchingCriteria} matchingCriteria The matching criteria
     * @param {Function} toAnnotationSchema Mapping function to annotation schema
     * @param {Function} toMeasurementSchema Mapping function to measurement schema
     * @return void
     */
    addMapping(source: any, annotationType: any, matchingCriteria: any, toAnnotationSchema: any, toMeasurementSchema: any): void;
    /**
     * Get annotation for specific source.
     *
     * @param {MeasurementSource} source Measurement source instance
     * @param {string} annotationType The source annotationType
     * @param {string} measurementUID The measurement service measurement uid
     * @return {Object} Source measurement schema
     */
    getAnnotation(source: any, annotationType: any, measurementUID: any): any;
    update(measurementUID: string, measurement: any, notYetUpdatedAtSource?: boolean): any;
    /**
     * Add a raw measurement into a source so that it may be
     * Converted to/from annotation in the same way. E.g. import serialized data
     * of the same form as the measurement source.
     * @param {MeasurementSource} source The measurement source instance.
     * @param {string} annotationType The source annotationType you want to add the measurement to.
     * @param {object} data The data you wish to add to the source.
     * @param {function} toMeasurementSchema A function to get the `data` into the same shape as the source annotationType.
     */
    addRawMeasurement(source: any, annotationType: any, data: any, toMeasurementSchema: any, dataSource?: {}): any;
    /**
     * Adds or update persisted measurements.
     *
     * @param {MeasurementSource} source The measurement source instance
     * @param {string} annotationType The source annotationType
     * @param {EventDetail} sourceAnnotationDetail for the annotation event
     * @param {boolean} isUpdate is this an update or an add/completed instead?
     * @return {string} A measurement uid
     */
    annotationToMeasurement(source: any, annotationType: any, sourceAnnotationDetail: any, isUpdate?: boolean): any;
    /**
     * Recursively searches for any attribute at any level in the object
     * @param {any} obj The object to search
     * @param {string} attributeName The name of the attribute to find
     * @returns {any} The attribute value if found, undefined otherwise
     */
    private findAttributeRecursively;
    /**
     * Adds an unmapped measurement to the measurement service.
     *
     * @param {any} sourceAnnotationDetail The source annotation detail
     * @param {any} source The source
     */
    private addUnmappedMeasurement;
    /**
     * Removes a measurement and broadcasts the removed event.
     *
     * @param {string} measurementUID The measurement uid
     */
    remove(measurementUID: string): void;
    /**
     * Remove multiple measurements at once.
     */
    removeMany(measurementUIDs: string[]): void;
    /**
     * Clears measurements that match the filter, defaulting to all of them.
     * That allows, for example, clearing all of a single studies measurements
     * without needing to clear other measurements.
     */
    clearMeasurements(filter?: MeasurementFilter): void;
    /**
     * Called after the mode.onModeExit is called to reset the state.
     * To store measurements for later use, store them in the mode.onModeExit
     * and restore them in the mode onModeEnter.
     */
    onModeExit(): void;
    /**
     * This method calls the subscription for JUMP_TO_MEASUREMENT
     */
    jumpToMeasurement(viewportId: string, measurementUID: string): void;
    _getSourceUID(name: any, version: any): string;
    _getMappingByMeasurementSource(measurement: any, annotationType: any): any;
    /**
     * Get measurement mapping function if matching criteria.
     *
     * @param {MeasurementSource} source Measurement source instance
     * @param {string} annotationType The source annotationType
     * @param {Measurement} measurement The measurement service measurement
     * @return {Object} The mapping based on matched criteria
     */
    _getMatchingMapping(source: any, annotationType: any, measurement: any): any;
    /**
     * Returns formatted string with source info.
     *
     * @param {MeasurementSource} source Measurement source
     * @return {string} Source information
     */
    _getSourceToString(source: any): string;
    /**
     * Checks if given source is valid.
     *
     * @param {MeasurementSource} source Measurement source
     * @return {boolean} Measurement source validation
     */
    _isValidSource(source: any): any;
    /**
     * Checks if a given source has mappings.
     *
     * @param {MeasurementSource} source The measurement source
     * @return {boolean} Validation if source has mappings
     */
    _sourceHasMappings(source: any): any;
    /**
     * Check if a given measurement data is valid.
     *
     * @param {Measurement} measurementData Measurement data
     * @return {boolean} Measurement validation
     */
    _isValidMeasurement(measurementData: any): boolean;
    /**
     * Check if a given measurement service event is valid.
     *
     * @param {string} eventName The name of the event
     * @return {boolean} Event name validation
    //  */
    /**
     * Converts object of objects to array.
     *
     * @return {Array} Array of objects
     */
    _arrayOfObjects: (obj: any) => {
        [x: string]: unknown;
    }[];
    toggleLockMeasurement(measurementUID: string): void;
    toggleVisibilityMeasurement(measurementUID: string, visibility?: boolean): void;
    toggleVisibilityMeasurementMany(measurementUIDs: string[], visibility?: boolean): void;
    updateColorMeasurement(measurementUID: string, color: number[]): void;
    setIsMeasurementDeletedIndividually: (isDeletedIndividually: any) => void;
    getIsMeasurementDeletedIndividually: () => boolean;
}
export default MeasurementService;
export { EVENTS, VALUE_TYPES };
