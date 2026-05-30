interface ViewportSize {
    width: number;
    height: number;
    offsetLeft: number;
    offsetTop: number;
    clientRect: DOMRect | null;
    isVisible: boolean;
}
/**
 * Hook that provides viewport size dimensions and monitors for changes
 * @param viewportId - The ID of the viewport to monitor
 * @returns ViewportSize object containing width, height, and visibility info
 */
declare function useViewportSize(viewportId: string): ViewportSize;
export default useViewportSize;
export { useViewportSize };
