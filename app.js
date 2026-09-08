const path = require('node:path');
const express = require('express');
const logger = require('morgan');

const { createApiRoutes } = require('./routes/apiRoutes');
const { createRoomStore } = require('./game/roomStore');
const { createRoomRoutes } = require('./routes/roomRoutes');
const pageRoutes = require('./routes/pageRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const roomStore = createRoomStore();

app.locals.roomStore = roomStore;

app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(logger('dev', {
  skip: (request) => request.app.get('env') === 'test'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', createRoomRoutes(roomStore));
app.use('/api', createApiRoutes(roomStore));
app.use('/', pageRoutes);

app.use('/api', errorHandler.apiNotFoundHandler);
app.use(errorHandler.notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const { startServer } = require('./server');
  startServer(app);
}

module.exports = app;
