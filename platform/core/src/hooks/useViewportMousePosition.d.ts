interface NormalizedBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}
interface MousePosition {
    x: number;
    y: number;
    isInViewport: boolean;
    relativeX: number;
    relativeY: number;
    isWithinNormalizedBox?: (normalizedBox: NormalizedBox) => boolean;
}
declare function useViewportMousePosition(viewportId: string): MousePosition;
export default useViewportMousePosition;
export { useViewportMousePosition };
