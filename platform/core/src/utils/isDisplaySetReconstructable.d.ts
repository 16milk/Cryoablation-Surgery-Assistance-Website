/**
 * Checks if a series is reconstructable to a 3D volume.
 *
 * @param {Object[]} instances An array of `OHIFInstanceMetadata` objects.
 */
export default function isDisplaySetReconstructable(instances: any[], appConfig: any): {
    value: boolean;
};
export function hasPixelMeasurements(multiFrameInstance: any): boolean;
export function hasOrientation(multiFrameInstance: any): boolean;
export function hasPosition(multiFrameInstance: any): boolean;
export function isNMReconstructable(multiFrameInstance: any): boolean;
export function _isSameOrientation(iop1: any, iop2: any): boolean;
/**
 * Checks for spacing issues.
 *
 * @param {number} spacing The spacing between two frames.
 * @param {number} averageSpacing The average spacing between all frames.
 *
 * @returns {Object} An object containing the issue and extra information if necessary.
 */
export function _getSpacingIssue(spacing: number, averageSpacing: number): any;
export function _getPerpendicularDistance(a: any, b: any): number;
export namespace reconstructionIssues {
    let MISSING_FRAMES: string;
    let IRREGULAR_SPACING: string;
}
export const constructableModalities: string[];
