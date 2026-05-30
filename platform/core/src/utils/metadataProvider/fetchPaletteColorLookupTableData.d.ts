/**
 * Gets the palette color data for the specified tag - red/green/blue,
 * either from the given UID or from the tag itself.
 * Returns an array if the data is immediately available, or a promise
 * which resolves to the data if the data needs to be loaded.
 * Returns undefined if the palette isn't specified.
 *
 * @param {*} item containing the palette colour data and description
 * @param {*} tag is the tag for the palette data
 * @param {*} descriptorTag is the tag for the descriptor
 * @returns Array view containing the palette data, or a promise to return one.
 * Returns undefined if the palette data is absent.
 */
export default function fetchPaletteColorLookupTableData(item: any, tag: any, descriptorTag: any): any;
