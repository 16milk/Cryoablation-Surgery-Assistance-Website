export default class ProtocolEngine {
    constructor(protocols: any, customAttributeRetrievalCallbacks: any);
    protocols: any;
    customAttributeRetrievalCallbacks: any;
    matchedProtocols: Map<any, any>;
    matchedProtocolScores: {};
    study: any;
    /** Evaluate the hanging protocol matches on the given:
     * @param props.studies is a list of studies to compare against (for priors evaluation)
     * @param props.activeStudy is the current metadata for the study to display.
     * @param props.displaySets are the list of display sets which can be modified.
     */
    run({ studies, displaySets, activeStudy }: {
        studies: any;
        displaySets: any;
        activeStudy: any;
    }): any;
    studies: any;
    displaySets: any;
    /**
     * Return the best matched Protocol to the current study or set of studies
     * @returns {*}
     */
    getBestProtocolMatch(): any;
    /**
     * Populates the MatchedProtocols Collection by running the matching procedure
     */
    updateProtocolMatches(): void;
    /**
     * finds the match results against the given display set or
     * study instance by testing the given rules against this, and using
     * the provided options for testing.
     *
     * @param {*} metaData to match against as primary value
     * @param {*} rules to apply
     * @param {*} options are additional values that can be used for matching
     * @returns
     */
    findMatch(metaData: any, rules: any, options: any): any;
    /**
     * Finds the best protocols from Protocol Store, matching each protocol matching rules
     * with the given study. The best protocol are ordered by score and returned in an array
     * @param  {Object} study StudyMetadata instance object
     * @param {object} options containing additional matching data.
     * @return {Array}       Array of match objects or an empty array if no match was found
     *                       Each match object has the score of the matching and the matched
     *                       protocol
     */
    findMatchByStudy(study: any, options: object): any[];
    _clearMatchedProtocols(): void;
    _largestKeyByValue(obj: any): string;
    _getHighestScoringProtocol(): any;
}
