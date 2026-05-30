export default debounce;
declare function debounce(func: any, wait: any, immediate: any): {
    (...args: any[]): void;
    clearDebounceTimeout(): void;
};
