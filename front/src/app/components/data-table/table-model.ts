import { DetailRef } from '../details/detail.service';
export interface TableColumn {
    key: string;
    label: string;
    get: (row: any) => any;
    sub?: (row: any) => string;
    type?: 'badge' | 'progress' | 'date' | 'money' | 'number';
    filter?: boolean;
    range?: boolean;
    rangeBands?: readonly RangeBand[];
}
export interface RangeBand {
    value: string;
    label: string;
    min: number;
    max?: number;
    excludeMin?: boolean;
    excludeMax?: boolean;
}
export const PRICE_BANDS: readonly RangeBand[] = [
    { value: 'free', label: 'Free', min: 0, max: 0 },
    { value: 'under-50', label: 'Paid · under 50 TND', min: 0, max: 50, excludeMin: true, excludeMax: true },
    { value: '50-100', label: '50–under 100 TND', min: 50, max: 100, excludeMax: true },
    { value: '100-200', label: '100–under 200 TND', min: 100, max: 200, excludeMax: true },
    { value: '200-plus', label: '200 TND and above', min: 200 },
];
export const PROGRESS_BANDS: readonly RangeBand[] = [
    { value: 'not-started', label: 'Not started · 0%', min: 0, max: 0 },
    { value: 'in-progress', label: 'In progress · between 0% and 100%', min: 0, max: 100, excludeMin: true, excludeMax: true },
    { value: 'completed', label: 'Completed · 100%', min: 100, max: 100 },
];
export const SCORE_BANDS: readonly RangeBand[] = [
    { value: 'under-50', label: 'Below 50%', min: 0, max: 50, excludeMax: true },
    { value: '50-70', label: '50%–under 70%', min: 50, max: 70, excludeMax: true },
    { value: '70-90', label: '70%–under 90%', min: 70, max: 90, excludeMax: true },
    { value: '90-100', label: '90%–100%', min: 90, max: 100 },
];
export const RATING_BANDS: readonly RangeBand[] = [5,4,3,2,1].map(stars => ({
    value: String(stars), label: `${stars} ${stars === 1 ? 'star' : 'stars'}`, min: stars, max: stars,
}));
export interface TablePreset {
    label: string;
    columns: TableColumn[];
    detail: (row: any) => DetailRef;
}
export function dateKey(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export interface TableQuery {
    search: string;
    choices: Record<string, string>;
    from: string;
    to: string;
    min: string;
    max: string;
    sort: string;
    band?: string;
}
export function filterRecords(
    records: any[],
    preset: TablePreset,
    q: TableQuery,
): any[] {
    const search = q.search.trim().toLocaleLowerCase(),
        date = preset.columns.find((c) => c.type === 'date'),
        range = preset.columns.find((c) => c.range);
    const rows = records.filter((row) => {
        if (
            search &&
            !preset.columns.some((c) =>
                (String(c.get(row) ?? '') + ' ' + (c.sub?.(row) || ''))
                    .toLocaleLowerCase()
                    .includes(search),
            )
        )
            return false;
        if (
            preset.columns.some(
                (c) =>
                    c.filter &&
                    q.choices[c.key] &&
                    String(c.get(row) ?? '') !== q.choices[c.key],
            )
        )
            return false;
        if (date && (q.from || q.to)) {
            const value = dateKey(date.get(row));
            if (!value || (q.from && value < q.from) || (q.to && value > q.to))
                return false;
        }
        if (range && q.band) {
            const band = range.rangeBands?.find(b => b.value === q.band);
            const raw = range.get(row), value = Number(raw);
            // A selected band never treats missing/invalid amounts as free or zero.
            if (!band || raw == null || raw === '' || typeof raw === 'boolean' || !Number.isFinite(value) ||
                (band.excludeMin ? value <= band.min : value < band.min) ||
                (band.max !== undefined && (band.excludeMax ? value >= band.max : value > band.max))) return false;
        }
        if (range && (q.min !== '' || q.max !== '')) {
            const raw = range.get(row),
                value = Number(raw);
            if (
                raw == null ||
                raw === '' ||
                !Number.isFinite(value) ||
                (q.min !== '' && value < Number(q.min)) ||
                (q.max !== '' && value > Number(q.max))
            )
                return false;
        }
        return true;
    });
    const [key, direction] = q.sort.split(':'),
        column = preset.columns.find((c) => c.key === key);
    if (column)
        rows.sort((a, b) => {
            let x = column.get(a),
                y = column.get(b);
            if (column.type === 'date') {
                x = x ? new Date(x).getTime() : 0;
                y = y ? new Date(y).getTime() : 0;
            }
            const compared = ['number', 'progress', 'money', 'date'].includes(
                column.type || '',
            )
                ? (Number(x) || 0) - (Number(y) || 0)
                : String(x ?? '').localeCompare(String(y ?? ''), undefined, {
                      numeric: true,
                      sensitivity: 'base',
                  });
            return direction === 'desc' ? -compared : compared;
        });
    return rows;
}
