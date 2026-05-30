import { ButtonProps } from '../types';
export declare const buildButtonCommands: (buttonProps: ButtonProps, baseArgs: Record<string, unknown>, { servicesManager, commandsManager }: AppTypes.Managers) => Array<() => unknown>;
