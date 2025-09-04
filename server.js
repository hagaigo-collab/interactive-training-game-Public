const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// מצב חדרים
const rooms = new Map();

function makeRoomCode() {
  return crypto.randomBytes(2).toString('hex').toUpperCase();
}

app.get('/api/new-room', (req, res) => {
  const room = makeRoomCode();
  rooms.set(room, {
    question: '',
    items: new Map(),
    style: {
      boardBg: '#ffffff',
      titleBg: '#FFEB3B',
      titleColor: '#000000',
    },
    prefs: {
      showNamesOnBoard: true,
    },
  });
  res.json({ room });
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ room, role }) => {
    if (!rooms.has(room)) {
      rooms.set(room, {
        question: '',
        items: new Map(),
        style: {
          boardBg: '#ffffff',
          titleBg: '#FFEB3B',
          titleColor: '#000000',
        },
        prefs: { showNamesOnBoard: true },
      });
    }
    socket.join(room);
    const state = rooms.get(room);
    socket.emit('state', {
      question: state.question,
      items: Array.from(state.items.values()),
      style: state.style,
      prefs: state.prefs,
    });
  });

  socket.on('setQuestion', ({ room, question }) => {
    const state = rooms.get(room);
    if (!state) return;
    state.question = question;
    state.items.clear();
    io.to(room).emit('question', question);
    io.to(room).emit('clearItems');
  });

  socket.on('submitAnswer', ({ room, name, text, bg, color, borderColor }) => {
    const state = rooms.get(room);
    if (!state) return;
    const id = crypto.randomBytes(6).toString('hex');
    // מיקום התחלתי פשוט: פיזור רנדומלי (אפשר לשפר לאלגוריתם "חכם")
    const x = Math.floor(Math.random() * 400);
    const y = Math.floor(Math.random() * 300) + 120;
    const item = {
      id,
      kind: 'answer',
      name,
      text,
      bg,
      color,
      borderColor,
      x,
      y,
      width: 280,
      height: 100,
      z: 1,
    };
    state.items.set(id, item);
    io.to(room).emit('newItem', item);
  });

  socket.on('addTitle', ({ room, text }) => {
    const state = rooms.get(room);
    if (!state) return;
    const id = crypto.randomBytes(6).toString('hex');
    const x = 20;
    const y = 80;
    const item = {
      id,
      kind: 'title',
      text,
      bg: state.style.titleBg,
      color: state.style.titleColor,
      borderColor: '#000000',
      x,
      y,
      width: 320,
      height: 80,
      z: 1,
    };
    state.items.set(id, item);
    io.to(room).emit('newItem', item);
  });

  socket.on('moveItem', ({ room, id, x, y }) => {
    const state = rooms.get(room);
    if (!state) return;
    const item = state.items.get(id);
    if (!item) return;
    item.x = x;
    item.y = y;
    item.z = (item.z || 1) + 1;
    io.to(room).emit('moveItem', { id, x, y, z: item.z });
  });

  socket.on('resizeItem', ({ room, id, width, height }) => {
    const state = rooms.get(room);
    if (!state) return;
    const item = state.items.get(id);
    if (!item) return;
    item.width = width;
    item.height = height;
    io.to(room).emit('resizeItem', { id, width, height });
  });

  socket.on('setRoomStyle', ({ room, style }) => {
    const state = rooms.get(room);
    if (!state) return;
    state.style = { ...state.style, ...style };
    io.to(room).emit('roomStyle', state.style);
  });

  socket.on('setBoardPrefs', ({ room, prefs }) => {
    const state = rooms.get(room);
    if (!state) return;
    state.prefs = { ...state.prefs, ...prefs };
    io.to(room).emit('boardPrefs', state.prefs);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
