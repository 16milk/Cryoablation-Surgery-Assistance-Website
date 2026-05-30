export default urlUtil;
declare namespace urlUtil {
    export { parse };
    export { queryString };
    export { paramString };
}
declare function parse(toParse: any): lib.ParsedQuery<string>;
declare namespace queryString {
    export { getQueryFilters };
}
declare namespace paramString {
    export { isValidPath };
    export { parseParam };
    export { replaceParam };
}
import lib from 'query-string';
declare function getQueryFilters(location?: {}): {};
declare function isValidPath(path: any): boolean;
declare function parseParam(paramStr: any): string[];
declare function replaceParam(path: string, paramKey: any, paramValue: any): string;
