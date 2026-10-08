const ts = require("typescript"),
    fs = require("fs"),
    path = require("path");
const source = path.resolve(__dirname, "../src/app/validation/input-policy.ts");
const output =
    "// Generated from front/src/app/validation/input-policy.ts. Do not edit directly.\n" +
    ts.transpileModule(fs.readFileSync(source, "utf8"), {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
    }).outputText;
const dest = path.resolve(
    __dirname,
    "../../back/src/validation/input-policy.js",
);
if (process.argv.includes("--check")) {
    if (fs.readFileSync(dest, "utf8") !== output)
        throw Error(
            "Validation policies are out of sync. Run npm run validation:sync.",
        );
} else fs.writeFileSync(dest, output);
