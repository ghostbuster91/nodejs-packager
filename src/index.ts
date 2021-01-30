#!/usr/bin/env node

import commander from "commander";
import Dockerode from "dockerode";
import { dockerAliasToString } from "./dockerAlias";
import * as uc from "./userConfig";
import { AppConfig, createConfig } from "./config";
import { stage } from "./commands/stage";
import { buildDockerImage, followProgress } from "./commands/buildImage";
import { Logger } from "./logger";
import { acquireCredentials } from "./credentials-handler";

async function readConfig(
    cwd: string,
    configFile: string,
    logger: Logger
): Promise<AppConfig> {
    const userConfig: uc.AppConfig = await import(`${cwd}/${configFile}`);
    logger.log(`UserConfig loaded\n`);
    return createConfig(userConfig);
}

async function main() {
    const docker = new Dockerode({ socketPath: "/var/run/docker.sock" });
    const cwd = process.cwd();
    console.log(`Current working directory: ${cwd}`);
    const program = commander.program;

    program.version("0.2.0", "-v, --version");

    program
        .command("stage")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .option("-l, --log-level <log_level>", "log level", "INFO")
        .description(
            "Generates a directory with the Dockerfile and environment prepared for building a Docker image."
        )
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(
                cwd,
                cmdObj.config,
                logger
            );
            await stage(cwd, config, logger);
            logger.log("Done");
        });

    program
        .command("build")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        )
        .option("-l, --log-level <log_level>", "log level", "INFO")
        .description("Builds an image using the local Docker server.")
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(
                cwd,
                cmdObj.config,
                logger
            );
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
        .option("-l, --log-level <log_level>", "log level", "INFO")
        .option(
            "--auth",
            "Will ask for user credentials rather than using daemon wide credentials"
        )
        .description(
            "Builds an image using the local Docker server and pubishes it to the remote repository"
        )
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(
                cwd,
                cmdObj.config,
                logger
            );
            const shouldAuthenticate: boolean = cmdObj.auth;
            const credentials = await acquireCredentials(
                logger,
                shouldAuthenticate
            );
            const dockerfile = await stage(cwd, config, logger);
            await buildDockerImage(config, docker, dockerfile, logger);

            for (const alias of config.imageConfig.aliases) {
                const image = docker.getImage(dockerAliasToString(alias));
                logger.log(`Pushing ${dockerAliasToString(alias)}`);
                const stream = await image.push({
                    authconfig: credentials,
                });
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
        .option("-l, --log-level <log_level>", "log level", "INFO")
        .description("Removes the built image from the local Docker server.")
        .action(async (cmdObj) => {
            const logger = Logger.fromArgs(cmdObj);
            const config: AppConfig = await readConfig(
                cwd,
                cmdObj.config,
                logger
            );
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
