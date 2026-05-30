export default roundNumber;
/**
 * Truncates decimal points to that there is at least 1+precision significant
 * digits.
 *
 * For example, with the default precision 2 (3 significant digits)
 * * Values larger than 100 show no information after the decimal point
 * * Values between 10 and 99 show 1 decimal point
 * * Values between 1 and 9 show 2 decimal points
 *
 * @param value - to return a fixed measurement value from
 * @param precision - defining how many digits after 1..9 are desired
 */
declare function roundNumber(value: any, precision?: number): any;
