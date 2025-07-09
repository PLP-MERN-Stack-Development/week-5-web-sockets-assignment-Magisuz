const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Store users: { socket.id: { username, id, room } }
const users = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user joining
  socket.on('user_join', ({ username, room }) => {
    users[socket.id] = { username, id: socket.id, room };
    socket.join(room);
    // Emit user list to the room only
    io.to(room).emit('user_list', Object.values(users).filter(u => u.room === room));
    io.to(room).emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined the room: ${room}`);
  });

  // Handle room messages
  socket.on('send_message', ({ message, room, file }) => {
    const sender = users[socket.id]?.username || 'Anonymous';
    const messageData = {
      id: Date.now(),
      sender,
      senderId: socket.id,
      message,
      room,
      timestamp: new Date().toISOString(),
    };
    if (file) {
      messageData.file = file;
    }
    io.to(room).emit('receive_message', messageData);
  });

  // Handle private messages (within the same room)
  socket.on('private_message', ({ to, message }) => {
    const sender = users[socket.id]?.username || 'Anonymous';
    const room = users[socket.id]?.room;
    const messageData = {
      id: Date.now(),
      sender,
      senderId: socket.id,
      message,
      room,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };
    // Send to recipient
    socket.to(to).emit('private_message', messageData);
    // Also send to sender
    socket.emit('private_message', messageData);
  });

  // Handle message reactions
  socket.on('message_reaction', ({ messageId, reaction }) => {
    const userId = socket.id;
    // This part of the code was not provided in the original file,
    // so we'll assume 'messages' and 'messages[messageId]' are defined elsewhere
    // or this functionality will be added later.
    // For now, we'll just log the reaction and acknowledge it.
    console.log(`User ${userId} reacted with ${reaction} to message ${messageId}`);
    // In a real application, you would update a 'messages' object
    // and emit 'message_reaction_update' to the room.
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const { username, room } = user;
      io.to(room).emit('user_left', { username, id: socket.id });
      delete users[socket.id];
      // Update user list in the room
      io.to(room).emit('user_list', Object.values(users).filter(u => u.room === room));
      console.log(`${username} left the room: ${room}`);
    }
  });
});

app.get('/', (req, res) => {
  res.send('Server is running!');
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
}); 