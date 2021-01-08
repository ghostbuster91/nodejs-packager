#!/usr/bin/env node

import fs from "fs";
import * as dockerfile from "./dockerfile";
import commander from "commander";
import Dockerode from "dockerode";
import glob from "fast-glob";
import path from "path";

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

    const includedFiles = await filterEntries(cwd, config);
    const dockerImage = dockerfile.create(mainstage);

    const targetPath = `${cwd}/${config.dockerDir}`;
    await fs.promises.rmdir(targetPath, { recursive: true });
    await fs.promises.mkdir(targetPath, { recursive: true });
    await fs.promises.writeFile(
        `${targetPath}/${config.dockerFile}`,
        dockerImage,
        { encoding: "utf-8" }
    );

    for (const file of includedFiles) {
        const relative = path.relative(cwd, file);
        const targetFile = `${targetPath}/${relative}`;
        console.log(`Copying ${file}`);
        await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.promises.copyFile(file, targetFile);
    }

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
            dockerDir: userConfig.dockerDir ?? ".docker",
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

    return createConfig(userConfig);
}

async function filterEntries(
    directory: string,
    config: DockerConfig
): Promise<string[]> {
    const ignorePatterns = ["**/node_modules/**", `**/${config.dockerDir}/**`]; //TODO enchance
    return glob(`${directory}/**`, { ignore: ignorePatterns });
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
            const dockerfile = await stage(cwd, config);
            const aliases = config.aliases.map(dockerAliasToString);
            const stream = await docker.buildImage(
                {
                    context: path.dirname(dockerfile),
                    src: ["."], //TODO without docker file
                },
                { t: aliases }
            );
            await new Promise((resolve, reject) => {
                docker.modem.followProgress(
                    stream,
                    (err: any, res: any) => (err ? reject(err) : resolve(res)),
                    (a: any) => {
                        const upstreamText: string = a.stream;
                        if (upstreamText) {
                            const textWithoutNewLines: string = upstreamText.replace(
                                "\n",
                                ""
                            );
                            if (textWithoutNewLines) {
                                console.log(textWithoutNewLines);
                            }
                        }
                    }
                );
            }); // TODO how to catch errors?
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
            for (const alias of config.aliases) {
                await docker.getImage(dockerAliasToString(alias)).remove(); //TODO there can be no such image, invoke rmi api directly
            }
        });

    await program.parseAsync(process.argv);
}

main();
