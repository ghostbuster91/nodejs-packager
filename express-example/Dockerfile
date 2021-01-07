FROM node:15-alpine as mainstage
WORKDIR /home/node/app
COPY package.json package-lock.json /home/node/app/
RUN ["npm", "install"]
COPY . /home/node/app
ENTRYPOINT ["node", "app.js"]
CMD []
