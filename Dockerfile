
FROM node:8

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY ./main .
RUN npm install

# Bundle app source

# Expose port and start the application
EXPOSE 3000
CMD npm run dev