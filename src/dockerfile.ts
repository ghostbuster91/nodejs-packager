export interface CmdLike {

    makeContent(): string
}
/**
 * Volume, Entrypoint, Run, Cmd
 */
class ExecCmd implements CmdLike {
    cmd: string
    args: string[]

    constructor(cmd: string, args: string[]) {
        this.cmd = cmd
        this.args = args
    }
    makeContent(): string {
        return `${this.cmd} ${this.args}\n`
    }
}

/**
 * Add, Copy, Env
 */
class GenericCmd implements CmdLike {
    cmd: string
    args: string[]

    constructor(cmd: string, args: string[]) {
        this.cmd = cmd
        this.args = args
    }
    makeContent(): string {
        return `${this.cmd} ${this.args}\n`
    }
}

/**
 * ONBUILD + CmdLike
 */
class CombinedCmd implements CmdLike {
    cmd: string
    arg: CmdLike

    constructor(cmd: string, arg: CmdLike) {
        this.cmd = cmd
        this.arg = arg
    }
    makeContent(): string {
        return `${this.cmd} ${this.arg.makeContent()}\n`
    }
}

class CommentCmd implements CmdLike {
    comment: string
    constructor(comment: string) {
        this.comment = comment
    }
    makeContent(): string {
        return `# ${this.comment}\n`
    }
}

class DockerStageBreak implements CmdLike {
    makeContent(): string {
        return "\n"
    }
}

class Dockerfile {
    cmds: CmdLike[]
    constructor(cmds: CmdLike[]) {
        this.cmds = cmds
    }

    makeContent(): string {
        return this.cmds.map(x => x.makeContent()).join()
    }
}

export const add = (args: string[]): CmdLike => {
    return new GenericCmd("ADD", args)
}
export const copy = (from: string, to: string): CmdLike => {
    return new GenericCmd("COPY", [from, to])
}
export const copyChown = (from: string, to: string, user: string, group: string) => {
    return new GenericCmd("COPY", [`--chown=${user}:${group} ${from} ${to}`])
}
export const env = (key: string, value: string): CmdLike => {
    return new GenericCmd("ENV", [`${key}="${value}"`])
}

export const volume = (args: string[]): CmdLike => {
    return new ExecCmd("VOLUME", args)
}
export const entrypoint = (args: string[]): CmdLike => {
    return new ExecCmd("ENTRYPOINT", args)
}
export const run = (args: string[]): CmdLike => {
    return new ExecCmd("RUN", args)
}
export const label = (key: string, value: any): CmdLike => {
    return new GenericCmd("LABEL", [key + "=\"" + value.toString() + "\""])
}
export const workdir = (dir: string) => {
    return new GenericCmd("WORKDIR", [dir])
}
export const fromAs = (baseImage: string, name: string) => {
    return new GenericCmd("FROM", [baseImage, "as", name])
}
export const create = (commands: CmdLike[]): string => {
    return new Dockerfile(commands).makeContent()
}
export const stageBreak = () => {
    return new DockerStageBreak()
}
export const chgUser = (user: string, group?: string) => {
    if (group != null) {
        return new GenericCmd("USER", [`${user}:${group}`])
    } else {
        return new GenericCmd("USER", [user])
    }
}
export const npmInstall = () => {
    return new ExecCmd("RUN", ["npm", "install"])
}
export const expose = (ports: number[]) => {
    return new GenericCmd("EXPOSE", ports.map(p => p.toString()))
}
export const cmd = (args: string[]) => {
    return new ExecCmd("CMD", args)
}