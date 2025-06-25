// server/index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS for all origins (adjust if needed)
const io = new Server(server, {
  cors: {
    origin: "*", // Use "https://yourfrontend.com" for more security
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-room', ({ roomId, password }) => {
    rooms[roomId] = { senderId: socket.id, password, viewers: [] };
    socket.join(roomId);
    console.log(`Room created: ${roomId}`);
  });

  socket.on('join-room', ({ roomId, password }) => {
    const room = rooms[roomId];
    if (!room) return socket.emit('error', 'Room does not exist');
    if (room.password && room.password !== password) {
      return socket.emit('password-error', 'Incorrect password');
    }

    socket.join(roomId);
    room.viewers.push(socket.id);
    io.to(room.senderId).emit('viewer-joined', socket.id);
    io.in(roomId).emit('viewer-count', room.viewers.length);
  });

  socket.on('offer', ({ viewerId, offer }) => {
    io.to(viewerId).emit('offer', { offer, senderId: socket.id });
  });

  socket.on('answer', ({ senderId, answer }) => {
    io.to(senderId).emit('answer', { answer, viewerId: socket.id });
  });

  socket.on('candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('candidate', { candidate, senderId: socket.id });
  });

  socket.on('sync', ({ roomId, action }) => {
    socket.to(roomId).emit('sync', action);
  });

  socket.on('stop-stream', (roomId) => {
    socket.to(roomId).emit('stop-stream');
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (socket.id === room.senderId) {
        delete rooms[roomId];
        io.to(roomId).emit('stop-stream');
      } else {
        const index = room.viewers.indexOf(socket.id);
        if (index !== -1) {
          room.viewers.splice(index, 1);
          io.to(roomId).emit('viewer-count', room.viewers.length);
        }
      }
    }
    console.log('Client disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('WebRTC server is running');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT , '0.0.0.0',() => {
  console.log(`Server listening on port ${PORT}`);
});
