import Inquirer from "inquirer";
import { getCredentials } from "./credential-helper";
import { Logger } from "./logger";

interface Credentails {
    username: string;
    password: string;
}

export async function acquireCredentials(logger: Logger,
    shouldAuthenticate: boolean
): Promise<Credentails> {
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
        ];
        const response = await Inquirer.prompt(questions);
        return { username: response.username, password: response.password };
    } else {
        const creds = await getCredentials(logger);
        logger.log("Using deamon-wide credentials")
        return { username: creds.Username, password: creds.Secret };
    }
}
