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
            "src/app/components/management/record-table.component.ts",
        ).RecordTableComponent,
        c = new C();
    c.records = Array.from({ length: 18 }, (_, i) => ({
        _id: String(i),
        title: `Course ${String(i).padStart(2, "0")}`,
        isApproved: i % 2 === 0,
    }));
    const original = c.records.map((r) => r._id);
    const derived = c.filtered;
    for (let i = 0; i < 20; i++) {
        assert.equal(c.filtered, derived);
        assert.equal(c.pages, 3);
        assert.equal(c.rows.length, 8);
    }
    c.sort = "reverse";
    assert.notEqual(c.filtered, derived);
    assert.deepEqual(
        c.records.map((r) => r._id),
        original,
    );
    c.filter = "Published";
    assert.equal(c.filtered.length, 9);
    c.query = "17";
    assert.equal(c.filtered.length, 0);
    c.query = "";
    c.page = 3;
    assert.equal(c.currentPage, 2);
    c.records = c.records.slice(0, 2);
    assert.equal(c.currentPage, 1);
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
    c.query = "no match";
    assert.equal(c.rows.length, 0);
});
