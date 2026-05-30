/**
 * Global user information, to be replaced with a  specific version which
 * applies the methods.
 */
export declare let user: {
    userLoggedIn: () => boolean;
    getUserId: () => any;
    getName: () => any;
    getAccessToken: () => any;
    login: () => Promise<unknown>;
    logout: () => Promise<unknown>;
    getData: (key: any) => any;
    setData: (key: any, value: any) => any;
};
/**
 * Interface to clearly present the expected fields to linters when passing the user account
 * struct.
 */
export interface UserAccountInterface {
    userLoggedIn?: () => boolean;
    getUserId?: () => null;
    getName?: () => null;
    getAccessToken?: () => null;
    login?: () => Promise<any>;
    logout?: () => Promise<any>;
    getData?: (key: any) => null;
    setData?: (key: any, value: any) => null;
}
export default user;
