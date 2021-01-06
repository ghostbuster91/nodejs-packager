#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const baseDockerFile = `
FROM node:10-alpine

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY package*.json ./

USER node

RUN npm install

COPY --chown=node:node . .

EXPOSE 8080

CMD [ "node", "app.js" ]`;
const buildDockerImage = () => {
    return;
};
fs_1.default.writeFileSync(`${process.cwd()}/foo.txt`, baseDockerFile, { encoding: 'utf8' });
console.log(`${process.cwd()}`);
console.log(`${path_1.default.dirname('./')}`);
console.log(`${path_1.default.normalize('./')}`);
console.log('Hello typescript 4!');
//# sourceMappingURL=index.js.map