const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: 'http://localhost:5173', methods: ['GET','POST'] }
});

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const rooms = {};

function makeCode() {
  return Math.random().toString(36).slice(2,8).toUpperCase();
}

function roomOf(socketId) {
  return Object.entries(rooms).find(([, r]) =>
    r.deaf === socketId || r.hearing === socketId
  );
}

app.get('/api/health', (_, res) => res.json({ status: 'ok', rooms: Object.keys(rooms).length }));

io.on('connection', (socket) => {
  console.log('[+]', socket.id);

  socket.on('room:create', ({ role }, cb) => {
    const code = makeCode();
    rooms[code] = { deaf: null, hearing: null, logs: [] };
    rooms[code][role] = socket.id;
    socket.join(code);
    console.log('[ROOM] created', code, 'by', role);
    cb({ code });
  });

  socket.on('room:join', ({ code, role }, cb) => {
    const room = rooms[code];
    if (!room)       return cb({ error: 'Room not found' });
    if (room[role])  return cb({ error: role + ' seat already taken' });
    room[role] = socket.id;
    socket.join(code);
    console.log('[ROOM]', role, 'joined', code);
    socket.to(code).emit('peer:joined', { role });
    cb({ ok: true });
  });

  socket.on('rtc:offer',  ({ code, offer })     => socket.to(code).emit('rtc:offer',  { offer }));
  socket.on('rtc:answer', ({ code, answer })    => socket.to(code).emit('rtc:answer', { answer }));
  socket.on('rtc:ice',    ({ code, candidate }) => socket.to(code).emit('rtc:ice',    { candidate }));

  socket.on('gesture:detected', ({ code, gesture, confidence }) => {
    const entry = { gesture, confidence, timestamp: new Date().toISOString(), id: Date.now() };
    if (rooms[code]) rooms[code].logs.unshift(entry);
    socket.to(code).emit('gesture:incoming', entry);
    socket.emit('gesture:logged', entry);
  });

  socket.on('reply:send', ({ code, text }) => {
    socket.to(code).emit('reply:incoming', { text, timestamp: new Date().toISOString() });
  });

  socket.on('disconnect', () => {
    console.log('[-]', socket.id);
    const found = roomOf(socket.id);
    if (!found) return;
    const [code, room] = found;
    const role = room.deaf === socket.id ? 'deaf' : 'hearing';
    room[role] = null;
    socket.to(code).emit('peer:left', { role });
    if (!room.deaf && !room.hearing) { delete rooms[code]; }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log('\n🚀 GestureSpeak server  http://localhost:' + PORT + '\n'));
