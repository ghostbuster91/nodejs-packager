#!/usr/bin/env node

import fs from "fs";
import * as dockerfile from "./dockerfile";
import commander from "commander";
import Dockerode from "dockerode";
import glob from "fast-glob";
import path from "path";
import {
    DockerAlias,
    dockerAliasWithTag,
    dockerAliasToString,
} from "./dockerAlias";
import * as uc from "./userConfig";

interface AppConfig {
    dockerDir: string;
    dockerFile: string;
    imageConfig: ImageConfig;
}

interface ImageConfig {
    baseImage: string;
    workdir: string;
    exposedPorts: number[];
    exposedUpdPorts: number[];
    entrypoint: string[];
    command: string[];
    aliases: DockerAlias[];
}

async function stage(cwd: string, appConfig: AppConfig) {
    const imageConfig = appConfig.imageConfig;
    const buildStageName = "buildStage";
    const mainStageName = "mainStage";
    const buildStage = [
        dockerfile.fromAs(imageConfig.baseImage, buildStageName),
        dockerfile.workdir(imageConfig.workdir),
        dockerfile.multiCopy(
            ["1/package.json", "1/package-lock.json"],
            `${imageConfig.workdir}/`
        ),
        dockerfile.npmInstall(),
        dockerfile.copy("2", imageConfig.workdir),
        dockerfile.npmRunBuild(),
    ];
    const mainStage = buildStage
        .concat([
            dockerfile.fromAs(imageConfig.baseImage, mainStageName),
            dockerfile.workdir(imageConfig.workdir),
            dockerfile.npmInstallProd(),
            dockerfile.multiCopy(
                ["1/package.json", "1/package-lock.json"],
                `${imageConfig.workdir}/`
            ),
            dockerfile.copyFrom(buildStageName, [imageConfig.workdir], imageConfig.workdir)
        ])
        .concat(
            dockerfile.expose(
                imageConfig.exposedPorts,
                imageConfig.exposedPorts
            ) ?? []
        )
        .concat([
            dockerfile.entrypoint(imageConfig.entrypoint),
            dockerfile.cmd(imageConfig.command),
        ]);

    const dockerImage = dockerfile.create(mainStage);

    const targetPath = `${cwd}/${appConfig.dockerDir}`;
    await fs.promises.rmdir(targetPath, { recursive: true });
    await fs.promises.mkdir(targetPath, { recursive: true });
    await fs.promises.writeFile(
        `${targetPath}/${appConfig.dockerFile}`,
        dockerImage,
        { encoding: "utf-8" }
    );

    const layer1Files = ["package.json", "package-lock.json"];

    for (const file of layer1Files) {
        const relative = path.relative(cwd, file);
        const targetFile = `${targetPath}/1/${relative}`;
        console.log(`Copying ${file}`);
        await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.promises.copyFile(file, targetFile);
    }

    const ignorePatterns = [
        "**/node_modules/**",
        `**/${appConfig.dockerDir}/**`,
        "**/dockerconfig.ts",
    ].concat(layer1Files.map(f=> `**/${f}`));
    const layer2Files = await glob(`${cwd}/**`, { ignore: ignorePatterns });
    for (const file of layer2Files) {
        const relative = path.relative(cwd, file);
        const targetFile = `${targetPath}/2/${relative}`;
        console.log(`Copying ${file}`);
        await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.promises.copyFile(file, targetFile);
    }

    console.log("Done");
    return `${targetPath}/${appConfig.dockerFile}`;
}

async function readConfig(cwd: string, configFile: string) {
    const userConfig: uc.AppConfig = await import(`${cwd}/${configFile}`);
    console.log(`UserConfig: ${JSON.stringify(userConfig)}`);
    const createConfig = (userConfig: uc.AppConfig): AppConfig => {
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
        };
    };

    return createConfig(userConfig);
}

async function filterEntries(
    directory: string,
    config: AppConfig
): Promise<string[]> {
    const ignorePatterns = ["**/node_modules/**", `**/${config.dockerDir}/**`];
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
            const config: AppConfig = await readConfig(cwd, cmdObj.config);
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
            const config: AppConfig = await readConfig(cwd, cmdObj.config);
            const dockerfile = await stage(cwd, config);
            await buildDockerImage(config, docker, dockerfile); // TODO how to catch errors?
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
            const config: AppConfig = await readConfig(cwd, cmdObj.config);
            for (const alias of config.imageConfig.aliases) {
                await docker.getImage(dockerAliasToString(alias)).remove(); //TODO there can be no such image, invoke rmi api directly
            }
        });

    await program.parseAsync(process.argv);
}

async function buildDockerImage(
    config: AppConfig,
    docker: Dockerode,
    dockerfile: string
) {
    const aliases = config.imageConfig.aliases.map(dockerAliasToString);
    const stream = await docker.buildImage(
        {
            context: path.dirname(dockerfile),
            src: ["."],
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
    });
}

main();
