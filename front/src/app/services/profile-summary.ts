/** Merge display fields only; profile responses must never replace session claims. */
export function mergeProfileSummary(current: any, profile: any): any {
    const currentId = current?.id || current?._id;
    const profileId = profile?.id || profile?._id;
    if (!currentId || !profileId || String(currentId) !== String(profileId)) return current;
    const next = { ...current };
    for (const key of ['firstname', 'lastname', 'email', 'avatar']) {
        if (typeof profile[key] === 'string') next[key] = profile[key];
        else if (key === 'avatar' && profile[key] === null) next.avatar = '';
    }
    return next;
}
export function profilePhotoUrl(value: unknown, backend: string): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    if (/^https?:\/\//i.test(value)) return value;
    if (/^\/(?!\/)/.test(value) || /^uploads\//.test(value)) {
        return backend.replace(/\/$/, '') + '/' + value.replace(/^\//, '');
    }
    return '';
}
