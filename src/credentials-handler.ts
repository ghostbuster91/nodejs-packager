import Inquirer from "inquirer";
import { getCredentials } from "./credential-helper";
import { Logger } from "./logger";

export interface Credentials {
    username: string;
    password: string;
    registry: string;
}

//TODO is registry needed for pushing?
export async function acquireCredentials(
    logger: Logger,
    shouldAuthenticate: boolean
): Promise<Credentials> {
    if (shouldAuthenticate) {
        const questions = [
            {
                type: "input",
                name: "username",
                message: "Username",
            },
            {
                type: "password",
                name: "password",
                message: "Password",
            },
            {
                type: "input",
                name: "registry",
                message: "Registry",
                default: "https://index.docker.io/v1",
            },
        ];
        const response = await Inquirer.prompt(questions);
        return {
            username: response.username,
            password: response.password,
            registry: response.registry,
        };
    } else {
        const creds = await getCredentials(logger);
        logger.log("Using daemon-wide credentials");
        return {
            username: creds.Username,
            password: creds.Secret,
            registry: creds.ServerURL,
        };
    }
}
