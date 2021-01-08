import {
    DockerAlias,
    dockerAliasWithTag,
} from "./dockerAlias";
import * as uc from "./userConfig";

export interface AppConfig {
    dockerDir: string;
    dockerFile: string;
    imageConfig: ImageConfig;
    buildStage: BuildStage;
    mainStage: MainStage;
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

export const createConfig = (userConfig: uc.AppConfig): AppConfig => {
    return {
        imageConfig: {
            baseImage: userConfig.imageConfig.baseImage,
            workdir: userConfig.imageConfig.workdir ?? "/home/node/app",
            exposedPorts: userConfig.imageConfig.exposedPorts ?? [],
            exposedUpdPorts: userConfig.imageConfig.exposedUdpPorts ?? [],
            aliases:
                userConfig.imageConfig.dockerUpdateLatest ?? false
                    ? userConfig.imageConfig.aliases.concat(
                          userConfig.imageConfig.aliases
                              .map((a) => dockerAliasWithTag(a, "latest"))
                              .filter(
                                  (elem, index, self) =>
                                      index === self.indexOf(elem)
                              )
                      )
                    : userConfig.imageConfig.aliases,
            entrypoint: userConfig.imageConfig.entrypoint,
            command: userConfig.imageConfig.command ?? [],
        },
        dockerDir: userConfig.dockerDir ?? ".docker",
        dockerFile: userConfig.dockerFile ?? "Dockerfile",
        buildStage: {
            depsLayer: {
                files: ["package.json", "package-lock.json"],
                commands: ["npm install"],
            },
            contentLayer: {
                files: ["."],
                commands: ["npm run build"],
            },
        },
        mainStage: {
            artifactsDir: "src",
            commands: ["npm install --only=production"],
        },
    };
};