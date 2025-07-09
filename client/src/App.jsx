import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from './socket/socket';
import notificationSound from './notification.mp3';

function App() {
  const {
    isConnected,
    connect,
    disconnect,
    messages,
    sendMessage,
    users,
    typingUsers,
    setTyping,
    sendPrivateMessage,
    markMessageRead,
    myId,
    sendReaction,
  } = useSocket();

  const [username, setUsername] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [room, setRoom] = useState('General');
  const [availableRooms, setAvailableRooms] = useState(['General']);
  const [file, setFile] = useState(null);
  const [unread, setUnread] = useState(0);
  const audioRef = useRef(null);
  const [windowFocused, setWindowFocused] = useState(true);

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
      sendMessage(message.trim(), room);
      setMessage('');
      setIsTyping(false);
      setTyping(false);
    }
  };

  // Handle private message send
  const handleSendPrivateMessage = (e) => {
    e.preventDefault();
    if (message.trim() && recipient) {
      sendPrivateMessage(recipient, message.trim());
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
    if (!windowFocused) {
      setUnread((u) => u + 1);
    } else {
      setUnread(0);
    }
    // Play sound for new messages not from me
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.senderId !== myId && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
    // eslint-disable-next-line
  }, [messages, myId]);

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
              <option key={r} value={r}>{r}</option>
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
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
      <audio ref={audioRef} src={notificationSound} preload="auto" />
      <h2>Socket.io Chat - Room: {room} {unread > 0 && <span style={{ color: 'red' }}>({unread} new)</span>}</h2>
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
                <option key={u.id} value={u.id}>{u.username}</option>
              ))}
          </select>
        </label>
      </div>
      <div style={{ minHeight: 200, border: '1px solid #eee', padding: 8, marginBottom: 16, background: '#fafafa' }}>
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
              </div>
            );
          })}
        {typingUsers.length > 0 && (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
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