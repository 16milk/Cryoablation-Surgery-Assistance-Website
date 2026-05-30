export default string;
declare namespace string {
    export { search };
    export { encodeId };
}
declare function search(object: any, query: any, property?: any, result?: any[]): any[];
declare function encodeId(input: any): string;
