/** Splits a list of strings by commas within the strings */
declare const splitComma: (strings: string[]) => string[];
/**
 * Returns an array of the comma split parameters from the given URL search params
 * @param lowerCaseKey - lower case search parameter value
 * @param params - URLSearchParams
 * @returns Array of comma split items matching, or null
 */
declare const getSplitParam: (lowerCaseKey: string, params?: URLSearchParams) => string[];
export { splitComma, getSplitParam };
