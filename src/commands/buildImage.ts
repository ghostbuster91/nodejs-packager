import Dockerode from "dockerode";
import path from "path";
import { dockerAliasToString } from "../dockerAlias";
import { AppConfig } from "../config";
import { Logger } from "../logger";

export async function buildDockerImage(
    config: AppConfig,
    docker: Dockerode,
    dockerfile: string,
    logger: Logger
): Promise<any> {
    logger.log("Building docker image...");
    const aliases = config.imageConfig.aliases.map(dockerAliasToString);
    const stream = await docker.buildImage(
        {
            context: path.dirname(dockerfile),
            src: ["."],
        },
        { t: aliases }
    );
    followProgress(docker, stream, logger);
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
    errorDetail: ErrorDetail;
}
interface StatusMessage extends Message {
    status: string;
}
interface ErrorDetail {
    message: any;
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
function isStatusMessage(msg: Message): msg is StatusMessage {
    return "status" in msg;
}

export async function followProgress(
    docker: Dockerode,
    stream: NodeJS.ReadableStream,
    logger: Logger
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
                            logger.log(textWithoutNewLines);
                        }
                    }
                } else if (isErrorMessage(msg)) {
                    logger.error(msg.error);
                    logger.debug(JSON.stringify(msg.errorDetail.message))
                } else if (isAuxMessage(msg)) {
                    logger.debug(JSON.stringify(msg.aux));
                } else if (isStatusMessage(msg)) {
                    logger.trace(JSON.stringify(msg));
                    logger.log(msg.status);
                } else {
                    logger.warn(
                        `Unrecognized msg from docker daemon ${JSON.stringify(
                            msg
                        )}`
                    );
                }
            }
        );
    });
}
