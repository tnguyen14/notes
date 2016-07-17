# Notes

[![js-happiness-style](https://img.shields.io/badge/code%20style-happiness-brightgreen.svg)](https://github.com/JedWatson/happiness)

## Usage

- Follow [this instruction](https://developers.google.com/drive/v3/web/quickstart/nodejs#step_1_turn_on_the_api_name) to create a Google API project with the Drive API enabled.
- Instead of Application Type "**Other**", choose "**Web application**"
- Under "Authorized JavaScript origins" and "Authorized redirect URIs", enter your production URL as the first value and development URL as the second (such as `http://localhost:4002`).
- Create a `private` directory and move the downloaded JSON credentials file to `private/client_secret.json`.
- Create a `.env` file with the value of `NODE_ENV` set to either `production` or `development`.
- Add the "Authorized JavaScript origins" to the `.env` file under `AUTHORIZED_ORIGINS`, separated by comma
- Server: `npm run dev` on development, or `npm start` on production.
- Add your server URL as `API_URL` to `.env` file.
