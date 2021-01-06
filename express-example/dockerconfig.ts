//import {UserDockerConfig} from 'js-docker-core'

const userConfig = {
baseImage: "node:15-alpine",
entrypoint: ["node", "app.js"],
aliases: [{name: "node-test-img", tag: "11"}]
}	

module.exports = userConfig

