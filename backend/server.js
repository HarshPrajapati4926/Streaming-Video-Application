const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const rooms = new Map(); // roomId -> { senderId, viewers: Set<socket.id>, password }

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Room creation by sender
  socket.on('create-room', (data = {}) => {
    const { password = null } = data;
    const roomId = uuidv4();
    rooms.set(roomId, { senderId: socket.id, viewers: new Set(), password });
    socket.join(roomId);
    socket.emit('room-created', roomId);
    console.log(`Room created: ${roomId} (password protected: ${!!password})`);
  });

  // Set password (optional separate handler)
  socket.on('set-password', ({ roomId, password }) => {
    const room = rooms.get(roomId);
    if (room && room.senderId === socket.id) {
      room.password = password;
      socket.emit('password-set', true);
      console.log(`Password set for room ${roomId}`);
    }
  });

  // Viewer joins a room
  socket.on('join-room', ({ roomId, password }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room-not-found');
      return;
    }

    // Check password if required
    if (room.password && room.password !== password) {
      socket.emit('wrong-password');
      return;
    }

    room.viewers.add(socket.id);
    socket.join(roomId);
    socket.emit('room-joined', { senderId: room.senderId });
    io.to(roomId).emit('viewer-count', room.viewers.size);

    console.log(`Viewer ${socket.id} joined room ${roomId}`);
  });

  // WebRTC signaling
  socket.on('offer', ({ targetId, offer }) => {
    io.to(targetId).emit('offer', { senderId: socket.id, offer });
  });

  socket.on('answer', ({ targetId, answer }) => {
    io.to(targetId).emit('answer', { senderId: socket.id, answer });
  });

  socket.on('ice-candidate', ({ targetId, candidate }) => {
    io.to(targetId).emit('ice-candidate', { senderId: socket.id, candidate });
  });

  // Viewer sync controls
  socket.on('sync-play', (roomId) => {
    socket.to(roomId).emit('sync-play');
  });

  socket.on('sync-pause', (roomId) => {
    socket.to(roomId).emit('sync-pause');
  });

  socket.on('sync-stop', (roomId) => {
    socket.to(roomId).emit('sync-stop');
  });

  // Reset stream
  socket.on('reset', (roomId) => {
    const room = rooms.get(roomId);
    if (room) {
      io.to(roomId).emit('reset');
      room.viewers.forEach(viewerId => {
        io.sockets.sockets.get(viewerId)?.leave(roomId);
      });
      room.viewers.clear();
      io.to(roomId).emit('viewer-count', 0);
      console.log(`Room ${roomId} has been reset`);
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Find if socket was a sender or viewer
    for (const [roomId, room] of rooms.entries()) {
      if (room.senderId === socket.id) {
        // End the stream for all viewers
        io.to(roomId).emit('stream-ended');
        rooms.delete(roomId);
        console.log(`Sender disconnected. Room ${roomId} removed.`);
      } else if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);
        io.to(roomId).emit('viewer-count', room.viewers.size);
        console.log(`Viewer ${socket.id} left room ${roomId}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0',() => {
  console.log(`Server running on port ${PORT}`);
});
