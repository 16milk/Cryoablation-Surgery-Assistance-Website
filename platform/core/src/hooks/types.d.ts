export interface ToolbarButtonActions {
    lockItem: (itemId: string, viewportId?: string) => void;
    unlockItem: (itemId: string, viewportId?: string) => void;
    toggleLock: (itemId: string, viewportId?: string) => void;
    isItemLocked: (itemId: string, viewportId?: string) => boolean;
    showItem: (itemId: string, viewportId?: string) => void;
    hideItem: (itemId: string, viewportId?: string) => void;
    toggleVisibility: (itemId: string, viewportId?: string) => void;
    isItemVisible: (itemId: string, viewportId?: string) => boolean;
    openItem: (itemId: string, viewportId?: string) => void;
    closeItem: (itemId: string, viewportId?: string) => void;
    closeAllItems: (viewportId?: string) => void;
    isItemOpen: (itemId: string, viewportId?: string) => boolean;
    evaluateButtonForViewport: (itemId: string, viewportId?: string) => any;
}
export interface ToolbarHookReturn extends ToolbarButtonActions {
    toolbarButtons: any[];
    onInteraction: (args: any) => void;
}
