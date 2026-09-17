const express = require('express');

const router = express.Router();

router.get('/', (request, response) => {
  response.render('index');
});

router.get('/inputRoomNo', (request, response) => {
  response.redirect(303, '/');
});

router.get('/createRoom', (request, response) => {
  response.redirect(303, '/');
});

router.get('/v2/:roomCode/A', (request, response) => {
  response.redirect(303, `/rooms/${request.params.roomCode}`);
});

router.get('/v2/:roomCode/B', (request, response) => {
  response.redirect(303, `/rooms/${request.params.roomCode}`);
});

router.get('/v2/:roomCode', (request, response) => {
  response.redirect(303, `/rooms/${request.params.roomCode}`);
});

module.exports = router;
