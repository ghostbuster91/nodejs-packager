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

interface Message {}
interface AuxMessage extends Message {
    aux: any;
}
interface TextMessage extends Message {
    stream: string;
}
interface ErrorMessage extends Message {
    error: string;
}

function isTextMessage(msg: Message): msg is TextMessage {
    return "stream" in msg;
}

function isErrorMessage(msg: Message): msg is ErrorMessage {
    return "error" in msg;
}
function isAuxMessage(msg: Message): msg is AuxMessage {
    return "aux" in msg;
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
                    resolve(res);
                }
            },
            (msg: Message) => {
                if (isTextMessage(msg)) {
                    const upstreamText = msg.stream;
                    if (upstreamText) {
                        const textWithoutNewLines: string = upstreamText.replace(
                            "\n",
                            ""
                        );
                        if (textWithoutNewLines) {
                            console.log(textWithoutNewLines);
                        }
                    }
                } else if (isErrorMessage(msg)) {
                    console.error(msg.error);
                } else if (isAuxMessage(msg)) {
                    console.debug(JSON.stringify(msg.aux));
                } else {
                    console.warn(`Unrecognized msg from docker daemon ${JSON.stringify(msg)}`);
                }
            }
        );
    });
}
