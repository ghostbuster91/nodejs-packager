import chalk from "chalk";

export enum Level {
    SILENT = "SILENT",
    ERROR = "ERROR",
    WARN = "WARN",
    INFO = "INFO",
    DEBUG = "DEBUG",
    TRACE = "TRACE",
}

export class Logger {
    private level: Level;
    constructor(level: Level) {
        this.level = level;
    }

    static fromArgs(cmdObject: any): Logger {
        try {
            return new Logger(Level[cmdObject.logLevel as keyof typeof Level]);
        } catch (ex) {
            console.log(`Unsupported log level :${cmdObject.log_level}`);
            throw ex;
        }
    }

    error(msg: string): void {
        console.error(chalk.red(msg));
    }

    warn(msg: string): void {
        if (
            this.level == Level.WARN ||
            this.level == Level.INFO ||
            this.level == Level.TRACE ||
            this.level == Level.DEBUG
        ) {
            console.warn(chalk.yellow(msg));
        }
    }

    log(msg: string): void {
        if (
            this.level == Level.INFO ||
            this.level == Level.TRACE ||
            this.level == Level.DEBUG
        ) {
            console.info(msg);
        }
    }

    debug(msg: string): void {
        if (this.level == Level.TRACE || this.level == Level.DEBUG) {
            console.debug(msg);
        }
    }

    trace(msg: string): void {
        if (this.level == Level.TRACE) {
            console.trace(msg);
        }
    }
}
