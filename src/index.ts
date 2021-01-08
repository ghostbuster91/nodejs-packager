#!/usr/bin/env node

import commander from "commander";
import Dockerode from "dockerode";
import { dockerAliasToString } from "./dockerAlias";
import * as uc from "./userConfig";
import { AppConfig, createConfig } from "./config";
import { stage } from "./commands/stage";
import { buildDockerImage } from "./commands/buildImage";

async function readConfig(cwd: string, configFile: string): Promise<AppConfig> {
    const userConfig: uc.AppConfig = await import(`${cwd}/${configFile}`);
    console.log(`UserConfig: ${JSON.stringify(userConfig)}`);
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

main();
