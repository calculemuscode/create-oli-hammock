#!/usr/bin/env node
import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as promptSync from "prompt-sync";
import * as packageJson from "./package.json";
import chalk from "chalk";

const prompt = promptSync();

let projectFolderName: string | undefined = undefined;
const program = new Command(packageJson.name)
    .version(packageJson.version)
    .arguments("[<project-directory>]")
    .usage(`[${chalk.green("<project-directory>")}]`)
    .action(name => {
        projectFolderName = name;
    })
    .parse(process.argv);
program;

let projectRoot: string;
if (typeof projectFolderName === "undefined") {
    console.log(`This utility will create an ${chalk.bold("OLI Hammock")} project.`);
    console.log(``);
    console.log(`Press ^C at any time to quit`);
    console.log(``);
    projectFolderName = prompt("Project directory? ");
    projectRoot = path.join(process.cwd(), projectFolderName);
    console.log(``);
    console.log(`Using directory ${chalk.bold(projectRoot)}`);
} else {
    projectRoot = path.join(process.cwd(), projectFolderName);
    console.log(`This utility will create an ${chalk.bold("OLI Hammock")} project`);
    console.log(`in the directory ${chalk.bold(projectRoot)}`);
    console.log(``);
    console.log(`Press ^C at any time to quit.`);
}

console.log(``);
if (fs.existsSync(projectRoot)) {
    console.log(`${chalk.red.bold("Error:")} ${chalk.bold("this project directory already exists.")}`);
    process.exit(1);
}

let projectIdentifier = prompt(`Project name: (${path.basename(projectFolderName)}) `).trim();
if (projectIdentifier === "") projectIdentifier = path.basename(projectFolderName);
console.log(``);
if (!projectIdentifier.match(/^[a-zA-Z0-9_-]*$/)) {
    const pos = projectIdentifier.match(/^[a-zA-Z0-9_-]*/) || [""];
    console.log(
        `${chalk.red.bold("Error:")} project name contains illegal character "${
            projectIdentifier[pos[0].length]
        }"`
    );
    process.exit(1);
}

let projectDesc = prompt(`Project short description: (Custom activity) `);
console.log(``);

let oliRoot: string | null = path.normalize(prompt(`Path to OLI project repository's root: (none) `).trim());
if (oliRoot.trim() === "") oliRoot = null;
if (oliRoot !== null) {
    if (!fs.existsSync(oliRoot)) {
        console.log(`${chalk.red.bold("Error:")} path to OLI project root does not exist.`);
        process.exit(1);
    }
}

console.log(``);
let projectPath = prompt(`Path within OLI project: (.) `)
    .trim()
    .normalize();
let repositoryPath: string | null = null;
if (oliRoot !== null) {
    repositoryPath = path.join(oliRoot, "content", projectPath);
    if (!fs.existsSync(path.join(repositoryPath, "x-oli-embed-activity"))) {
        console.log(
            `${chalk.red.bold("Error:")} directory ${chalk.bold(
                path.join(repositoryPath, "x-oli-embed-activity")
            )} does not exist.`
        );
        console.log(`Check OLI project root and path within OLI project.`);
        process.exit(1);
    }
}
let p = projectPath;
let projectPaths: string[] = ["webcontent", projectIdentifier];
while (p !== "." && p !== "") {
    projectPaths.unshift(path.basename(p));
    p = path.dirname(p);
}

console.log(``);
console.log(`${chalk.green(`Building ${projectIdentifier} in directory ${projectRoot}`)}`);
fs.mkdirSync(projectRoot);
let subfolderAbsolute = path.join(projectRoot, "assets");
fs.mkdirSync(subfolderAbsolute);
let subfolderRelative = ".";
while (projectPaths.length > 0) {
    const dir = projectPaths.shift()!;
    subfolderAbsolute = path.join(subfolderAbsolute, dir);
    subfolderRelative = path.posix.join(subfolderRelative, dir);
    fs.mkdirSync(subfolderAbsolute);
}

fs.writeFileSync(
    path.join(subfolderAbsolute, "layout.html"),
    `<div>
    <div id="prompt"></div>
    <input id="answer" />
    <div id="hint"></div>
    <div id="feedback"></div>
</div>
`
);

fs.writeFileSync(
    path.join(subfolderAbsolute, "questions.json"),
    JSON.stringify(
        {
            prompt: "Enter the correct number:",
            hints: [
                "Just try a number and see what happens!",
                "The number is even.",
                "The number is about 40."
            ],
            part: {
                match: {
                    nan: "You must input a number.",
                    small: "That's too small.",
                    big: "That's too large.",
                    justright: [true, "That's just right!"]
                }
            }
        },
        null,
        4
    )
);

fs.writeFileSync(
    path.join(projectRoot, "activity.ts"),
    `import { QuestionData, Activity/*, ParseResponse*/ } from "@calculemus/oli-hammock";
import * as widgets from "@calculemus/oli-widgets";

interface State {
    answer: string;
    hint: widgets.HintData;
}

const activity: Activity<State> = {
    init: (): State => ({ answer: "", hint: widgets.emptyHint }),
    read: (): State => ({
        answer: \`\${$("#answer").val()}\`,
        hint: widgets.readHint($("#hint"))
    }),
    render: (data: QuestionData<State>): void => {
        $("#prompt").html(data.prompt!);
        $("#answer").val(data.state.answer);
        $("#hint").empty().append(widgets.hint(data.hints!, data.state.hint));
        $("#feedback")
            .empty()
            .append(widgets.feedback(data.parts[0].feedback));
    },
    parse: (state: State)/*: [ParseResponse]*/ => {
        if (state.answer.trim() === "") return [null];
        const n = parseInt(state.answer);
        if (isNaN(n)) return ["nan"];
        if (n < 42) return ["small"];
        if (n > 42) return ["big"];
        return ["justright"];
    }
};

export default activity;
`
);

fs.writeFileSync(
    path.join(projectRoot, "main.ts"),
    `import { hammock } from "@calculemus/oli-hammock";
import activity from "./activity";
export = hammock(activity) as any;
`
);

fs.writeFileSync(
    path.join(projectRoot, "main.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE embed_activity PUBLIC "-//Carnegie Mellon University//DTD Embed 1.1//EN" "http://oli.cmu.edu/dtd/oli-embed-activity_1.0.dtd">
<embed_activity id="${projectIdentifier}" width="676" height="250">
  <title>${projectDesc}</title>
  <source>${subfolderRelative}/activity.js</source>
  <assets>
    <asset name="layout">${path.posix.join(subfolderRelative, "layout.html")}</asset>
    <asset name="questions">${path.posix.join(subfolderRelative, "questions.json")}</asset>
  </assets>
</embed_activity>
`
);

fs.writeFileSync(
    path.join(projectRoot, "tsconfig.json"),
    JSON.stringify(
        {
            target: "es6",
            moduleResolution: "node",
            declaration: true,
            outDir: "lib",
            module: "commonjs",
            sourceMap: true,

            types: ["jquery"],

            strict: true,
            allowUnreachableCode: false,
            allowUnusedLabels: false,
            noImplicitReturns: true,
            noUnusedLocals: true
        },
        null,
        4
    )
);

fs.writeFileSync(
    path.join(projectRoot, "webpack.config.js"),
    `const path = require("path");

module.exports = {
    mode: "development",
    entry: {
        activity: "./main.ts"
    },
    output: {
        filename: "activity.js",
        libraryTarget: "umd",
        path: path.resolve(__dirname, "dist")
    },
    devServer: {
        contentBase: [
            path.join(__dirname),
            path.join(__dirname, "node_modules/@calculemus/oli-hammock/assets"),
        ]
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
    module: {
        rules: [ { test: /\.ts$/, loader: "ts-loader"} ]
    },
    externals: {
    },
}
`
);

const config = {
    scripts: {
        prettier: "prettier --write *.json *.ts src/*.ts",
        watch: "webpack-dev-server --progress --colors",
        webpack: `webpack; cp -R assets main.xml ${path.join(
            "node_modules",
            "@calculemus",
            "oli-hammock",
            "assets",
            "*"
        )} dist`,
        predist: "npm run webpack",
        dist: `surge dist ${projectIdentifier}-oli-hammock.surge.sh`
    },
    devDependencies: {
        "@calculemus/oli-hammock": "^3.2.3",
        "@calculemus/oli-widgets": "^3.0.0",
        "@types/jquery": "^3.3.16",
        path: "^0.12.7",
        prettier: "^1.14.3",
        surge: "^0.20.1",
        "ts-loader": "^4.4.2",
        typescript: "^3.1.3",
        webpack: "^4.20.2",
        "webpack-cli": "^3.1.2",
        "webpack-dev-server": "^3.1.9"
    },
    prettier: {
        printWidth: 110,
        tabWidth: 4
    }
};

if (repositoryPath !== null && oliRoot !== null) {
    repositoryPath = path.normalize(path.join("..", repositoryPath));
    oliRoot = path.normalize(path.join("..", oliRoot));
    (config.scripts as any).predeploy = `npm run webpack`;
    (config.scripts as any).deploy = `cp main.xml ${path.join(
        repositoryPath,
        "x-oli-embed-activity",
        `${projectIdentifier}.xml`
    )}; cp -r assets/* ${oliRoot}`;
}

fs.writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify(config, null, 4));
console.log(`${chalk.green("Done.")}`);
console.log(``);
console.log(`Next steps:`);
console.log(chalk.bold(`   cd ${projectFolderName}`));
console.log(chalk.bold(`   npm install`));
console.log(chalk.bold(`   npm run watch`));
console.log(`   Open ${chalk.bold("http://localhost:8080/")} in your browser`);
console.log(``);
