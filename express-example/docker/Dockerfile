FROM node as mainstage
WORKDIR /home/node/app
COPY package*.json /home/node/app
USER node
RUN ["npm", "install"]
COPY --chown=node:node . /home/node/app
ENTRYPOINT ["node", "app.js"]
CMD []
