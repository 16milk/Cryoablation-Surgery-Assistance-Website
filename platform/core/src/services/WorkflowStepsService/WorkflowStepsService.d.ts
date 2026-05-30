import { CommandsManager } from '../../classes';
import { ExtensionManager } from '../../extensions';
import { PubSubService } from '../_shared/pubSubServiceInterface';
export declare const EVENTS: {
    ACTIVE_STEP_CHANGED: string;
    STEPS_CHANGED: string;
};
type CommandCallback = {
    commandName: string;
    options: Record<string, unknown>;
};
export type WorkflowStep = {
    id: string;
    name: string;
    toolbarButtons?: {
        buttonSection: string;
        buttons: string[];
    }[];
    hangingProtocol?: {
        protocolId: string;
        stageId?: string;
    };
    layout?: {
        panels: {
            left?: string[];
            right?: string[];
        };
    };
    onEnter: () => void | CommandCallback[];
    onExit: () => void | CommandCallback[];
};
declare class WorkflowStepsService extends PubSubService {
    private _extensionManager;
    private _servicesManager;
    private _commandsManager;
    private _workflowSteps;
    private _activeWorkflowStep;
    constructor(extensionManager: ExtensionManager, commandsManager: CommandsManager, servicesManager: AppTypes.ServicesManager);
    get workflowSteps(): WorkflowStep[];
    get activeWorkflowStep(): WorkflowStep;
    addWorkflowSteps(workflowSteps: WorkflowStep[]): void;
    private _updateToolBar;
    private _updatePanels;
    private _updateHangingProtocol;
    private _invokeCallbacks;
    setActiveWorkflowStep(workflowStepId: string): void;
    reset(): void;
    onModeEnter(): void;
    static REGISTRATION: {
        name: string;
        create: ({ extensionManager, commandsManager, servicesManager }: {
            extensionManager: any;
            commandsManager: any;
            servicesManager: any;
        }) => WorkflowStepsService;
    };
}
export { WorkflowStepsService as default, WorkflowStepsService };
