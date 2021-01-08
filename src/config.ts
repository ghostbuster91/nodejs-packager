import { DockerAlias, dockerAliasWithTag } from "./dockerAlias";
import * as uc from "./userConfig";

export interface AppConfig {
    dockerDir: string;
    dockerFile: string;
    imageConfig: ImageConfig;
    stages: Stages;
}
export interface Stages {
    build: BuildStage;
    main: MainStage;
}

export interface ImageConfig {
    baseImage: string;
    workdir: string;
    exposedPorts: number[];
    exposedUpdPorts: number[];
    entrypoint: string[];
    command: string[];
    aliases: DockerAlias[];
}

export interface BuildStage {
    depsLayer: Layer;
    contentLayer: Layer;
}

export interface Layer {
    files: string[];
    commands: string[];
}

export interface MainStage {
    artifactsDir: string;
    commands: string[];
}

export enum Template {
    NPM_TS = "NPM_TS",
    NPM_JS = "NPM_JS",
}

export const createConfig = (userConfig: uc.AppConfig): AppConfig => {
    return {
        imageConfig: {
            baseImage: userConfig.imageConfig.baseImage,
            workdir: userConfig.imageConfig.workdir ?? "/home/node/app",
            exposedPorts: userConfig.imageConfig.exposedPorts ?? [],
            exposedUpdPorts: userConfig.imageConfig.exposedUdpPorts ?? [],
            aliases:
                userConfig.imageConfig.dockerUpdateLatest === "true"
                    ? userConfig.imageConfig.aliases.concat(
                        userConfig.imageConfig.aliases
                            .filter(
                                (thing, i, arr) =>
                                    arr.indexOf(arr.find((t) => t.name === thing.name)!) === i
                            )
                            .map((a) => dockerAliasWithTag(a, "latest"))
                    )
                    : userConfig.imageConfig.aliases,
            entrypoint: userConfig.imageConfig.entrypoint,
            command: userConfig.imageConfig.command ?? [],
        },
        dockerDir: userConfig.dockerDir ?? ".docker",
        dockerFile: userConfig.dockerFile ?? "Dockerfile",
        stages: createStages(userConfig),
    };
};
const NPM_JS_Stages = {
    build: {
        depsLayer: {
            files: ["package.json", "package-lock.json"],
            commands: ["npm install"],
        },
        contentLayer: {
            files: ["."],
            commands: [],
        },
    },
    main: {
        artifactsDir: "src",
        commands: ["npm install --only=production"],
    },
};
const NPM_TS_Stages = {
    build: {
        depsLayer: {
            files: ["package.json", "package-lock.json"],
            commands: ["npm install"],
        },
        contentLayer: {
            files: ["."],
            commands: ["npm run build"],
        },
    },
    main: {
        artifactsDir: "src",
        commands: ["npm install --only=production"],
    },
};
function createStages(userConfig: uc.AppConfig): Stages {
    if (
        userConfig.imageConfig.template?.toString() ===
        Template.NPM_JS.toString()
    ) {
        return NPM_JS_Stages;
    } else if (
        userConfig.imageConfig.template?.toString() ===
        Template.NPM_TS.toString()
    ) {
        return NPM_TS_Stages;
    } else {
        console.warn("Unknown template, fallback to NPM_JS");
        return NPM_JS_Stages;
    }
}
