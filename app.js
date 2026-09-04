const path = require('node:path');
const express = require('express');
const logger = require('morgan');

const apiRoutes = require('./apiroutes');
const v2Routes = require('./v2routes');
const pageRoutes = require('./routes/pageRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.locals.entries = [
  { roomNo: 1234, user: '上天大人', chatContent: '你們被不小心困在這裡了，請同心協力一起離開！這裡是留言板，好好溝通吧！' },
  { roomNo: 5678, user: '上天大人', chatContent: '這是上天大人的秘密小房間，呵呵' }
];

app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/', pageRoutes);
app.use('/api', apiRoutes);
app.use('/v2', v2Routes);

app.use('/api', errorHandler.apiNotFoundHandler);
app.use(errorHandler.notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const { startServer } = require('./server');
  startServer(app);
}

module.exports = app;
