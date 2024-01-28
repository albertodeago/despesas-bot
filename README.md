# Despesas Bot

## How to use this BOT

TODO: explain that you need to create a google sheet with a certain shape, share it to
a specific email (the BOT one) and then how to use the bot

## How to setup a new BOT

https://medium.com/@sakkeerhussainp/google-sheet-as-your-database-for-node-js-backend-a79fc5a6edd9

Steps to make this:

- create a telegram bot (see telegram docs)
- setup google sheet permissions (see link above)
- create an `.env` file based on the `.env.sample` file with the required info (taken from previous steps)
- install deps with `npm i`
- test the app with `npm run test`
- run the app with `npm run dev`
- build the app with `npm run build`

## Deploy

To deploy just merge a PR in master. A Github workflow will run to automatically bump
the application (based on commit messages) pushing a commit and applying a GIT tag.
The tag will trigger another workflow that will deploy the application in `fly.io`.

### Deploy manually

The app is running in `fly.io` service. To deploy, first install the fly cli and login:

```
brew install flyctl

flyctl auth login
```

then, to deploy, run

```bash
fly deploy
```
