import { Types as csTypes } from '@cornerstonejs/core';
type Attributes = Record<string, unknown>;
export type Image = {
    StudyInstanceUID?: string;
    ImagePositionPatient?: csTypes.Point3;
    ImageOrientationPatient?: csTypes.Point3;
};
/**
 * This class defines an ImageSet object which will be used across the viewer. This object represents
 * a list of images that are associated by any arbitrary criteria being thus content agnostic. Besides the
 * main attributes (images and uid) it allows additional attributes to be appended to it (currently
 * indiscriminately, but this should be changed).
 */
declare class ImageSet {
    images: Image[];
    uid: string;
    instances: Image[];
    instance?: Image;
    StudyInstanceUID?: string;
    constructor(images: Image[]);
    load: () => Promise<void>;
    getUID(): string;
    setAttribute(attribute: string, value: unknown): void;
    getAttribute(attribute: string): unknown;
    setAttributes(attributes: Attributes): void;
    getNumImages: () => number;
    getImage(index: number): Image;
    /**
     * Default image sorting. Sorts by the following (in order of priority)
     * 1. Image position (if ImagePositionPatient and ImageOrientationPatient are defined)
     * 2. Sort by a provided sortingCallback Criteria
     * Note: Images are sorted in-place and a reference to the sorted image array is returned.
     *
     * @returns images - reference to images after sorting
     */
    sort(customizationService: any): Image[];
    /**
     * Sort using the provided callback function.
     * Note: Images are sorted in-place and a reference to the sorted image array is returned.
     *
     * @param sortingCallback - sorting function
     * @returns images - reference to images after sorting
     */
    sortBy(sortingCallback: (a: Image, b: Image) => number): Image[];
}
export default ImageSet;
