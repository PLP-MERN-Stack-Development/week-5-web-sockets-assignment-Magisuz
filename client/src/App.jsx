import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './socket/socket';
import notificationSound from './notification.mp3';
import './App.css';

function App() {
  const {
    isConnected,
    connect,
    disconnect,
    messages: messagesFromSocket,
    sendMessage,
    users,
    typingUsers,
    setTyping,
    sendPrivateMessage,
    markMessageRead,
    myId,
    sendReaction,
    getMessages,
    reconnecting,
    searchMessages,
  } = useSocket();

  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [room, setRoom] = useState('General');
  const [availableRooms, setAvailableRooms] = useState(['General']);
  const [file, setFile] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({}); // { 'General': 0, 'userId123': 2 }
  const audioRef = useRef(null);
  const [windowFocused, setWindowFocused] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Request notification permission on mount
  useEffect(() => {
    if (window.Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }, []);

  // Handle username and room submit
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (inputUsername.trim() && room.trim()) {
      setUsername(inputUsername.trim());
      connect(inputUsername.trim(), room.trim());
      if (!availableRooms.includes(room.trim())) {
        setAvailableRooms([...availableRooms, room.trim()]);
      }
    }
  };

  // Handle message send
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim()) {
      const id = sendMessage(message.trim(), room, {}, (ack) => {
        if (ack && ack.delivered) {
          setMessages((prev) => prev.map(m => m.id === ack.id ? { ...m, pending: false } : m));
        }
      });
      setMessages((prev) => [
        ...prev,
        {
          id,
          sender: username,
          senderId: myId,
          message: message.trim(),
          room,
          timestamp: new Date().toISOString(),
          pending: true,
        },
      ]);
      setMessage('');
      setIsTyping(false);
      setTyping(false);
    }
  };

  // Handle private message send
  const handleSendPrivateMessage = (e) => {
    e.preventDefault();
    if (message.trim() && recipient) {
      const id = sendPrivateMessage(recipient, message.trim(), (ack) => {
        if (ack && ack.delivered) {
          setMessages((prev) => prev.map(m => m.id === ack.id ? { ...m, pending: false } : m));
        }
      });
      setMessages((prev) => [
        ...prev,
        {
          id,
          sender: username,
          senderId: myId,
          message: message.trim(),
          recipientId: recipient,
          isPrivate: true,
          timestamp: new Date().toISOString(),
          pending: true,
        },
      ]);
      setMessage('');
      setIsTyping(false);
      setTyping(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Handle file send
  const handleSendFile = async (e) => {
    e.preventDefault();
    if (file && isConnected) {
      const reader = new FileReader();
      reader.onload = () => {
        const fileData = reader.result;
        sendMessage(
          '',
          room,
          {
            file: {
              name: file.name,
              type: file.type,
              data: fileData,
            },
          }
        );
        setFile(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Typing indicator logic
  useEffect(() => {
    if (!username) return;
    if (isTyping) {
      setTyping(true);
    } else {
      setTyping(false);
    }
    // Clean up typing status on unmount
    return () => setTyping(false);
    // eslint-disable-next-line
  }, [isTyping, username]);

  useEffect(() => {
    const onFocus = () => setWindowFocused(true);
    const onBlur = () => setWindowFocused(false);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    // Only add incoming messages that are not already in the list (by id)
    if (messagesFromSocket.length > 0) {
      setMessages((prev) => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = messagesFromSocket.filter(m => !existingIds.has(m.id));
        return [...prev, ...newMsgs];
      });
    }
    // eslint-disable-next-line
  }, [messagesFromSocket]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;

    // Only play sound for real messages (not system), not sent by me
    if (
      !lastMessage.system &&
      lastMessage.senderId !== myId &&
      audioRef.current
    ) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }

    // Browser notification for new messages (not system, not from me, only if window not focused)
    if (
      !lastMessage.system &&
      lastMessage.senderId !== myId &&
      !windowFocused &&
      window.Notification &&
      Notification.permission === 'granted'
    ) {
      const sender = lastMessage.sender || 'Anonymous';
      const body = lastMessage.message || (lastMessage.file ? `Sent a file: ${lastMessage.file.name}` : '');
      new Notification(`New message from ${sender}`, {
        body,
        icon: '/favicon.ico', // Optional: add your favicon or logo here
      });
    }

    // Determine the key: room or recipient
    let key = '';
    if (lastMessage.isPrivate) {
      key = lastMessage.senderId === myId ? lastMessage.recipientId : lastMessage.senderId;
    } else {
      key = lastMessage.room || 'General';
    }

    // Only increment if not focused or not in the active chat
    const isActive =
      (!lastMessage.isPrivate && room === key && !recipient) ||
      (lastMessage.isPrivate && ((recipient && recipient === key) || (lastMessage.senderId === myId && recipient === lastMessage.recipientId)));

    if (!windowFocused || !isActive) {
      setUnreadCounts((prev) => ({
        ...prev,
        [key]: (prev[key] || 0) + 1,
      }));
    }
    // eslint-disable-next-line
  }, [messages, myId, windowFocused]);

  useEffect(() => {
    // For room
    if (room && !recipient) {
      setUnreadCounts((prev) => ({
        ...prev,
        [room]: 0,
      }));
    }
    // For private chat
    if (recipient) {
      setUnreadCounts((prev) => ({
        ...prev,
        [recipient]: 0,
      }));
    }
  }, [room, recipient]);

  const loadOlderMessages = async () => {
    setLoadingOlder(true);
    // Find the oldest message in the current room
    const filtered = messages.filter(m => !m.isPrivate && (m.room === room || (!m.room && room === 'General')));
    const oldest = filtered[0];
    const before = oldest ? oldest.timestamp : undefined;
    const older = await getMessages(room, before, 20);
    if (older.length > 0) {
      // Prepend to messages
      setMessages(prev => [...older, ...prev]);
    }
    setLoadingOlder(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    const results = await searchMessages(room, searchQuery.trim(), 50);
    setSearchResults(results);
    setSearching(false);
  };
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  if (!username) {
    return (
      <div style={{ padding: 32 }}>
        <h2>Enter your username and select a room</h2>
        <form onSubmit={handleJoinRoom}>
          <input
            type="text"
            value={inputUsername}
            onChange={e => setInputUsername(e.target.value)}
            placeholder="Username"
            required
            autoFocus
          />
          <select
            value={room}
            onChange={e => setRoom(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {availableRooms.map(r => (
              <option key={r} value={r}>
                {r}{unreadCounts[r] > 0 ? ` (${unreadCounts[r]} new)` : ''}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Or create new room"
            value={room}
            onChange={e => setRoom(e.target.value)}
            style={{ marginLeft: 8 }}
          />
          <button type="submit">Join</button>
        </form>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {reconnecting && (
        <div style={{ background: '#ffecb3', color: '#b26a00', padding: 8, textAlign: 'center', marginBottom: 8, borderRadius: 4 }}>
          Reconnecting to server...
        </div>
      )}
      <audio ref={audioRef} src={notificationSound} preload="auto" />
      <h2>Socket.io Chat - Room: {room}</h2>
      <div>Status: <b style={{ color: isConnected ? 'green' : 'red' }}>{isConnected ? 'Connected' : 'Disconnected'}</b></div>
      <div style={{ margin: '16px 0' }}>
        <b>Online users:</b> {users.map(u => u.username).join(', ')}
      </div>
      <div style={{ margin: '8px 0' }}>
        <label>
          <b>Send to:</b>
          <select
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">Everyone (Global Chat)</option>
            {users
              .filter(u => u.username !== username)
              .map(u => (
                <option key={u.id} value={u.id}>
                  {u.username}{unreadCounts[u.id] > 0 ? ` (${unreadCounts[u.id]} new)` : ''}
                </option>
              ))}
          </select>
        </label>
      </div>
      <button onClick={loadOlderMessages} disabled={loadingOlder} style={{ marginBottom: 8 }}>
        {loadingOlder ? 'Loading...' : 'Load older messages'}
      </button>
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search messages..."
          style={{ flex: 1 }}
          disabled={searching}
        />
        <button type="submit" disabled={searching || !searchQuery.trim()}>Search</button>
        {searchResults.length > 0 && (
          <button type="button" onClick={handleClearSearch}>Clear</button>
        )}
      </form>
      {searchResults.length > 0 && (
        <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginBottom: 8 }}>
          <b>Search Results ({searchResults.length}):</b>
          {searchResults.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: 4 }}>
              <b>{msg.sender || 'Anonymous'}</b> [{new Date(msg.timestamp).toLocaleTimeString()}]:{' '}
              <span dangerouslySetInnerHTML={{ __html: msg.message.replace(new RegExp(searchQuery, 'gi'), (match) => `<mark>${match}</mark>`) }} />
            </div>
          ))}
          {searchResults.length === 0 && <div>No results found.</div>}
        </div>
      )}
      <div style={{ minHeight: 200, border: '1px solid #eee', padding: 8, marginBottom: 16, background: '#fafafa' }}>
        {searchResults.length === 0 && (
          <>
            {messages
              .filter(msg => !msg.room || msg.room === room)
              .map((msg, idx) => {
                // Mark as read if not sent by me and not already read by me
                useEffect(() => {
                  if (msg.senderId !== myId && (!msg.readBy || !msg.readBy.includes(myId))) {
                    markMessageRead(msg.id);
                  }
                }, [msg, myId]);
                return (
                  <div key={idx} style={{ marginBottom: 4 }}>
                    {msg.system ? (
                      <i style={{ color: '#888' }}>{msg.message}</i>
                    ) : msg.isPrivate ? (
                      <span style={{ color: '#b100b1' }}>
                        <b>{msg.sender || 'Anonymous'} (private)</b> [{new Date(msg.timestamp).toLocaleTimeString()}]: {msg.message}
                        {msg.file && (
                          <div>
                            {msg.file.type.startsWith('image/') ? (
                              <img src={msg.file.data} alt={msg.file.name} style={{ maxWidth: 200, display: 'block', marginTop: 4 }} />
                            ) : (
                              <a href={msg.file.data} download={msg.file.name} style={{ marginTop: 4, display: 'inline-block' }}>
                                Download {msg.file.name}
                              </a>
                            )}
                          </div>
                        )}
                      </span>
                    ) : (
                      <span>
                        <b>{msg.sender || 'Anonymous'}</b> [{new Date(msg.timestamp).toLocaleTimeString()}]: {msg.message}
                        {msg.file && (
                          <div>
                            {msg.file.type.startsWith('image/') ? (
                              <img src={msg.file.data} alt={msg.file.name} style={{ maxWidth: 200, display: 'block', marginTop: 4 }} />
                            ) : (
                              <a href={msg.file.data} download={msg.file.name} style={{ marginTop: 4, display: 'inline-block' }}>
                                Download {msg.file.name}
                              </a>
                            )}
                          </div>
                        )}
                      </span>
                    )}
                    <div style={{ display: 'inline-block', marginLeft: 8 }}>
                      {["👍", "❤️", "😂"].map((emoji) => (
                        <button
                          key={emoji}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18, marginRight: 2 }}
                          onClick={() => sendReaction(msg.id, emoji)}
                          title={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                      {msg.reactions && Object.entries(msg.reactions).map(([emoji, users]) => (
                        <span key={emoji} style={{ marginLeft: 4 }}>
                          {emoji} {users.length}
                        </span>
                      ))}
                    </div>
                    {msg.readBy && msg.readBy.length >= users.length - 1 && msg.senderId === myId && (
                      <span style={{ color: 'green', marginLeft: 8 }} title="Read by all">✔✔</span>
                    )}
                    {msg.senderId === myId && !msg.system && (
                      <span style={{ color: msg.pending ? '#aaa' : 'green', marginLeft: 4 }} title={msg.pending ? 'Sending...' : 'Delivered'}>
                        ✔
                      </span>
                    )}
                  </div>
                );
              })}
            {typingUsers.length > 0 && (
              <div style={{ color: '#888', fontStyle: 'italic' }}>
                {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
              </div>
            )}
          </>
        )}
      </div>
      <form
        onSubmit={recipient ? handleSendPrivateMessage : handleSendMessage}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          type="text"
          value={message}
          onChange={e => {
            setMessage(e.target.value);
            setIsTyping(e.target.value.length > 0);
          }}
          placeholder={recipient ? `Private message to ${users.find(u => u.id === recipient)?.username || ''}` : "Type a message..."}
          style={{ flex: 1 }}
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !message.trim()}>{recipient ? 'Send Private' : 'Send'}</button>
      </form>
      <form onSubmit={handleSendFile} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input type="file" onChange={handleFileChange} disabled={!isConnected} />
        <button type="submit" disabled={!file || !isConnected}>Send File</button>
      </form>
      <button onClick={disconnect} style={{ marginTop: 16 }}>Disconnect</button>
    </div>
  );
}

export default App; 