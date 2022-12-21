require('dotenv').config()
const express = require('express');
const querrystring = require('querystring');
const axios = require('axios');
const app = express();
const cors = require('cors');
const { PORT } = require('./config');

app.use(express.json())
app.use(cors())

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;


app.get('/', (req, res) => {
  res.status(200).json({ message: 'All ok!' })
})

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
const generateRandomString = length => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = 'spotify_auth_state'

app.get('/login', (req, res) => {
  const state = generateRandomString(16)
  res.cookie(stateKey, state)

  const scope = [
    'user-read-private',
    'user-read-email',
    'user-read-recently-played',
    'user-top-read', 'user-follow-read',
    'user-follow-modify',
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public'
  ].join(' ')

  const querryParams = querrystring.stringify({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    state,
    scope
  })
  res.redirect(`https://accounts.spotify.com/authorize?${querryParams}`)
})

app.get('/callback', (req, res) => {
  const code = req.query.code || null

  axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    data: querrystring.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic  ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
    },
  })
    .then(response => {
      if (response.status === 200) {

        const { access_token, refresh_token, expires_in } = response.data
        const querryParams = querrystring.stringify({
          access_token,
          refresh_token,
          expires_in,
        })

        res.redirect(`http://localhost:5173/?${querryParams}`)

      } else {
        res.redirect(`/?${querrystring.stringify({ error: 'invalid_token' })}`)
      }
    })
    .catch(err => {
      res.send(err)
    })
})

app.get('/refresh_token', (req, res) => {
  const { refresh_token } = req.query

  axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    data: querrystring.stringify({
      grant_type: 'refresh_token',
      refresh_token,
    }),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: `Basic  ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
    },
  })
    .then(response => {
      res.status(200).json(response.data)
    })
    .catch(err => {
      res.send(err)
    })
})

app.get('*', (req, res) => {
  res.send('not found')
})


app.listen(PORT, () => {
  console.log(`Server started at port ${PORT}`)
})

exports.default = app