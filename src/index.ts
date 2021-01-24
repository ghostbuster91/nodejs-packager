#!/usr/bin/env node

import commander from "commander";
import Dockerode from "dockerode";
import { dockerAliasToString } from "./dockerAlias";
import * as uc from "./userConfig";
import { AppConfig, createConfig } from "./config";
import { stage } from "./commands/stage";
import { buildDockerImage, followProgress } from "./commands/buildImage";
import { Level,Logger } from "./logger";

async function readConfig(cwd: string, configFile: string, logger: Logger): Promise<AppConfig> {
    const userConfig: uc.AppConfig = await import(`${cwd}/${configFile}`);
    logger.log(`UserConfig loaded\n`);
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
        .option('-l, --loglevel <log_level>', 'log level', 'INFO')
        .description(
            "Generates a directory with the Dockerfile and environment prepared for creating a Docker image."
        )
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(cwd, cmdObj.config, logger);
            await stage(cwd, config, logger);
            logger.log("Done");
        });

    program
        .command("publishLocal")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .option('-l, --loglevel <log_level>', 'log level', 'INFO')
        .description("Builds an image using the local Docker server.")
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(cwd, cmdObj.config, logger);
            const dockerfile = await stage(cwd, config, logger);
            await buildDockerImage(config, docker, dockerfile, logger);
            logger.log("Done");
        });

    program
        .command("publish")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .option('-l, --loglevel <log_level>', 'log level', 'INFO')
        .description(
            "Builds an image using the local Docker server and pubishes it to the remote repository"
        )
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const auth = {
                username: "username",
                password: "password",
                auth: "",
                email: "your@email.email",
                serveraddress: "https://index.docker.io/v1",
            };
            const config: AppConfig = await readConfig(cwd, cmdObj.config, logger);
            const dockerfile = await stage(cwd, config, logger);
            await buildDockerImage(config, docker, dockerfile, logger);
            for (const alias of config.imageConfig.aliases) {
                const image = docker.getImage(dockerAliasToString(alias));
                const stream = await image.push({ authConfig: auth });
                await followProgress(docker, stream, logger);
            }
            logger.log("Done");
        });

    program
        .command("clean")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .option('-l, --loglevel <log_level>', 'log level', 'INFO')
        .description("Removes the built image from the local Docker server.")
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(cwd, cmdObj.config, logger);
            for (const alias of config.imageConfig.aliases) {
                const imageTag = dockerAliasToString(alias);
                const image = docker.getImage(imageTag);
                try {
                    logger.log(`Removing ${imageTag}`);
                    await image.remove();
                } catch (e) {
                    if (
                        e instanceof Error &&
                        e.message.includes("No such image")
                    ) {
                        logger.warn(e.message);
                    } else {
                        throw e;
                    }
                }
            }
            logger.log("Done");
        });

    await program.parseAsync(process.argv);
}

main();
