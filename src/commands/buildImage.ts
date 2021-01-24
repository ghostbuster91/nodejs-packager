import Dockerode from "dockerode";
import path from "path";
import { dockerAliasToString } from "../dockerAlias";
import { AppConfig } from "../config";

export async function buildDockerImage(
    config: AppConfig,
    docker: Dockerode,
    dockerfile: string
): Promise<any> {
    console.log("Building docker image...");
    const aliases = config.imageConfig.aliases.map(dockerAliasToString);
    const stream = await docker.buildImage(
        {
            context: path.dirname(dockerfile),
            src: ["."],
        },
        { t: aliases }
    );
    followProgress(docker, stream);
}

export async function followProgress(
    docker: Dockerode,
    stream: NodeJS.ReadableStream
): Promise<any> {
    return new Promise((resolve, reject) => {
        docker.modem.followProgress(
            stream,
            (err: any, res: any) => {
                if (err) {
                    console.error(JSON.stringify(err));
                    reject(err);
                } else {
                    console.log(`# ${JSON.stringify(res)}`);
                    resolve(res);
                }
            },
            (a: any) => {
                const upstreamText: string = a.stream;
                if (upstreamText) {
                    const textWithoutNewLines: string = upstreamText.replace(
                        "\n",
                        ""
                    );
                    if (textWithoutNewLines) {
                        console.log(textWithoutNewLines);
                    }
                }
            }
        );
    });
}
