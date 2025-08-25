# Real-Time Tic-Tac-Toe Over Two Servers (Redis Version)

## 🎯 Overview
This is a real-time, multiplayer Tic-Tac-Toe game that allows two players to compete against each other from separate clients, connected over WebSocket. The game uses Redis for state synchronization between two independent backend servers.

## 🏗️Architecture

- **Backend:** Two Node.js WebSocket servers (server.js on ports 3001 and 3002).
    - Each server accepts client connections independently.
    - Servers synchronize game state using Redis pub/sub.
    - Game logic is centralized in `game.js` class.

- **Client:** CLI-based Node.js script (`client.js`)
    - Connects to either backend server via WebSocket.
    - Displays board, accepts moves, shows real-time updates.

- **Synchronization:** Redis is used as a shared memory layer for:
    - Game state persistence.
    - Atomic version control.
    - Real-time pub/sub messaging between servers.

## 🛠️Technical Implementation
### Server-Server Communication (Redis Pub/Sub)
    - Channel: tictactoe:events
    - Message Format: JSON with state snapshots and versioning
    - Synchronization: Atomic version counter ensures consistency

### Client-Server Communication (WebSocket)
    - Message Types: join, move, update, win, draw, status, error
    - Protocol: JSON-based messaging.

## 📦Dependencies
    - ws: WebSocket implementation.
    - ioredis: Redis client.
    - dotenv: Environment variable management.
    - cross-env: Cross-platform environment variable support.

## 🚀How to Run

1. **Prerequisites:**
    - Install Redis on your system
    - Start Redis server (default: redis://127.0.0.1:6379)

2. **Install dependencies:**
    ```bash
    npm install
    ```

3. **Start both servers in separate terminals:**
    ```bash
    npm run serverA
    npm run serverB
    ```

4. **Run two clients in separate terminals:**
    ```bash
    node client.js ws://localhost:3001
    node client.js ws://localhost:3002
    ```

## 🎮Play a Game
1. First Player: Connects and chooses X or O symbol
2. Second Player: Automatically connects and is assigned the remaining symbol
3. Game Start: Both players receive the board and game begins.
4. Taking Turns: Enter moves as row,col (e.g., 0,1 for top middle)
5. Game End: Win or draw is automatically detected and announced

## Notes

- You can run multiple games by restarting the servers.

## 🐛Troubleshooting
    - Redis Connection Issues: Ensure Redis is running on localhost:6379
    - Port Conflicts: Check if ports 3001/3002 are available
    - Game Not Starting: Ensure both clients are connected to different servers
    - State Sync Issues: Restart both servers to reset game state

## 📝Future Enhancements
    - Multiple concurrent games
    - Player authentication and matchmaking
    - Game history and statistics
    - Web-based UI alongside CLI
    - Docker containerization