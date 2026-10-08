import { DetailRef } from '../details/detail.service';
export interface TableColumn {
    key: string;
    label: string;
    get: (row: any) => any;
    sub?: (row: any) => string;
    type?: 'badge' | 'progress' | 'date' | 'money' | 'number';
    filter?: boolean;
    range?: boolean;
}
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
