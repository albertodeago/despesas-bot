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

## Infrastructure

The infra is maintained with terraform.
To install terraform follow [this instructions](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli).

Common commands for terraform:
Verify that the terraform files are correct:

```bash
terraform validate
```

See changes and plan the changes:

```bash
terraform plan
```

Apply the changes (deploy infrastructure):

```bash
terraform apply
```
