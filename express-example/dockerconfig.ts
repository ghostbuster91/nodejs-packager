 
const simpleGit = require('simple-git');
const git = simpleGit();

module.exports.userConfig=  async () => {
        const lastCommitSha = await git.revparse(['HEAD'])
        console.log(`Using latest commit: ${lastCommitSha}`)
        return {
            imageConfig: {
                baseImage: "node:15-alpine",
                entrypoint: ["node", "index.js"],
                aliases: [{name: "kghost0/node-test-img", tag: lastCommitSha}],
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
    }
    

