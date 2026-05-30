/**
 * This service manages multiple monitors or windows.
 */
export declare class MultiMonitorService {
    readonly numberOfScreens: number;
    private windowsConfig;
    private screenConfig;
    private launchWindows;
    private basePath;
    readonly screenNumber: number;
    readonly isMultimonitor: boolean;
    static readonly SOURCE_SCREEN: {
        id: string;
        launch: string;
        screen: any;
        location: {
            screen: any;
            width: number;
            height: number;
            left: number;
            top: number;
        };
    };
    static REGISTRATION: {
        name: string;
        create: ({ configuration, commandsManager }: {
            configuration: any;
            commandsManager: any;
        }) => MultiMonitorService;
    };
    constructor(configuration: any, commandsManager: any);
    run(screenDelta: number, commands: any, options: any): Promise<void>;
    /** Sets the launch windows for later use, shared amongst all windows. */
    setLaunchWindows: (launchWindows: any) => void;
    launchWindow(studyUid: string, screenDelta?: number, hashParams?: string): Promise<any>;
    getWindow(screenNumber: any, hashParam?: string): Promise<any>;
    /**
     * Creates a new window showing the given url by default, or gets an existing
     * window.
     */
    createWindow(screenNumber: any, urlToUse?: string): Promise<Window>;
    /** Launches all the windows using the initial configuration */
    launchAll(): void;
    /**
     * Sets the base path to use for launching other windows, based on the
     * original base path without hash values in order to preserve consistent
     * URLs so that windows are refreshed on relaunch.
     */
    setBasePath(): void;
    /**
     * Try moving the screen to the correct location - this will only work with
     * screens opened with openWindow containing no more than 1 tab.
     */
    onModeEnter(): Promise<void>;
}
