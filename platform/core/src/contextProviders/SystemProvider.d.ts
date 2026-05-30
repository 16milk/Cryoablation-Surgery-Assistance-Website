import React from 'react';
import { CommandsManager, HotkeysManager } from '../classes';
import { ExtensionManager } from '../extensions';
import { ServicesManager } from '../services';
interface SystemContextProviderProps {
    children: React.ReactNode | React.ReactNode[] | ((...args: any[]) => React.ReactNode);
    servicesManager: ServicesManager;
    commandsManager: CommandsManager;
    extensionManager: ExtensionManager;
    hotkeysManager: HotkeysManager;
}
export declare const useSystem: () => SystemContextProviderProps;
export declare function SystemContextProvider({ children, servicesManager, commandsManager, extensionManager, hotkeysManager, }: SystemContextProviderProps): React.JSX.Element;
export default SystemContextProvider;
