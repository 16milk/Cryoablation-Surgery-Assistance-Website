/**
 * Adds proxy properties for a limited number of values which are sometimes
 * defined in multiframe instance data.
 *
 * If a requested field is in `metadataFieldsToWrap`:
 *   - It first tries to return the value from the current instance.
 *   - If not found, it attempts to retrieve the value from the `_parentInstance`.
 *   - If still not found, it checks `_parentInstance._shared`.
 *   - If none exist, it returns `undefined`.
 *
 * For all other properties, it behaves like a regular property access.
 *
 * This allows graceful fallback access for DICOM metadata values that might be spread
 * across nested or shared metadata structures.
 *
 * @param {Object} instance - The target instance object to wrap.
 * @returns {Proxy} A proxy-wrapped instance with custom field resolution behavior.
 */
export function addProxyFields(instance: any): ProxyConstructor;
/**
 * fieldProxies has the set of fields which are proxied on a per-field basis
 * to the child element.
 */
export const fieldProxies: string[];
export default addProxyFields;
