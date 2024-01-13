# Despesas Bot

## How to setup the google sheet

https://medium.com/@sakkeerhussainp/google-sheet-as-your-database-for-node-js-backend-a79fc5a6edd9

Steps to make this:

- create a telegram bot (see tegram docs)
- setup google sheet permissions (see link above)
- create an `.env` file based on the `.env.sample` file with the required info (taken from previous steps)
- install deps with `npm i`
- test the app with `npm run test`
- run the app with `npm run start`
- build the app with `npm run build`

## Deploy

The app is running in `fly.io` service. To deploy, first install the fly cli and login:

```
brew install flyctl

flyctl auth login
```

then, to deploy, run

```bash
fly deploy
```
