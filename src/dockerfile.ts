interface CmdLike {

    makeContent() : string
}
/**
 * Volume, Entrypoint, Run, Cmd
 */
class ExecCmd implements CmdLike {
    cmd: string
    args: [string]

    constructor(cmd:string, args: [string]){
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
    args: [string]

    constructor(cmd:string, args: [string]){
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

    constructor(cmd:string, arg: CmdLike){
        this.cmd = cmd
        this.arg = arg
    }
    makeContent(): string {
        return `${this.cmd} ${this.arg.makeContent()}\n`
    }
}

class CommentCmd implements CmdLike {
    comment : string
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
    cmds: [CmdLike]
    constructor(cmds: [CmdLike]) {
        this.cmds = cmds
    }

    makeContent() : string {
        return this.cmds.map(x=> x.makeContent()).join()
    }
}

const add = (args : [string]): CmdLike => {
    return new GenericCmd("ADD", args)
}
const copy = (args : [string]): CmdLike => {
    return new GenericCmd("COPY", args)
}
const env = (args : [string]): CmdLike => {
    return new GenericCmd("ENV", args)
}

const volume = (args : [string]): CmdLike => {
    return new ExecCmd("VOLUME", args)
}
const entrypoint = (args : [string]): CmdLike => {
    return new ExecCmd("ENTRYPOINT", args)
}
const run = (args : [string]): CmdLike => {
    return new ExecCmd("RUN", args)
}
const cmd = (args : [string]): CmdLike => {
    return new ExecCmd("CMD", args)
}