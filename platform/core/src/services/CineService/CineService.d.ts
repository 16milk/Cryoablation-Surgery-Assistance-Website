import { PubSubService } from '../_shared/pubSubServiceInterface';
declare class CineService extends PubSubService {
    static readonly EVENTS: {
        CINE_STATE_CHANGED: string;
    };
    static REGISTRATION: {
        name: string;
        altName: string;
        create: ({ configuration }: {
            configuration?: {};
        }) => CineService;
    };
    serviceImplementation: {};
    startedClips: Map<any, any>;
    closedViewports: Set<unknown>;
    constructor();
    getState(): any;
    setCine({ id, frameRate, isPlaying }: {
        id: any;
        frameRate: any;
        isPlaying: any;
    }): any;
    setIsCineEnabled(isCineEnabled: any): void;
    playClip(element: any, playClipOptions: any): any;
    stopClip(element: any, stopClipOptions: any): any;
    onModeExit(): void;
    getSyncedViewports(viewportId: any): any;
    setViewportCineClosed(viewportId: any): void;
    isViewportCineClosed(viewportId: any): boolean;
    clearViewportCineClosed(viewportId: any): void;
    setServiceImplementation({ getState: getStateImplementation, setCine: setCineImplementation, setIsCineEnabled: setIsCineEnabledImplementation, playClip: playClipImplementation, stopClip: stopClipImplementation, getSyncedViewports: getSyncedViewportsImplementation, }: {
        getState: any;
        setCine: any;
        setIsCineEnabled: any;
        playClip: any;
        stopClip: any;
        getSyncedViewports: any;
    }): void;
}
export default CineService;
