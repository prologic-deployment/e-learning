const { test } = require("node:test"),
    assert = require("node:assert/strict"),
    fs = require("node:fs"),
    ts = require("typescript");
const decorator = () => (target) => target;
const angular = {
    Component: decorator,
    Input: decorator,
    Output: decorator,
    ViewChild: decorator,
    ChangeDetectionStrategy: { OnPush: 0 },
    EventEmitter: class {
        emit() {}
    },
};
function load(file) {
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
            experimentalDecorators: true,
        },
    }).outputText;
    const module = { exports: {} };
    new Function("require", "module", "exports", code)(
        (name) =>
            name === "@angular/core"
                ? angular
                : name.endsWith("memo-last")
                  ? load("src/app/components/management/memo-last.ts")
                  : name.endsWith("table-model")
                    ? load("src/app/components/data-table/table-model.ts")
                    : name.endsWith("table-presets")
                      ? load("src/app/components/data-table/table-presets.ts")
                      : {},
        module,
        module.exports,
    );
    return module.exports;
}
test("derived-data cache computes once and invalidates every changed key", () => {
    let calls = 0;
    const memo = load("src/app/components/management/memo-last.ts").memoLast();
    const source = [];
    const calc = () => {
        calls++;
        return [];
    };
    const a = memo([source, "all"], calc);
    for (let i = 0; i < 50; i++) assert.equal(memo([source, "all"], calc), a);
    assert.equal(calls, 1);
    memo([source, "new"], calc);
    memo([[], "new"], calc);
    assert.equal(calls, 3);
    assert.deepEqual(memo([], calc), []);
});
test("record filters/sorting reuse results without mutating inputs; pagination clamps after changes", () => {
    const C = load(
            "src/app/components/data-table/data-table.component.ts",
        ).DataTableComponent,
        c = new C();
    c.preset = load(
        "src/app/components/data-table/table-presets.ts",
    ).TABLES.courses;
    c.size = 10;
    c.records = Array.from({ length: 18 }, (_, i) => ({
        _id: String(i),
        title: `Course ${String(i).padStart(2, "0")}`,
        isApproved: i % 2 === 0,
    }));
    const original = c.records.map((r) => r._id);
    const derived = c.filtered;
    for (let i = 0; i < 20; i++) {
        assert.equal(c.filtered, derived);
        assert.equal(c.pages, 2);
        assert.equal(c.visible.length, 10);
    }
    c.sort = "name:desc";
    assert.notEqual(c.filtered, derived);
    assert.deepEqual(
        c.records.map((r) => r._id),
        original,
    );
    c.choices = { status: "Published" };
    assert.equal(c.filtered.length, 9);
    c.query = "17";
    assert.equal(c.filtered.length, 0);
    c.query = "";
    c.page = 3;
    assert.equal(c.current, 1);
    c.records = c.records.slice(0, 2);
    assert.equal(c.current, 1);
});
test("operations mapping retains authorized detail IDs and invalidates for role/filter changes", () => {
    const C = load(
            "src/app/components/analytics/operations-overview.component.ts",
        ).OperationsOverviewComponent,
        c = new C();
    c.stats = {
        courseStats: [
            {
                course: { id: "course-id", title: "Course" },
                totalEnrollments: 2,
            },
        ],
        memberStats: [
            {
                user: { _id: "user-id", firstname: "Sam", lastname: "Student" },
                totalCourses: 1,
            },
        ],
        topCourses: [
            { courseId: "popular-id", courseTitle: "Popular", enrollments: 5 },
        ],
    };
    assert.equal(c.rows[0].id, "course-id");
    const rows = c.rows;
    assert.equal(c.rows, rows);
    c.role = "manager";
    assert.equal(c.rows[0].id, "user-id");
    c.role = "admin";
    assert.equal(c.rows[0].id, "popular-id");
    assert.equal(c.tablePreset.detail(c.rows[0]).id, "popular-id");
});

test("filters intersect categorical, inclusive dates and numeric bounds; reset and invalid ranges", () => {
    const { DataTableComponent: C } = load(
            "src/app/components/data-table/data-table.component.ts",
        ),
        c = new C();
    c.preset = {
        label: "Test",
        detail: (r) => ({ kind: "course", id: r.id }),
        columns: [
            { key: "name", label: "Name", get: (r) => r.name },
            { key: "state", label: "State", filter: true, get: (r) => r.state },
            { key: "date", label: "Date", type: "date", get: (r) => r.date },
            {
                key: "score",
                label: "Score",
                type: "number",
                range: true,
                get: (r) => r.score,
            },
        ],
    };
    c.records = [
        {
            id: "1",
            name: "Alpha",
            state: "Open",
            date: "2026-10-08T12:00:00",
            score: 70,
        },
        {
            id: "2",
            name: "Beta",
            state: "Closed",
            date: "2026-10-08T13:00:00",
            score: 90,
        },
        { id: "3", name: "Gamma", state: "Open", date: null, score: null },
    ];
    c.choices = { state: "Open" };
    c.from = "2026-10-08";
    c.to = "2026-10-08";
    c.min = "70";
    c.max = "70";
    assert.deepEqual(
        c.filtered.map((r) => r.id),
        ["1"],
    );
    c.query = "Beta";
    assert.equal(c.filtered.length, 0);
    c.reset();
    assert.equal(c.filtered.length, 3);
    assert.equal(c.activeFilters, 0);
    c.min = "90";
    c.max = "70";
    assert.ok(c.rangeError);
    assert.equal(c.filtered.length, 0);
    c.reset();
    c.from = "2026-10-09";
    c.to = "2026-10-08";
    assert.ok(c.rangeError);
});
