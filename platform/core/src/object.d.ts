export default object;
declare namespace object {
    export { getNestedObject };
    export { getShallowObject };
}
declare function getNestedObject(shallowObject: any): {};
declare function getShallowObject(nestedObject: any): {};
