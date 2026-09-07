const express = require('express');

const router = express.Router();

router.get('/', (request, response) => {
  response.render('index', { info: 'This is lobby' });
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

router.post('/PostcreateRoom', (request, response) => {
  request.app.locals.entries.push({
    roomNo: request.body.roomNo,
    user: '上天大人',
    chatContent: '又有一個人進來了呢，你們被困在這裡了，請好好加油逃脫吧'
  });

  response.redirect(`/v2/${request.body.roomNo}`);
});

router.post('/PostEnterRoom2', (request, response) => {
  request.app.locals.entries.push({
    roomNo: request.body.roomNo,
    user: '公共場合使用者',
    chatContent: request.body.chatContent
  });

  response.redirect(`/v2/${request.body.roomNo}`);
});

router.post('/PostEnterRoomB', (request, response) => {
  request.app.locals.entries.push({
    roomNo: request.body.roomNo,
    user: 'B',
    chatContent: request.body.chatContent
  });

  response.redirect(`/v2/${request.body.roomNo}/B`);
});

router.get('/enterRoom', (request, response) => {
  response.render('enterRoom', { info: 'This is inside the Room' });
});

router.post('/PostenterRoom', (request, response) => {
  request.app.locals.entries.push({ chatContent: request.body.chatContent });
  response.redirect('/enterRoom');
});

router.get('/test', (request, response) => {
  response.render('test');
});

router.post('/searchResult', (request, response) => {
  request.app.locals.entries.push({ searchNumber: request.body.searchNumber });
  response.redirect('/test');
});

module.exports = router;
