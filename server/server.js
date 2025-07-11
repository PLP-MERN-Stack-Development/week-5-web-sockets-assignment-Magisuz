const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const PORT = 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Add chat namespace
const chatNamespace = io.of('/chat');

// Store users: { socket.id: { username, id, room } }
const users = {};

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const messageSchema = new mongoose.Schema({
  sender: String,
  senderId: String,
  recipientId: String, // for private messages
  message: String,
  room: String,
  timestamp: { type: Date, default: Date.now },
  isPrivate: Boolean,
  file: {
    name: String,
    type: String,
    data: String, // base64
  },
  system: Boolean,
});

const Message = mongoose.model('Message', messageSchema);

chatNamespace.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Handle user joining
  socket.on('user_join', ({ username, room }) => {
    users[socket.id] = { username, id: socket.id, room };
    socket.join(room);
    // Emit user list to the room only
    chatNamespace.to(room).emit('user_list', Object.values(users).filter(u => u.room === room));
    chatNamespace.to(room).emit('user_joined', { username, id: socket.id });
    console.log(`${username} joined the room: ${room}`);
  });

  // Handle room messages
  socket.on('send_message', async ({ message, room, file, id }, ack) => {
    const sender = users[socket.id]?.username || 'Anonymous';
    const messageData = {
      id: id || Date.now(),
      sender,
      senderId: socket.id,
      message,
      room,
      timestamp: new Date().toISOString(),
    };
    if (file) {
      messageData.file = file;
    }
    chatNamespace.to(room).emit('receive_message', messageData);
    if (typeof ack === 'function') ack({ delivered: true, id: messageData.id });
    (async () => {
      try {
        await Message.create(messageData);
      } catch (err) {
        console.error('Error saving message:', err);
      }
    })();
  });

  // Handle private messages (within the same room)
  socket.on('private_message', async ({ to, message, id }, ack) => {
    const sender = users[socket.id]?.username || 'Anonymous';
    const room = users[socket.id]?.room;
    const messageData = {
      id: id || Date.now(),
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
    if (typeof ack === 'function') ack({ delivered: true, id: messageData.id });
    (async () => {
      try {
        await Message.create({ ...messageData, recipientId: to });
      } catch (err) {
        console.error('Error saving private message:', err);
      }
    })();
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

  // Add a socket event for paginated message fetch:
  socket.on('get_messages', async ({ room, before, limit = 20 }, cb) => {
    try {
      const query = { room, isPrivate: { $ne: true } };
      if (before) {
        query.timestamp = { $lt: new Date(before) };
      }
      const msgs = await Message.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      cb(msgs.reverse()); // return oldest first
    } catch (err) {
      cb([]);
    }
  });

  // Add after get_messages event:
  socket.on('search_messages', async ({ room, query, limit = 20 }, cb) => {
    try {
      const search = query ? { $regex: query, $options: 'i' } : undefined;
      const mongoQuery = {
        room,
        isPrivate: { $ne: true },
        ...(search && { message: search }),
      };
      const msgs = await Message.find(mongoQuery)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      cb(msgs.reverse());
    } catch (err) {
      cb([]);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user) {
      const { username, room } = user;
      chatNamespace.to(room).emit('user_left', { username, id: socket.id });
      delete users[socket.id];
      // Update user list in the room
      chatNamespace.to(room).emit('user_list', Object.values(users).filter(u => u.room === room));
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