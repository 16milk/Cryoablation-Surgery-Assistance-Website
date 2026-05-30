/**
 * Tab properties that drive which tab group is used for thumbnail display.
 */
export type TabProp = {
    name: string;
    label: string;
    studies: any[];
};
/**
 * Collection of tab properties with studies presorted depending on tab mod.
 * This is used in deciding what thumbnails to show.
 */
export type TabsProps = TabProp[];
/**
 *
 * @param {string[]} primaryStudyInstanceUIDs
 * @param {object[]} studyDisplayList
 * @param {string} studyDisplayList.studyInstanceUid
 * @param {string} studyDisplayList.date
 * @param {string} studyDisplayList.description
 * @param {string} studyDisplayList.modalities
 * @param {number} studyDisplayList.numInstances
 * @param {object[]} displaySets
 * @param {number} recentTimeframe - The number of milliseconds to consider a study recent
 * @returns {TabsProps} tabs - The prop object expected by the StudyBrowser component
 */
export declare function createStudyBrowserTabs(primaryStudyInstanceUIDs: any, studyDisplayList: any, displaySets: any, recentTimeframeMS?: number): TabsProps;
