# Follows tutorial on https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
FROM node:chakracore-10.13.0

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

# use port 443 as IO port
ENV PORT=443

EXPOSE 443

CMD [ "npm", "start" ]
