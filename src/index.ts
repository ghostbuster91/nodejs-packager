#!/usr/bin/env node

import commander from "commander";
import Dockerode from "dockerode";
import { dockerAliasToString } from "./dockerAlias";
import * as uc from "./userConfig";
import { AppConfig, createConfig, Template } from "./config";
import { stage } from "./commands/stage";
import { buildDockerImage, followProgress } from "./commands/buildImage";
import { Logger } from "./logger";
import { acquireCredentials } from "./credentials-handler";
import fs from "fs";
import path from "path";

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
    const program = commander.program;
    const cwd = process.cwd();

    program
        .version("0.2.0", "-v, --version")
        .option("-l, --log-level <log_level>", "log level", "INFO")
        .option(
            "-c, --config <fileName>",
            "config file name",
            "dockerconfig.ts"
        );

    program
        .command("stage")
        .description(
            "Generates a directory with the Dockerfile and environment prepared for building a Docker image."
        )
        .action(async () => {
            console.log(`Current working directory: ${cwd}`);
            const logger = Logger.fromArgs(program.opts());
            const config: AppConfig = await readConfig(
                cwd,
                program.opts().config,
                logger
            );
            await stage(cwd, config, logger);
            logger.log("Done");
        });

    program
        .command("build")
        .description("Builds an image using the local Docker server.")
        .action(async () => {
            const docker = new Dockerode({
                socketPath: "/var/run/docker.sock",
            });
            const cwd = process.cwd();
            console.log(`Current working directory: ${cwd}`);
            const logger = Logger.fromArgs(program.opts());
            const config: AppConfig = await readConfig(
                cwd,
                program.opts().config,
                logger
            );
            const dockerfile = await stage(cwd, config, logger);
            await buildDockerImage(config, docker, dockerfile, logger);
            logger.log("Done");
        });

    program
        .command("publish")
        .option(
            "--auth",
            "Will ask for user credentials rather than using daemon wide credentials"
        )
        .description(
            "Builds an image using the local Docker server and pubishes it to the remote repository"
        )
        .action(async (cmdObj) => {
            const docker = new Dockerode({
                socketPath: "/var/run/docker.sock",
            });
            console.log(`Current working directory: ${cwd}`);
            const logger = Logger.fromArgs(program.opts());
            const config: AppConfig = await readConfig(
                cwd,
                program.opts().config,
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
        .description(
            "Deletes all the temporary files and removes the built image from the local Docker server."
        )
        .action(async () => {
            const docker = new Dockerode({
                socketPath: "/var/run/docker.sock",
            });
            const logger = Logger.fromArgs(program.opts());
            const config: AppConfig = await readConfig(
                cwd,
                program.opts().config,
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
            const deletionTarget = path.join(cwd, ".docker");
            logger.warn(`Removing ${deletionTarget}`);
            await fs.promises.rm(deletionTarget, { recursive: true });
            logger.log("Done");
        });

    program
        .command("init")
        .description("Generates initial dockerconfig.ts for given template")
        .arguments("<template>")
        .action(async (template) => {
            console.log(`Current working directory: ${cwd}`);
            const logger = Logger.fromArgs(program.opts());
            const targetConfigFile = path.join(cwd, "dockerconfig.ts");
            if (template == Template.NPM_JS.toString()) {
                const dockerconfig = `const userConfig = {
                    imageConfig: {
                        baseImage: "node:15-alpine",
                        entrypoint: ["node", "index.js"],
                        template: 'NPM_JS',
                        aliases: [{name: "nodejs-example-alias", tag: "latest"}],
                    }
                    }	
                    
                    module.exports = userConfig`;
                await fs.promises.writeFile(targetConfigFile, dockerconfig, {
                    encoding: "utf-8",
                });
                logger.log(`Config saved to ${targetConfigFile}`);
            } else if (template == Template.NPM_TS.toString()) {
                const dockerconfig = `const userConfig = {
                    imageConfig: {
                        baseImage: "node:15-alpine",
                        entrypoint: ["node", "index.js"],
                        template: 'NPM_TS',
                        aliases: [{name: "nodejs-example-alias", tag: "latest"}],
                    }
                    }	
                    
                    module.exports = userConfig`;
                await fs.promises.writeFile(targetConfigFile, dockerconfig, {
                    encoding: "utf-8",
                });
                logger.log(`Config saved to ${targetConfigFile}`);
            } else {
                logger.error(
                    `Unrecognized template. Supported templates are: [${Template.NPM_JS.toString()}, ${Template.NPM_TS.toString()}]`
                );
            }
        });

    await program.parseAsync(process.argv);
}

main();
