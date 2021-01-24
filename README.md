# nodejs-packager

This project is heavily inspired by its bigger brother from the scala environment - [`sbt-native-packager`](https://github.com/sbt/sbt-native-packager)


## Goals of the project
nodejs-packager primary goals is creating a Docker image which can “just run” your nodejs application. At the same time it tries to:
- follow best practices when packaging your application
- be concise
- be easy to use

## Usage 
Install packager globally:
`npm install -g @ghostbuster91/nodejs-packager`

or add to your project:
`npm install --save-dev @ghostbuster91/nodejs-packager`

and add corresponding entries for each relevant command to the `scripts` section of your `package.json` e.g.:
```
"scripts": {
  "docker-stage": "nodejs-packager stage"
}
```

## Usage
