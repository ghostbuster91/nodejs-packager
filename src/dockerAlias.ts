export interface DockerAlias {
    registryHost?: string;
    username?: string;
    name: string;
    tag?: string;
}
export const dockerAliasToString = (alias: DockerAlias): string => {
    return (
        (alias.registryHost ? `${alias.registryHost}/` : "") +
        (alias.username ? `${alias.username}/` : "") +
        alias.name +
        (alias.tag ? `:${alias.tag}` : "")
    );
};

export const dockerAliasWithTag = (alias: DockerAlias, tag: string): DockerAlias => {
    return { tag, ...alias };
};