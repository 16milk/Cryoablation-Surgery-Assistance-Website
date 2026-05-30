export default function makeDeferred(): Readonly<{
    promise: Promise<any>;
    resolve: undefined;
    reject: undefined;
}>;
