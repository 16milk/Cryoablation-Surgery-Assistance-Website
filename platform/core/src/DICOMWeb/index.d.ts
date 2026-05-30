export default DICOMWeb;
import getAttribute from './getAttribute.js';
import getAuthorizationHeader from './getAuthorizationHeader';
import getModalities from './getModalities.js';
import getName from './getName.js';
import getNumber from './getNumber.js';
import getString from './getString.js';
declare namespace DICOMWeb {
    export { getAttribute };
    export { getAuthorizationHeader };
    export { getModalities };
    export { getName };
    export { getNumber };
    export { getString };
}
export { getAttribute, getAuthorizationHeader, getModalities, getName, getNumber, getString };
