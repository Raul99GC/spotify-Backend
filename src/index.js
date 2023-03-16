const Cookie = require('cookie')
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
const timeStampKey = 'spotify_token_timestamp'

app.get('/login', (req, res) => {
  const state = generateRandomString(16)
  res.cookie(stateKey, state)
  res.cookie(timeStampKey, Date.now())

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
      authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
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
        const cookies = [
          Cookie.serialize('spotify_access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60,
            sameSite: 'strict',
            path: '/'
          }),
          Cookie.serialize('spotify_refresh_token', refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60,
            sameSite: 'strict',
            path: '/'
          })
        ]
        res.status = 200
        res.setHeader('Set-Cookie', cookies)
        res.redirect(`http://localhost:3000/`)

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
      authorization: `Basic ${new Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
    },
  })
    .then(response => {
      if (response.status === 200) {

        const { access_token, expires_in } = response.data
        const dataTokens = {
          access_token,
          expires_in,
        }

        const cookies = [
          Cookie.serialize('spotify_access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60,
            sameSite: 'strict',
            path: '/'
          }),
          Cookie.serialize('spotify_token_timestamp', Date.now(), {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            maxAge: 60 * 60,
            sameSite: 'strict',
            path: '/'
          })
        ]
        res.setHeader('Set-Cookie', cookies)
        res.status(200)


      } else {
        res.status(400).json({ error: 'invalid_token' })
      }
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