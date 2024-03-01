# DespesasBot

<p align="center">
   <img src="docs/despesas-bot-prod.jpeg" width="150"/>
</p>

A telegram bot to track expenses in a google sheet (owned by you).

## How to use this BOT

The steps to use this bot are:

1. Create a google sheet following the structure of [this one](https://docs.google.com/spreadsheets/d/1iKU8z1Oa6odHcjkiHCW1tfFLKNsi6SEb3Wgmcz_Twfk/edit?usp=sharing)(or duplicate it). ⚠️ Don't rename the tabs ⚠️
   1.1 Make sure to change the categories to your own, but **beware**, a category can't have spaces and the first level (column A) must be unique
   1.2 You can remove the example expenses that are already in the `Spese` tab
2. Share this google sheet to the bot email (`despesasserviceaccount@despesasbot.iam.gserviceaccount.com`) with edit permissions
3. Open a chat with the bot in telegram and run `/start <spreadsheet_id>` where `<spreadsheet_id>` is the id of the google sheet. You can find it in the URL of the sheet. For example for this `https://docs.google.com/spreadsheets/d/1iKU8z1Oa6odHcjkiHCW1tfFLKNsi6SEb3Wgmcz_Twfk/edit?usp=sharing` the id is `1iKU8z1Oa6odHcjkiHCW1tfFLKNsi6SEb3Wgmcz_Twfk` (so last part of the URL before the `/edit...`)
   3.1 If everything went well, the bot will reply with a message saying that the sheet was successfully connected

You can find this info also in the [the docs](https://albertodeago.github.io/despesas-bot/)

## Run locally

To contribute you should first create a `.env` file based on the `.env.sample` file.

To install dependencies

```sh
npm install
```

To run the tests

```sh
npm run test
# or npm run test:watch to run them in watch mode
```

To run the app in development mode

```sh
npm run dev
```

To test the app without impacting production, there is a `dev bot` that you can use.
You can find it in telegram with the id `@IdDespesasDevBot` (production one is `@IdDespesasBot`).
The dev bot will be up-and-running when you use the `npm run dev` command.

### Command list for the BotFather

```txt
help - per avere una descrizione di cosa può fare il bot
start - per iniziare a tracciare le spese
stop - per smettere di tracciare le spese (spegne il bot nella chat)
categorie - per avere una lista delle tue categorie
aggiungi - per aggiungere una spesa
```

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

## Creating another instance of a bot like this

This Bot leverages google service accounts to have a secure way to access the google sheet.
A service account is like a user, but it's not a real person, it's a bot. It can be given permissions to access a google sheet and then it can be used to access it from a server.

A guide that explain this process can be found [here](https://medium.com/@sakkeerhussainp/google-sheet-as-your-database-for-node-js-backend-a79fc5a6edd9).

Following that guide you can create a service account, you can then use the values to populate the `.env` file and then you can run another instance of the bot.
You will also need to create a telegram bot (see telegram docs for that, it's excellent).
