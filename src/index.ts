#!/usr/bin/env node

import fs from 'fs';
import * as dockerfile from './dockerfile'

export interface UserDockerConfig {
    baseImage: string,
    workdir?: string,
    exposedPorts?: number[],
    exposedUdpPorts?: number[],
    targetDirectory?: string,
    targetFile?: string
    entrypoint: string[],
    command?: string[]
}

interface DockerConfig {
    baseImage: string,
    workdir: string,
    exposedPorts: number[],
    exposedUpdPorts: number[],
    targetDirectory: string,
    targetFile: string
    entrypoint: string[],
    command: string[]
}

const cwd = process.cwd()
console.log(`Current working directory: ${cwd}`)

async function run() {
    const userConfig: UserDockerConfig = await import(`${cwd}/dockerconfig.ts`)
    console.log(`UserConfig: ${JSON.stringify(userConfig)}`)
    const createConfig = (userConfig: UserDockerConfig): DockerConfig => {
        return {
            baseImage: userConfig.baseImage,
            workdir: userConfig.workdir ?? "/home/node/app",
            exposedPorts: userConfig.exposedPorts ?? [],
            exposedUpdPorts: userConfig.exposedUdpPorts ?? [],
            targetDirectory: userConfig.targetDirectory ?? "docker",
            targetFile: userConfig.targetFile ?? "Dockerfile",
            entrypoint: userConfig.entrypoint,
            command: userConfig.command ?? []
        }
    }

    const config: DockerConfig = createConfig(userConfig)


    const mainstage = [
        dockerfile.fromAs(config.baseImage, "mainstage"),
        dockerfile.workdir(config.workdir),
        dockerfile.copy("package*.json", config.workdir),
        dockerfile.chgUser("node"),
        dockerfile.npmInstall(),
        dockerfile.copyChown(".", config.workdir, "node", "node")
    ]
        .concat(dockerfile.expose(config.exposedPorts, config.exposedPorts) ?? [])
        .concat([dockerfile.entrypoint(config.entrypoint), dockerfile.cmd(config.command)]);

    const dockerImage = dockerfile.create(mainstage)

    const targetPath = `${cwd}/${config.targetDirectory}`
    await fs.promises.mkdir(targetPath, { recursive: true })
    await fs.promises.writeFile(`${targetPath}/${config.targetFile}`, dockerImage, { encoding: 'utf-8' })
    console.log('Done')
}
run()

const baseDockerFile = `
FROM node:10-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm install

COPY --chown=node:node . .

EXPOSE 8080

CMD [ "node", "app.js" ]`