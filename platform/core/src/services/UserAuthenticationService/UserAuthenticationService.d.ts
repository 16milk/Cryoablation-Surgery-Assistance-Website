import { PubSubService } from '../_shared/pubSubServiceInterface';
declare class UserAuthenticationService extends PubSubService {
    static readonly EVENTS: {};
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ configuration }: {
            configuration?: {};
        }) => UserAuthenticationService;
    };
    serviceImplementation: {
        _getState: () => void;
        _setUser: () => void;
        _getUser: () => void;
        _getAuthorizationHeader: () => void;
        _handleUnauthenticated: () => void;
        _reset: () => void;
        _set: () => void;
    };
    constructor();
    getState(): void;
    setUser(user: any): void;
    getUser(): void;
    getAuthorizationHeader(): void;
    handleUnauthenticated(): void;
    reset(): void;
    set(state: any): void;
    setServiceImplementation({ getState: getStateImplementation, setUser: setUserImplementation, getUser: getUserImplementation, getAuthorizationHeader: getAuthorizationHeaderImplementation, handleUnauthenticated: handleUnauthenticatedImplementation, reset: resetImplementation, set: setImplementation, }: {
        getState: any;
        setUser: any;
        getUser: any;
        getAuthorizationHeader: any;
        handleUnauthenticated: any;
        reset: any;
        set: any;
    }): void;
}
export default UserAuthenticationService;
