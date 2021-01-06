#!/usr/bin/env node

import fs from 'fs';
import path from 'path';


interface DockerConfig {
    baseImage: string
}

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

const buildDockerImage = () => {
    return ;
  }

fs.writeFileSync(`${process.cwd()}/foo.txt`,baseDockerFile, {encoding: 'utf8'} );


console.log(`${process.cwd()}`)
console.log(`${path.dirname('./')}`)
console.log(`${path.normalize('./')}`)
console.log('Hello typescript 4!')
