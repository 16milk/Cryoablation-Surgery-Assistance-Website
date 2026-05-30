/**
 * Defines a displaySet message, that could be any pf the potential problems of a displaySet.
 *
 * @property {number} id - message ID.
 * @property {Record<string, any>} args - message arguments, will be passed to the translation function when the message is rendered.
 */
declare class DisplaySetMessage {
    id: number;
    args: Record<string, any>;
    static CODES: {
        NO_VALID_INSTANCES: number;
        NO_POSITION_INFORMATION: number;
        NOT_RECONSTRUCTABLE: number;
        MULTIFRAME_NO_PIXEL_MEASUREMENTS: number;
        MULTIFRAME_NO_ORIENTATION: number;
        MULTIFRAME_NO_POSITION_INFORMATION: number;
        MISSING_FRAMES: number;
        IRREGULAR_SPACING: number;
        INCONSISTENT_DIMENSIONS: number;
        INCONSISTENT_COMPONENTS: number;
        INCONSISTENT_ORIENTATIONS: number;
        INCONSISTENT_POSITION_INFORMATION: number;
        UNSUPPORTED_DISPLAYSET: number;
        UNSUPPORTED_SOP_CLASS_UID: number;
        MISSING_SOP_CLASS_UID: number;
    };
    constructor(id: number, args?: Record<string, any>);
}
/**
 * Defines a list of displaySet messages
 */
declare class DisplaySetMessageList {
    messages: any[];
    addMessage(messageId: number, args?: Record<string, any>): void;
    size(): number;
    includesMessage(messageId: number): boolean;
    includesAllMessages(messageIdList: number[]): boolean;
}
export { DisplaySetMessage, DisplaySetMessageList };
