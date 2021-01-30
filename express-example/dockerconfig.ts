//import {UserDockerConfig} from 'js-docker-core'

const userConfig = {
imageConfig: {
    baseImage: "node:15-alpine",
    entrypoint: ["node", "index.js"],
    aliases: [{name: "kghost0/node-test-img", tag: "13"}],
    template: 'NPM_JS',
    dockerUpdateLatest: 'false',
    exposedPorts: [3000],
    mappings: [
        {from: "other-resource.txt", to: "/opt/test/other-resource.txt"}
    ],
    envVars: [{key: "DEBUG_ENABLED", value: "TRUE"}],
    volumes: ["/opt/docker/logs"]
}
}	

module.exports = userConfig

