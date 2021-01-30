const userConfig = {
                    imageConfig: {
                        baseImage: "node:15-alpine",
                        entrypoint: ["node", "index.js"],
                        template: 'NPM_JS',
                        aliases: [{name: "nodejs-example-alias", tag: "latest"}],
                    }
                    }	
                    
                    module.exports = userConfig