import fs from "fs";
import glob from "fast-glob";
import path from "path";
import { AppConfig } from "../config";
import * as dockerfile from "../dockerfile";

export async function stage(cwd: string, appConfig: AppConfig) {
    const dockerImage = createDockerFile(appConfig);

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
    ].concat(layer1Files.map((f) => `**/${f}`));
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



function createDockerFile(appConfig: AppConfig) {
    const buildStageName = "buildStage";
    const mainStageName = "mainStage";
    const buildStage = createBuildStage(buildStageName, appConfig);
    const mainStage = createMainStage(buildStage, mainStageName, appConfig, buildStageName);
    return dockerfile.create(mainStage);
}

function createBuildStage(buildStageName: string, appConfig: AppConfig) {
    const imageConfig = appConfig.imageConfig
    return [
        dockerfile.fromAs(imageConfig.baseImage, buildStageName),
        dockerfile.workdir(imageConfig.workdir),
        dockerfile.multiCopy(
            appConfig.buildStage.depsLayer.files.map((f) => `1/${f}`),
            `${imageConfig.workdir}/`
        ),
    ]
        .concat(
            appConfig.buildStage.depsLayer.commands.map((c) => dockerfile.exec(c.split(" "))
            )
        )
        .concat([
            dockerfile.multiCopy(
                appConfig.buildStage.contentLayer.files.map((f) => `2/${f}`),
                `${imageConfig.workdir}/`
            ),
        ])
        .concat(
            appConfig.buildStage.contentLayer.commands.map((c) => dockerfile.exec(c.split(" "))
            )
        );
}

function createMainStage(buildStage: dockerfile.CmdLike[], mainStageName: string, appConfig: AppConfig, buildStageName: string) {
    const imageConfig = appConfig.imageConfig
    return buildStage
        .concat([
            dockerfile.stageBreak(),
            dockerfile.fromAs(imageConfig.baseImage, mainStageName),
            dockerfile.workdir(imageConfig.workdir),
        ])
        .concat(
            dockerfile.multiCopy(
                appConfig.buildStage.depsLayer.files.map((f) => `1/${f}`),
                `${imageConfig.workdir}/`
            )
        )
        .concat(
            appConfig.mainStage.commands.map((c) => dockerfile.exec(c.split(" "))
            )
        )
        .concat([
            dockerfile.copyFrom(
                buildStageName,
                [`${imageConfig.workdir}/${appConfig.mainStage.artifactsDir}`],
                imageConfig.workdir
            ),
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
}
