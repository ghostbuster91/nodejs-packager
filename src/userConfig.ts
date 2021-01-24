import { DockerAlias } from "./dockerAlias";

export interface AppConfig {
    dockerDir?: string;
    dockerFile?: string;
    depsFiles?: string[];
    imageConfig: ImageConfig;
}

export interface Mapping {
    from: string;
    to: string;
}

export interface EnvVar {
    key: string;
    value: string;
}

export interface ImageConfig {
    baseImage: string;
    workdir?: string;
    exposedPorts?: number[];
    exposedUdpPorts?: number[];
    entrypoint: string[];
    command?: string[];
    aliases: DockerAlias[];
    dockerUpdateLatest?: string;
    template?: string;
    maintainer?: string;
    mappings?: Mapping[];
    envVars?: EnvVar[];
}
