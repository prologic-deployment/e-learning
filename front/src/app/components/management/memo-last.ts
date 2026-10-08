/** Component-local derived-data cache. Keys include source identity and every filter;
 * never caches HTTP data or survives an account/component change. */
export function memoLast<T>() {
    let previous: unknown[] = [];
    let cached: T;
    let ready = false;
    return (keys: unknown[], compute: () => T): T => {
        if (
            !ready ||
            keys.length !== previous.length ||
            keys.some((key, i) => key !== previous[i])
        ) {
            cached = compute();
            previous = keys;
            ready = true;
        }
        return cached;
    };
}
