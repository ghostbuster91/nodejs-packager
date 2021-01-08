import { Image } from 'dockerode';
import {DockerAlias,dockerAliasWithTag,dockerAliasToString} from './dockerAlias'

export interface AppConfig {
    dockerDir?: string;
    dockerFile?: string;
    depsFiles?: string[];
    imageConfig: ImageConfig
}

export interface ImageConfig {
    baseImage: string;
    workdir?: string;
    exposedPorts?: number[];
    exposedUdpPorts?: number[];
    entrypoint: string[];
    command?: string[];
    aliases: DockerAlias[];
    dockerUpdateLatest?: boolean;
}