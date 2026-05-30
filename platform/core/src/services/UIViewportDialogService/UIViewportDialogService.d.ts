import { PubSubService } from '../_shared/pubSubServiceInterface';
declare class UIViewportDialogService extends PubSubService {
    static readonly EVENTS: {};
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ configuration }: {
            configuration?: {};
        }) => UIViewportDialogService;
    };
    serviceImplementation: {
        _hide: () => void;
        _show: () => void;
    };
    constructor();
    show({ viewportId, id, type, message, actions, onSubmit, onOutsideClick, onKeyPress }: {
        viewportId: any;
        id: any;
        type: any;
        message: any;
        actions: any;
        onSubmit: any;
        onOutsideClick: any;
        onKeyPress: any;
    }): void;
    hide(): void;
    setServiceImplementation({ hide: hideImplementation, show: showImplementation }: {
        hide: any;
        show: any;
    }): void;
}
export default UIViewportDialogService;
