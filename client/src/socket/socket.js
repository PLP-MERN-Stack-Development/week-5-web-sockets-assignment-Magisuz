// socket.js - Socket.io client setup

import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

// Create socket instance
export const socket = io(`${SOCKET_URL}/chat`, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Custom hook for using socket.io
export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [lastJoin, setLastJoin] = useState({ username: '', room: '' });

  // Connect to socket server
  const connect = (username, room) => {
    setLastJoin({ username, room });
    socket.connect();
    if (username && room) {
      socket.emit('user_join', { username, room });
    }
  };

  // Disconnect from socket server
  const disconnect = () => {
    socket.disconnect();
  };

  // Update sendMessage and sendPrivateMessage:
  const sendMessage = (message, room, options = {}, onAck) => {
    const id = Date.now();
    socket.emit('send_message', { message, room, ...options, id }, (ack) => {
      if (onAck) onAck(ack);
    });
    return id;
  };

  const sendPrivateMessage = (to, message, onAck) => {
    const id = Date.now();
    socket.emit('private_message', { to, message, id }, (ack) => {
      if (onAck) onAck(ack);
    });
    return id;
  };

  // Set typing status
  const setTyping = (isTyping) => {
    socket.emit('typing', isTyping);
  };

  // Mark message as read
  const markMessageRead = (messageId) => {
    socket.emit('message_read', { messageId });
  };

  // Send a reaction
  const sendReaction = (messageId, reaction) => {
    socket.emit('message_reaction', { messageId, reaction });
  };

  const getMessages = (room, before, limit = 20) =>
    new Promise((resolve) => {
      socket.emit('get_messages', { room, before, limit }, (msgs) => {
        resolve(msgs);
      });
    });

  const searchMessages = (room, query, limit = 20) =>
    new Promise((resolve) => {
      socket.emit('search_messages', { room, query, limit }, (msgs) => {
        resolve(msgs);
      });
    });

  // Socket event listeners
  useEffect(() => {
    // Connection events
    const onConnect = () => {
      setIsConnected(true);
      setMyId(socket.id);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => [...prev, message]);
    };

    // Read receipt update
    const onMessageReadUpdate = ({ messageId, userId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                readBy: msg.readBy ? [...new Set([...msg.readBy, userId])] : [userId],
              }
            : msg
        )
      );
    };

    // Reaction update
    const onMessageReactionUpdate = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, reactions }
            : msg
        )
      );
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Typing events
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    const onReconnectAttempt = () => setReconnecting(true);
    const onReconnect = () => {
      setReconnecting(false);
      // Re-join room after reconnect
      if (lastJoin.username && lastJoin.room) {
        socket.emit('user_join', lastJoin);
      }
    };
    const onReconnectError = () => setReconnecting(false);

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('receive_message', onReceiveMessage);
    socket.on('private_message', onPrivateMessage);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);
    socket.on('message_read_update', onMessageReadUpdate);
    socket.on('message_reaction_update', onMessageReactionUpdate);
    socket.on('reconnect_attempt', onReconnectAttempt);
    socket.on('reconnect', onReconnect);
    socket.on('reconnect_error', onReconnectError);

    // Clean up event listeners
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('receive_message', onReceiveMessage);
      socket.off('private_message', onPrivateMessage);
      socket.off('user_list', onUserList);
      socket.off('user_joined', onUserJoined);
      socket.off('user_left', onUserLeft);
      socket.off('typing_users', onTypingUsers);
      socket.off('message_read_update', onMessageReadUpdate);
      socket.off('message_reaction_update', onMessageReactionUpdate);
      socket.off('reconnect_attempt', onReconnectAttempt);
      socket.off('reconnect', onReconnect);
      socket.off('reconnect_error', onReconnectError);
    };
  }, [lastJoin]);

  return {
    socket,
    isConnected,
    lastMessage,
    messages,
    users,
    typingUsers,
    connect,
    disconnect,
    sendMessage,
    sendPrivateMessage,
    setTyping,
    markMessageRead,
    myId,
    sendReaction,
    getMessages,
    reconnecting,
    lastJoin,
    searchMessages,
  };
};

export default socket; 