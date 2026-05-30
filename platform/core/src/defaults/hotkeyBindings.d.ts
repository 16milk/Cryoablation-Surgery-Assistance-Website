declare const bindings: ({
    commandName: string;
    commandOptions: {
        toolName: string;
        direction?: undefined;
        presetName?: undefined;
        presetIndex?: undefined;
    };
    label: string;
    keys: string[];
    isEditable: boolean;
    context?: undefined;
} | {
    commandName: string;
    label: string;
    keys: string[];
    isEditable: boolean;
    commandOptions?: undefined;
    context?: undefined;
} | {
    commandName: string;
    label: string;
    keys: string[];
    commandOptions?: undefined;
    isEditable?: undefined;
    context?: undefined;
} | {
    commandName: string;
    commandOptions: {
        direction: number;
        toolName?: undefined;
        presetName?: undefined;
        presetIndex?: undefined;
    };
    label: string;
    keys: string[];
    isEditable: boolean;
    context?: undefined;
} | {
    commandName: string;
    context: string;
    label: string;
    keys: string[];
    isEditable: boolean;
    commandOptions?: undefined;
} | {
    commandName: string;
    commandOptions: {
        presetName: string;
        presetIndex: number;
        toolName?: undefined;
        direction?: undefined;
    };
    label: string;
    keys: string[];
    isEditable?: undefined;
    context?: undefined;
})[];
export default bindings;
