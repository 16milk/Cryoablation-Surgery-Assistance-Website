import HangingProtocolServiceType from '../services/HangingProtocolService';
import CustomizationServiceType from '../services/CustomizationService';
import MeasurementServiceType from '../services/MeasurementService';
import ViewportGridServiceType from '../services/ViewportGridService';
import ToolbarServiceType from '../services/ToolBarService';
import DisplaySetServiceType from '../services/DisplaySetService';
import UINotificationServiceType from '../services/UINotificationService';
import UIModalServiceType from '../services/UIModalService';
import WorkflowStepsServiceType from '../services/WorkflowStepsService';
import CineServiceType from '../services/CineService';
import UserAuthenticationServiceType from '../services/UserAuthenticationService';
import PanelServiceType from '../services/PanelService';
import UIDialogServiceType from '../services/UIDialogService';
import UIViewportDialogServiceType from '../services/UIViewportDialogService';
import StudyPrefetcherServiceType from '../services/StudyPrefetcherService';
import type { MultiMonitorService } from '../services/MultiMonitorService';
import ServicesManagerType from '../services/ServicesManager';
import CommandsManagerType from '../classes/CommandsManager';
import ExtensionManagerType from '../extensions/ExtensionManager';
import Hotkey from '../classes/Hotkey';
import * as CommandTypes from './Command';
import * as ColorTypes from './Color';
import * as ConsumerTypes from './Consumer';
import * as DataSourceTypes from './DataSource';
import * as DataSourceConfigurationAPITypes from './DataSourceConfigurationAPI';
import * as DisplaySetTypes from './DisplaySet';
import * as HangingProtocolTypes from './HangingProtocol';
import * as IPubSubTypes from './IPubSub';
import * as PanelModuleTypes from './PanelModule';
import * as StudyMetadataTypes from './StudyMetadata';
import * as ViewportGridTypes from './ViewportGridType';
declare global {
    namespace AppTypes {
        type ServicesManager = ServicesManagerType;
        type CommandsManager = CommandsManagerType;
        type ExtensionManager = ExtensionManagerType;
        type HangingProtocolService = HangingProtocolServiceType;
        type CustomizationService = CustomizationServiceType;
        type MeasurementService = MeasurementServiceType;
        type DisplaySetService = DisplaySetServiceType;
        type ToolbarService = ToolbarServiceType;
        type ViewportGridService = ViewportGridServiceType;
        type UIModalService = UIModalServiceType;
        type UINotificationService = UINotificationServiceType;
        type WorkflowStepsService = WorkflowStepsServiceType;
        type CineService = CineServiceType;
        type UserAuthenticationService = UserAuthenticationServiceType;
        type UIDialogService = UIDialogServiceType;
        type UIViewportDialogService = UIViewportDialogServiceType;
        type PanelService = PanelServiceType;
        type StudyPrefetcherService = StudyPrefetcherServiceType;
        interface Managers {
            servicesManager?: ServicesManager;
            commandsManager?: CommandsManager;
            extensionManager?: ExtensionManager;
        }
        interface Services {
            hangingProtocolService?: HangingProtocolServiceType;
            customizationService?: CustomizationServiceType;
            measurementService?: MeasurementServiceType;
            displaySetService?: DisplaySetServiceType;
            toolbarService?: ToolbarServiceType;
            viewportGridService?: ViewportGridServiceType;
            uiModalService?: UIModalServiceType;
            uiNotificationService?: UINotificationServiceType;
            workflowStepsService?: WorkflowStepsServiceType;
            cineService?: CineServiceType;
            userAuthenticationService?: UserAuthenticationServiceType;
            uiDialogService?: UIDialogServiceType;
            uiViewportDialogService?: UIViewportDialogServiceType;
            panelService?: PanelServiceType;
            studyPrefetcherService?: StudyPrefetcherServiceType;
            multiMonitorService?: MultiMonitorService;
        }
        interface Config {
            studyBrowserMode?: 'all' | 'primary';
            routerBasename?: string;
            customizationService?: CustomizationServiceType;
            extensions?: string[];
            modes?: string[];
            experimentalStudyBrowserSort?: boolean;
            defaultDataSourceName?: string;
            hotkeys?: Record<string, Hotkey> | Hotkey[];
            preferSizeOverAccuracy?: boolean;
            useNorm16Texture?: boolean;
            useCPURendering?: boolean;
            strictZSpacingForVolumeViewport?: boolean;
            useCursors?: boolean;
            maxCacheSize?: number;
            max3DTextureSize?: number;
            showWarningMessageForCrossOrigin?: boolean;
            showCPUFallbackMessage?: boolean;
            maxNumRequests?: {
                interaction?: number;
                prefetch?: number;
                thumbnail?: number;
                compute?: number;
            };
            maxNumberOfWebWorkers?: number;
            acceptHeader?: string[];
            investigationalUseDialog?: {
                option: 'always' | 'never' | 'configure';
                days?: number;
            };
            groupEnabledModesFirst?: boolean;
            measurementTrackingMode?: 'standard' | 'simplified' | 'none';
            disableConfirmationPrompts?: boolean;
            showPatientInfo?: 'visible' | 'visibleCollapsed' | 'disabled' | 'visibleReadOnly';
            requestTransferSyntaxUID?: string;
            omitQuotationForMultipartRequest?: boolean;
            modesConfiguration?: {
                [key: string]: object;
            };
            showLoadingIndicator?: boolean;
            supportsWildcard?: boolean;
            allowMultiSelectExport?: boolean;
            activateViewportBeforeInteraction?: boolean;
            autoPlayCine?: boolean;
            showStudyList?: boolean;
            whiteLabeling?: Record<string, unknown>;
            httpErrorHandler?: (error: Error) => void;
            dangerouslyUseDynamicConfig?: {
                enabled: boolean;
                regex: RegExp;
            };
            onConfiguration?: (dicomWebConfig: Record<string, unknown>, options: Record<string, unknown>) => Record<string, unknown>;
            dataSources?: Record<string, unknown>;
            oidc?: Record<string, unknown>;
            peerImport?: (moduleId: string) => Promise<Record<string, unknown>>;
            studyPrefetcher?: {
                enabled: boolean;
                displaySetsCount: number;
                maxNumPrefetchRequests: number;
                order: 'closest' | 'downward' | 'upward';
            };
        }
        interface Test {
            services?: Services;
            commandsManager?: CommandsManager;
            extensionManager?: ExtensionManager;
            config?: Config;
        }
        namespace Commands {
            type SimpleCommand = CommandTypes.SimpleCommand;
            type ComplexCommand = CommandTypes.ComplexCommand;
            type Command = CommandTypes.Command;
            type RunCommand = CommandTypes.RunCommand;
            interface Commands extends CommandTypes.Commands {
            }
        }
        type RGB = ColorTypes.RGB;
        type Consumer = ConsumerTypes.Consumer;
        type DataSourceDefinition = DataSourceTypes.DataSourceDefinition;
        namespace DataSourceConfiguration {
            type BaseDataSourceConfigurationAPIItem = DataSourceConfigurationAPITypes.BaseDataSourceConfigurationAPIItem;
            type BaseDataSourceConfigurationAPI = DataSourceConfigurationAPITypes.BaseDataSourceConfigurationAPI;
        }
        type DisplaySet = DisplaySetTypes.DisplaySet;
        type DisplaySetSeriesMetadataInvalidatedEvent = DisplaySetTypes.DisplaySetSeriesMetadataInvalidatedEvent;
        namespace HangingProtocol {
            type DisplaySetInfo = HangingProtocolTypes.DisplaySetInfo;
            type ViewportMatchDetails = HangingProtocolTypes.ViewportMatchDetails;
            type DisplaySetMatchDetails = HangingProtocolTypes.DisplaySetMatchDetails;
            type DisplaySetAndViewportOptions = HangingProtocolTypes.DisplaySetAndViewportOptions;
            type DisplayArea = HangingProtocolTypes.DisplayArea;
            type SetProtocolOptions = HangingProtocolTypes.SetProtocolOptions;
            type HangingProtocolMatchDetails = HangingProtocolTypes.HangingProtocolMatchDetails;
            type ConstraintValue = HangingProtocolTypes.ConstraintValue;
            type Constraint = HangingProtocolTypes.Constraint;
            type MatchingRule = HangingProtocolTypes.MatchingRule;
            type ViewportLayoutOptions = HangingProtocolTypes.ViewportLayoutOptions;
            type ViewportStructure = HangingProtocolTypes.ViewportStructure;
            type DisplaySetSelector = HangingProtocolTypes.DisplaySetSelector;
            type SyncGroup = HangingProtocolTypes.SyncGroup;
            type CustomOptionAttribute<T> = HangingProtocolTypes.CustomOptionAttribute<T>;
            type CustomOption<T> = HangingProtocolTypes.CustomOption<T>;
            type initialImageOptions = HangingProtocolTypes.initialImageOptions;
            type ViewportOptions = HangingProtocolTypes.ViewportOptions;
            type DisplaySetOptions = HangingProtocolTypes.DisplaySetOptions;
            type Viewport = HangingProtocolTypes.Viewport;
            type StageStatus = HangingProtocolTypes.StageStatus;
            type StageActivation = HangingProtocolTypes.StageActivation;
            type ProtocolStage = HangingProtocolTypes.ProtocolStage;
            type ProtocolNotifications = HangingProtocolTypes.ProtocolNotifications;
            type Protocol = HangingProtocolTypes.Protocol;
            type ProtocolGenerator = HangingProtocolTypes.ProtocolGenerator;
            type HPInfo = HangingProtocolTypes.HPInfo;
        }
        namespace PubSub {
            type IPubSub = IPubSubTypes.default;
            type Subscription = IPubSubTypes.Subscription;
        }
        namespace PanelModule {
            type Panel = PanelModuleTypes.Panel;
            type ActivatePanelTriggers = PanelModuleTypes.ActivatePanelTriggers;
            type PanelEvent = PanelModuleTypes.PanelEvent;
            type ActivatePanelEvent = PanelModuleTypes.ActivatePanelEvent;
        }
        namespace StudyMetadata {
            type PatientMetadata = StudyMetadataTypes.PatientMetadata;
            type StudyMetadata = StudyMetadataTypes.StudyMetadata;
            type SeriesMetadata = StudyMetadataTypes.SeriesMetadata;
            type InstanceMetadata = StudyMetadataTypes.InstanceMetadata;
        }
        namespace ViewportGrid {
            type Viewport = ViewportGridTypes.GridViewport;
            type Layout = ViewportGridTypes.Layout;
            type State = ViewportGridTypes.ViewportGridState;
            type Viewports = ViewportGridTypes.GridViewports;
            type GridViewportOptions = ViewportGridTypes.GridViewportOptions;
        }
    }
    export interface PresentationIds {
    }
    export type withAppTypes<T = object> = T & AppTypes.Services & AppTypes.Managers & {
        [key: string]: unknown;
    } & AppTypes.Config;
    export type withTestTypes<T = object> = T & AppTypes.Test;
}
