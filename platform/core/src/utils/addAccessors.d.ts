export default addAccessors;
/**
 * Add a proxy object for sqZero or the src[0] element if sqZero is unspecified, AND
 * src is an array of length 1.
 *
 * If sqZero isn't passed in, then assume this is a create call on the destination object
 * itself, by:
 * 1. If not an object, return dest
 * 2. If an array of length != 1, return dest
 * 3. If an array, use dest[0] as sqZero
 * 4. Use dest as sqZero
 *
 * @example
 * src = [{a:5,b:'string', c:null}]
 * addAccessors(src)
 * src.c = 'outerChange'
 * src[0].b='innerChange'
 *
 * assert src.a===5
 * assert src[0].c === 'outerChange'
 * assert src.b === 'innerChange'
 */
declare function addAccessors(dest: any, sqZero: any): any;
