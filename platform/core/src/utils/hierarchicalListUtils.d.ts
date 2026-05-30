export default hierarchicalListUtils;
/**
 * API
 */
/**
 * Add values to a list hierarchically.
 *  @ For example:
 *    addToList([], 'a', 'b', 'c');
 *  will add the following hierarchy to the list:
 *    a > b > c
 *  resulting in the following array:
 *    [['a', [['b', ['c']]]]]
 * @param {Array} list The target list;
 * @param  {...string} values The values to be hierarchically added to the list;
 * @returns {Array} Returns the provided list possibly updated with the given
 *  values or null when a bad list (not an actual array) is provided
 */
export function addToList(list: any[], ...values: string[]): any[];
/**
 * Retrieves an item from the given hierarchical list based on an index (number)
 * or a path (string).
 *  @ For example:
 *    getItem(list, '1/0/4')
 *  will retrieve the fourth grandchild, from the first child of the second
 *  element of the list;
 * @param {Array} list The source list;
 * @param {string|number} indexOrPath The index of the element inside list
 *  (number) or the path to reach the desired element (string). The slash "/"
 *  character is cosidered the path separator;
 */
export function getItem(list: any[], indexOrPath: string | number): any;
/**
 * Iterates through the provided hierarchical list executing the callback
 * once for each leaf-node of the tree. The ancestors of the leaf-node being
 * visited are passed to the callback function along with the leaf-node in
 * the exact same order they appear on the tree (from root to leaf);
 *  @ For example, if the hierarchy `a > b > c` appears on the tree ("a" being
 *    the root and "c" being the leaf) the callback function will be called as:
 *  callback('a', 'b', 'c');
 * @param {Array} list The hierarchical list to be iterated
 * @param {function} callback The callback which will be executed once for
 *  each leaf-node of the hierarchical list;
 * @returns {Array} Returns the provided list or null for bad arguments;
 */
export function forEach(list: any[], callback: Function): any[];
/**
 * Pretty-print the provided hierarchical list;
 * @param {Array} list The source list;
 * @returns {string} The textual representation of the hierarchical list;
 */
export function print(list: any[]): string;
declare namespace hierarchicalListUtils {
    export { addToList };
    export { getItem };
    export { forEach };
    export { print };
}
