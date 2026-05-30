/**
 * Converts a blob to a URL and downloads immediate
 */
export declare function downloadBlob(content: any, options?: any): void;
/**
 * Trigger file download from an array buffer
 * @param buffer
 * @param filename
 */
export declare function downloadDicom(buffer: ArrayBuffer, options: any): void;
/**
 * Downloads a URL
 */
export declare function downloadUrl(url: any, options?: any): void;
export declare function downloadCsv(csvString: string, options?: any): void;
