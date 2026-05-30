declare const generateAcceptHeader: (configAcceptHeader?: string[], requestTransferSyntaxUID?: string, //default to accept all transfer syntax
omitQuotationForMultipartRequest?: boolean) => string[];
export default generateAcceptHeader;
