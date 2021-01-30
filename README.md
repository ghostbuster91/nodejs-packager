# nodejs-packager

This project draws inspiration from various projects from jvm ecosystem:
- [sbt-native-packager](https://github.com/sbt/sbt-native-packager)
- [jib](https://github.com/GoogleContainerTools/jib)


## Goals of the project
nodejs-packager primary goals is creating a Docker image which can “just run” your nodejs application. At the same time it tries to:
- follow best practices when packaging your application
- be concise
- be easy to use
- cover most popular use-cases

Covering 100% of the use-cases is not a goal of that project. If you have a very specific setup consider getting back to plain `Dockerfile`.
Having said that, most popular use-cases should be covered. If your use-case is not covered please file an issue and we can think what to do with it together.

## Usage 
*Keep in mind that this project is still in experimental phase. Use it at your own risk!*

Install packager globally:
`npm install -g @ghostbuster91/nodejs-packager`

or add to your project:
`npm install --save-dev @ghostbuster91/nodejs-packager`

and add corresponding entries for each relevant command to the `scripts` section of your `package.json` e.g.:
```
"scripts": {
  "docker-build": "nodejs-packager build"
}
```

Commands:
- `build`
  Builds an image using the local Docker server.
- `publish`
  Builds an image using the local Docker server and pubishes it to the remote repository
- `stage` 
  Generates a directory with the Dockerfile and environment prepared for building a Docker image. Usefull mainly for debugging purpose.

```
Usage: nodejs-packager [options] [command]

Options:
  -v, --version           output the version number
  -h, --help              display help for command

Commands:
  stage [options]         Generates a directory with the Dockerfile and environment prepared for creating a Docker image.
  publishLocal [options]  Builds an image using the local Docker server.
  publish [options]       Builds an image using the local Docker server and pubishes it to the remote repository
  clean [options]         Removes the built image from the local Docker server.
  help [command]          display help for command
  ```