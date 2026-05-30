export default log;
declare namespace log {
    let error: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    let warn: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    let info: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    let trace: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    let debug: {
        (...data: any[]): void;
        (message?: any, ...optionalParams: any[]): void;
    };
    function time(key: any): void;
    function timeEnd(key: any): void;
    namespace timingKeys {
        let scriptToView: boolean;
    }
}
