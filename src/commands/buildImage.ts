import Dockerode from "dockerode";
import path from "path";
import { dockerAliasToString } from "../dockerAlias";
import { AppConfig } from "../config";

export async function buildDockerImage(
    config: AppConfig,
    docker: Dockerode,
    dockerfile: string
) {
    const aliases = config.imageConfig.aliases.map(dockerAliasToString);
    const stream = await docker.buildImage(
        {
            context: path.dirname(dockerfile),
            src: ["."],
        },
        { t: aliases }
    );
    await new Promise((resolve, reject) => {
        docker.modem.followProgress(
            stream,
            (err: any, res: any) => (err ? reject(err) : resolve(res)),
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