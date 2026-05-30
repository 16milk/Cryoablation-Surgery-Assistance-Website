export class ObjectPath {
    /**
     * Set an object property based on "path" (namespace) supplied creating
     * ... intermediary objects if they do not exist.
     * @param object {Object} An object where the properties specified on path should be set.
     * @param path {String} A string representing the property to be set, e.g. "user.study.series.timepoint".
     * @param value {Any} The value of the property that will be set.
     * @return {Boolean} Returns "true" on success, "false" if any intermediate component of the supplied path
     * ... is not a valid Object, in which case the property cannot be set. No exceptions are thrown.
     */
    static set(object: any, path: string, value: Any): boolean;
    /**
     * Get an object property based on "path" (namespace) supplied traversing the object
     * ... tree as necessary.
     * @param object {Object} An object where the properties specified might exist.
     * @param path {String} A string representing the property to be searched for, e.g. "user.study.series.timepoint".
     * @return {Any} The value of the property if found. By default, returns the special type "undefined".
     */
    static get(object: any, path: string): Any;
    /**
     * Check if the supplied argument is a real JavaScript Object instance.
     * @param object {Any} The subject to be tested.
     * @return {Boolean} Returns "true" if the object is a real Object instance and "false" otherwise.
     */
    static isValidObject(object: Any): boolean;
    static getPathComponents(path: any): string[];
}
export default ObjectPath;
