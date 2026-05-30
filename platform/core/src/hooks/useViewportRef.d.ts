import React from 'react';
type ViewportRefsContextType = {
    registerViewport: (viewportId: string, element: HTMLElement) => void;
    unregisterViewport: (viewportId: string) => void;
    getViewportElement: (viewportId: string) => HTMLElement | null;
    viewportRefs: Map<string, HTMLElement>;
};
export declare const ViewportRefsProvider: ({ children }: {
    children: React.ReactNode;
}) => React.FunctionComponentElement<React.ProviderProps<ViewportRefsContextType>>;
export declare const useViewportRefs: () => ViewportRefsContextType;
export declare const useViewportRef: (viewportId: string) => {
    current: HTMLElement;
    register: (element: HTMLElement) => void;
    unregister: () => void;
};
export {};
