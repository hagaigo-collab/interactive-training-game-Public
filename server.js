import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { customAlphabet } from 'nanoid';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// room: { question: string, items: Map(id -> item) }
// item (תשובה): { id, kind:'answer', name, text, bg, color, x, y }
// item (כותרת): { id, kind:'title', text, x, y }
const rooms = new Map();
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

function ensureRoom(room){
  if (!rooms.has(room)) rooms.set(room, { question: '', items: new Map() });
  return rooms.get(room);
}

app.get('/api/new-room', (req, res) => {
  let code;
  do { code = nanoid(); } while (rooms.has(code));
  rooms.set(code, { question: '', items: new Map() });
  res.json({ room: code });
});

io.on('connection', (socket) => {
  socket.on('joinRoom', ({ room, role }) => {
    if (!room) return;
    socket.join(room);
    const state = ensureRoom(room);
    if (role === 'host') {
      socket.emit('state', {
        question: state.question,
        items: Array.from(state.items.values())
      });
    } else {
      socket.emit('question', state.question);
    }
  });

  // שאלה חדשה – מוחק הכל (כולל כותרות)
  socket.on('setQuestion', ({ room, question }) => {
    const state = ensureRoom(room);
    state.question = String(question || '').trim();
    state.items.clear();
    io.to(room).emit('question', state.question);
    io.to(room).emit('clearItems');
  });

  // תשובת משתתף
  socket.on('submitAnswer', ({ room, name, text, bg, color }) => {
    const state = rooms.get(room);
    if (!state) return;
    const cleanName = String(name || '').trim().slice(0, 40);
    const cleanText = String(text || '').trim().slice(0, 280);
    if (!cleanName || !cleanText) return;

    const id = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const item = {
      id,
      kind: 'answer',
      name: cleanName,
      text: cleanText,
      bg: bg || '#FFE082',
      color: color || '#000000',
      x: 60 + Math.floor(Math.random() * 420),
      y: 180 + Math.floor(Math.random() * 280)
    };
    state.items.set(id, item);
    io.to(room).emit('newItem', item);
  });

  // כותרת של המנחה
  socket.on('addTitle', ({ room, text }) => {
    const state = rooms.get(room);
    if (!state) return;
    const cleanText = String(text || '').trim().slice(0, 80);
    if (!cleanText) return;

    const id = `${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const item = {
      id,
      kind: 'title',
      text: cleanText,
      // צבעים קבועים לכותרת
      x: 40 + Math.floor(Math.random() * 480),
      y: 140 + Math.floor(Math.random() * 180)
    };
    state.items.set(id, item);
    io.to(room).emit('newItem', item);
  });

  // גרירת פריט (גם תשובה וגם כותרת)
  socket.on('moveItem', ({ room, id, x, y }) => {
    const state = rooms.get(room);
    if (!state) return;
    const it = state.items.get(id);
    if (!it) return;
    it.x = Math.max(0, Math.min(2000, x|0));
    it.y = Math.max(0, Math.min(2000, y|0));
    io.to(room).emit('moveItem', { id, x: it.x, y: it.y });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
