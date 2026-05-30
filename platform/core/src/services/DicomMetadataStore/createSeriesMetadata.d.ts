export default createSeriesMetadata;
declare function createSeriesMetadata(SeriesInstanceUID: any): {
    SeriesInstanceUID: any;
    instances: any[];
    addInstance: (newInstance: any) => void;
    addInstances: (newInstances: any) => void;
    getInstance: (SOPInstanceUID: any) => any;
};
