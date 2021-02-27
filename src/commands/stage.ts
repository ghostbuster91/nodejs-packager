import fs from "fs";
import glob from "fast-glob";
import path from "path";
import { AppConfig } from "../config";
import * as dockerfile from "../dockerfile";
import { Logger } from "../logger";

export async function stage(cwd: string, appConfig: AppConfig, logger: Logger) {
    logger.log("Preparing docker environment...");
    const targetPath = path.join(cwd, appConfig.dockerDir);
    const dockerImage = createDockerFile(appConfig);

    await fs.promises.rm(targetPath, { recursive: true, force: true });
    await fs.promises.mkdir(targetPath, { recursive: true });
    await fs.promises.writeFile(
        `${targetPath}/${appConfig.dockerFile}`,
        dockerImage,
        { encoding: "utf-8" }
    );

    const layer1Files = await handleFirstLayer(cwd, targetPath, logger);
    await handleSecondLayer(appConfig, layer1Files, cwd, targetPath, logger);
    await handleMappedFiles(appConfig, targetPath, logger);

    logger.log("Done\n");
    return `${targetPath}/${appConfig.dockerFile}`;
}

async function handleFirstLayer(
    cwd: string,
    targetPath: string,
    logger: Logger
) {
    const layer1Files = ["package.json", "package-lock.json"];

    for (const file of layer1Files) {
        const relative = path.relative(cwd, file);
        const targetFile = `${targetPath}/1/${relative}`;
        logger.log(`Copying ${file}`);
        await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.promises.copyFile(file, targetFile);
    }
    return layer1Files;
}

async function handleSecondLayer(
    appConfig: AppConfig,
    layer1Files: string[],
    cwd: string,
    targetPath: string,
    logger: Logger
) {
    const ignorePatterns = [
        "**/node_modules/**",
        `**/${appConfig.dockerDir}/**`,
        "**/dockerconfig.ts",
    ].concat(layer1Files.map((f) => `**/${f}`));
    const layer2Files = await glob(`${cwd}/**`, { ignore: ignorePatterns });
    for (const file of layer2Files) {
        const relative = path.relative(cwd, file);
        const targetFile = `${targetPath}/2/${relative}`;
        logger.log(`Copying ${file}`);
        await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.promises.copyFile(file, targetFile);
    }
}

async function handleMappedFiles(
    appConfig: AppConfig,
    targetPath: string,
    logger: Logger
) {
    for (const mapping of appConfig.imageConfig.mappings) {
        logger.log(`Copying ${mapping.from}`);
        const targetFile = path.join(targetPath, mapping.to);
        await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });
        await fs.promises.copyFile(mapping.from, targetFile);
    }
}

function createDockerFile(appConfig: AppConfig) {
    const buildStageName = "buildStage";
    const mainStageName = "mainStage";
    const buildStage = createBuildStage(buildStageName, appConfig);
    const mainStage = createMainStage(
        buildStage,
        mainStageName,
        appConfig,
        buildStageName
    );
    return dockerfile.create(mainStage);
}

function createBuildStage(buildStageName: string, appConfig: AppConfig) {
    const imageConfig = appConfig.imageConfig;
    return [
        dockerfile.fromAs(imageConfig.baseImage, buildStageName),
        dockerfile.workdir(imageConfig.workdir),
        dockerfile.multiCopy(
            appConfig.stages.build.depsLayer.files.map((f) => `1/${f}`),
            `${imageConfig.workdir}/`
        ),
    ]
        .concat(
            appConfig.stages.build.depsLayer.commands.map((c) =>
                dockerfile.exec(c.split(" "))
            )
        )
        .concat([
            dockerfile.multiCopy(
                appConfig.stages.build.contentLayer.files.map((f) => `2/${f}`),
                `${imageConfig.workdir}/`
            ),
        ])
        .concat(
            appConfig.imageConfig.mappings.map((m) =>
                dockerfile.copy(
                    m.to.split(path.sep).slice(1).join(path.sep),
                    m.to
                )
            )
        )
        .concat(
            appConfig.stages.build.contentLayer.commands.map((c) =>
                dockerfile.exec(c.split(" "))
            )
        );
}

function createMainStage(
    buildStage: dockerfile.CmdLike[],
    mainStageName: string,
    appConfig: AppConfig,
    buildStageName: string
) {
    const imageConfig = appConfig.imageConfig;
    return buildStage
        .concat([
            dockerfile.stageBreak(),
            dockerfile.fromAs(imageConfig.baseImage, mainStageName),
        ])
        .concat([dockerfile.label("nodejs-packager-stage", "intermediate")])
        .concat(
            appConfig.imageConfig.maintainer
                ? [
                      dockerfile.label(
                          "MAINTAINER",
                          appConfig.imageConfig.maintainer
                      ),
                  ]
                : []
        )
        .concat([dockerfile.workdir(imageConfig.workdir)])
        .concat(
            dockerfile.multiCopy(
                appConfig.stages.build.depsLayer.files.map((f) => `1/${f}`),
                `${imageConfig.workdir}/`
            )
        )
        .concat(
            appConfig.stages.main.commands.map((c) =>
                dockerfile.exec(c.split(" "))
            )
        )
        .concat([
            dockerfile.copyFrom(
                buildStageName,
                [
                    `${imageConfig.workdir}/${appConfig.stages.main.artifactsDir}`,
                ],
                imageConfig.workdir
            ),
        ])
        .concat(
            appConfig.imageConfig.mappings.map((m) =>
                dockerfile.copyFrom(buildStageName, [m.to], m.to)
            )
        )
        .concat(
            appConfig.imageConfig.envVars.map((e) =>
                dockerfile.env(e.key, e.value)
            )
        )
        .concat(
            dockerfile.expose(
                imageConfig.exposedPorts,
                imageConfig.exposedUpdPorts
            ) ?? []
        )
        .concat(
            appConfig.imageConfig.volumes.flatMap((v) => [
                dockerfile.run(["mkdir", "-p", v]),
                dockerfile.volume(v),
            ])
        )
        .concat([
            dockerfile.entrypoint(imageConfig.entrypoint),
            dockerfile.cmd(imageConfig.command),
        ]);
}
