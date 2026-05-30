/**
 * returns equal if the two arrays are identical within the
 * given tolerance.
 *
 * @param v1 - The first array of values
 * @param v2 - The second array of values.
 * @param tolerance - The acceptable tolerance, the default is 0.00001
 *
 * @returns True if the two values are within the tolerance levels.
 */
export default function isEqualWithin(v1: number[] | Float32Array, v2: number[] | Float32Array, tolerance?: number): boolean;
