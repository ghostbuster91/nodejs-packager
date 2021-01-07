#!/usr/bin/env node

import fs from "fs";
import * as dockerfile from "./dockerfile";
import commander from "commander";
import Dockerode from "dockerode";
import util from "util";
import child_process from "child_process";
const exec = util.promisify(child_process.exec);

export interface DockerAlias {
    registryHost?: string;
    username?: string;
    name: string;
    tag?: string;
}
const dockerAliasToString = (alias: DockerAlias): string => {
    return (
        (alias.registryHost ? `${alias.registryHost}/` : "") +
        (alias.username ? `${alias.username}/` : "") +
        alias.name +
        (alias.tag ? `:${alias.tag}` : "")
    );
};

export interface UserDockerConfig {
    baseImage: string;
    workdir?: string;
    exposedPorts?: number[];
    exposedUdpPorts?: number[];
    dockerDir?: string;
    dockerFile?: string;
    entrypoint: string[];
    depsFiles?: string[];
    command?: string[];
    aliases: DockerAlias[];
}

interface DockerConfig {
    baseImage: string;
    workdir: string;
    exposedPorts: number[];
    exposedUpdPorts: number[];
    dockerDir: string;
    dockerFile: string;
    entrypoint: string[];
    depsFiles: string[];
    command: string[];
    aliases: DockerAlias[];
}

async function stage(cwd: string, config: DockerConfig) {
    const mainstage = [
        dockerfile.fromAs(config.baseImage, "mainstage"),
        dockerfile.workdir(config.workdir),
        dockerfile.multiCopy(config.depsFiles, `${config.workdir}/`),
        dockerfile.npmInstall(),
        dockerfile.copy(".", config.workdir),
    ]
        .concat(
            dockerfile.expose(config.exposedPorts, config.exposedPorts) ?? []
        )
        .concat([
            dockerfile.entrypoint(config.entrypoint),
            dockerfile.cmd(config.command),
        ]);

    const dockerImage = dockerfile.create(mainstage);

    const targetPath = `${cwd}`;
    await fs.promises.mkdir(targetPath, { recursive: true });
    await fs.promises.writeFile(
        `${targetPath}/${config.dockerFile}`,
        dockerImage,
        { encoding: "utf-8" }
    );
    console.log("Done");
    return `${targetPath}/${config.dockerFile}`;
}

async function readConfig(cwd: string, configFile: string) {
    const userConfig: UserDockerConfig = await import(`${cwd}/${configFile}`);
    console.log(`UserConfig: ${JSON.stringify(userConfig)}`);
    const createConfig = (userConfig: UserDockerConfig): DockerConfig => {
        return {
            baseImage: userConfig.baseImage,
            workdir: userConfig.workdir ?? "/home/node/app",
            exposedPorts: userConfig.exposedPorts ?? [],
            exposedUpdPorts: userConfig.exposedUdpPorts ?? [],
            dockerDir: userConfig.dockerDir ?? "docker",
            dockerFile: userConfig.dockerFile ?? "Dockerfile",
            entrypoint: userConfig.entrypoint,
            command: userConfig.command ?? [],
            aliases: userConfig.aliases,
            depsFiles: userConfig.depsFiles ?? [
                "package.json",
                "package-lock.json",
            ],
        };
    };

    const config: DockerConfig = createConfig(userConfig);
    return config;
}

async function main() {
    const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
    const cwd = process.cwd();
    console.log(`Current working directory: ${cwd}`);
    const program = commander.program;

    program.version("0.1.0");

    program
        .command("stage")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .description(
            "Generates a directory with the Dockerfile and environment prepared for creating a Docker image."
        )
        .action(async (cmdObj) => {
            const config: DockerConfig = await readConfig(cwd, cmdObj.config);
            await stage(cwd, config);
        });

    program
        .command("publishLocal")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .description("Builds an image using the local Docker server.")
        .action(async (cmdObj) => {
            const config: DockerConfig = await readConfig(cwd, cmdObj.config);
            await stage(cwd, config);
            const primaryAlias = dockerAliasToString(config.aliases[0]);
            console.log(`primary: ${primaryAlias}`);
            await exec(
                `docker build --tag ${primaryAlias} --rm --file ${config.dockerFile} .`,
                { cwd: cwd }
            );
            console.log("Image built");
        });

    program
        .command("clean")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .description("Removes the built image from the local Docker server.")
        .action(async (cmdObj) => {
            console.log("Removing image");
            const config: DockerConfig = await readConfig(cwd, cmdObj.config);
            await config.aliases.forEach(async (alias) => {
                await docker.getImage(dockerAliasToString(alias)).remove(); //TODO there can be no such image, invoke rmi api directly
            });
        });

    await program.parseAsync(process.argv);
}

main();
