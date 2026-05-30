export namespace HPMatcher {
    export { match };
}
/**
 * Match a Metadata instance against rules using Validate.js for validation.
 * @param  {InstanceMetadata} metadataInstance Metadata instance object
 * @param  {Array} rules Array of MatchingRules instances (StudyMatchingRule|SeriesMatchingRule|ImageMatchingRule) for the match
 * @param {object} options is an object containing additional information
 * @param {object[]} options.studies is a list of all the studies
 * @param {object[]} options.displaySets is a list of the display sets
 * @return {Object}      Matching Object with score and details (which rule passed or failed)
 */
declare function match(metadataInstance: InstanceMetadata, rules: any[], customAttributeRetrievalCallbacks: any, options: {
    studies: object[];
    displaySets: object[];
}): any;
export {};
