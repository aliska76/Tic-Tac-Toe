# Real-Time Tic-Tac-Toe Over Two Servers (WebSocket Federation Version)

## Architecture

- **Backend:** Two Node.js WebSocket servers (`server.js` on port 3001 + federation port 4001, `serverB.js` on port 3002 + federation port 4002).
    - Each server accepts client connections.
    - Servers federate game state via a direct WebSocket connection: moves are sent to the peer server immediately.
    - Game logic is shared via `game.js`.

- **Client:** CLI-based Node.js script (`client.js`)
    - Connects to either backend server via WebSocket.
    - Displays board, accepts moves, shows real-time updates.

## How Federation Works

- Each server listens for federation messages on its federation port (`4001` or `4002`).
- Each server also connects to its peer’s federation port as a client.
- When a move is made, it is sent to the peer server via WebSocket federation.
- Both servers keep their game state in sync.

## How to Run

1. **Install dependencies:**
    ```bash
    npm install
    ```

2. **Start both servers in separate terminals:**
    ```bash
    npm run serverA
    npm run serverB
    ```

3. **Run two clients in separate terminals:**
    ```bash
    node client.js ws://localhost:3001
    node client.js ws://localhost:3002
    ```

## Play a Game

- Each client chooses a player ("X" or "O") when starting.
- Enter moves as `row,col` (e.g., `1,2`).
- Moves instantly reflect on both clients, even if connected to different servers.
- Invalid moves are rejected.
- Game ends with win or draw notification.

## Notes

- You can run multiple games by restarting the servers.