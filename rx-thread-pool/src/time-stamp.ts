const startTS = Date.now();

export function ts(): string {
    return (Date.now() - startTS) + ": ";
}