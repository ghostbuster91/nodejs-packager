#!/usr/bin/env node

import commander from "commander";
import Dockerode from "dockerode";
import { dockerAliasToString } from "./dockerAlias";
import * as uc from "./userConfig";
import { AppConfig, createConfig } from "./config";
import { stage } from "./commands/stage";
import { buildDockerImage, followProgress } from "./commands/buildImage";

async function readConfig(cwd: string, configFile: string): Promise<AppConfig> {
    const userConfig: uc.AppConfig = await import(`${cwd}/${configFile}`);
    console.log(`UserConfig loaded\n`);
    return createConfig(userConfig);
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
        .command("publish")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .description(
            "Builds an image using the local Docker server and pubishes it to the remote repository"
        )
        .action(async (cmdObj) => {
            const auth = {
                username: 'username',
                password: 'password',
                auth: '',
                email: 'your@email.email',
                serveraddress: 'https://index.docker.io/v1'
              };
            const config: AppConfig = await readConfig(cwd, cmdObj.config);
            const dockerfile = await stage(cwd, config);
            await buildDockerImage(config, docker, dockerfile); // TODO how to catch errors?
            for (const alias of config.imageConfig.aliases) {
                const image = docker.getImage(dockerAliasToString(alias));
                const stream  = await image.push({authConfig: auth});
                await followProgress(docker, stream);
            }
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
                try {
                    const image = docker.getImage(dockerAliasToString(alias));
                    await image.remove();
                } catch (e) {
                    if (
                        e instanceof Error &&
                        e.message.includes("No such image")
                    ) {
                        console.warn(e.message);
                    } else {
                        throw e;
                    }
                }
            }
        });

    await program.parseAsync(process.argv);
}

main();
