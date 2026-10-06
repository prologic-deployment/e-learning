# EdlaNg

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 14.2.3.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Install after pulling the UI redesign

Stop the running Angular server before replacing dependencies. From PowerShell:

```powershell
cd E:\elearningTest
git pull --ff-only origin v1.0
cd front
npm ci
npm start
```

`npm ci` replaces `node_modules` using the committed lockfile. Keep `package-lock.json`.
MDB is pinned to 6.1.0 for Angular 17 compatibility; do not reinstall MDB 5.x or use
`--force` / `--legacy-peer-deps` to bypass its Angular 16 peer requirements.
The Spartan icon and class-utility dependencies are already declared in package.json.
