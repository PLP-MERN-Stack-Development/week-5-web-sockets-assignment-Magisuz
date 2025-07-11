# MERN Web Sockets Assignment

## Overview
This project demonstrates a simple MERN (MongoDB, Express, React, Node.js) stack application utilizing Web Sockets for real-time communication. The assignment showcases how to set up a basic client-server architecture where the server can send real-time notifications to the client using Web Sockets.

## Features
- Real-time messaging in chat rooms using Web Sockets (Socket.io)
- User authentication (username-based)
- Multiple chat rooms (users can join/create rooms)
- Private messaging between users
- Online/offline user status display
- Typing indicators (see when others are typing)
- File and image sharing in chat
- Message reactions (like 👍, ❤️, 😂, etc.)
- Read receipts for messages
- Real-time notifications (sound and browser notifications)
- Unread message count per room/user
- Message search functionality
- Message pagination (load older messages)
- Reconnection logic for network issues
- Responsive design for desktop and mobile

## Project Structure
```
week-5-web-sockets-assignment-Magisuz/
├── client/
│   └── src/
│       ├── App.css
│       ├── App.jsx
│       ├── main.jsx
│       ├── notification.mp3
│       └── socket/
│           └── socket.js
├── server/
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── server.js
├── README.md
├── Week5-Assignment.md
└── PROJECT_README.md
```

## Installation & Setup

### Prerequisites
- Node.js (v14 or above)
- pnpm package manager

### Backend Setup
1. Navigate to the server directory:
   ```sh
   cd server
   ```
2. Install dependencies:
   ```sh
   pnpm install
   ```
3. Start the backend server:
   ```sh
   pnpm start
   ```

### Frontend Setup
1. Navigate to the client directory:
   ```sh
   cd client
   ```
2. Install dependencies:
   ```sh
   pnpm install
   ```
3. Start the frontend React app:
   ```sh
   pnpm start
   ```

## Usage
- Start both the backend and frontend as described above.
- Open your browser and navigate to the frontend (usually http://localhost:3000).
- The client will connect to the server via Web Sockets and receive real-time notifications.

## Technologies Used
- **Frontend:** React
- **Backend:** Node.js, Express
- **Web Sockets:** (e.g., socket.io or ws, depending on implementation)
- **Package Manager:** pnpm

## License
This project is for educational purposes as part of a MERN stack assignment. 