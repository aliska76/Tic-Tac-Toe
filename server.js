require('dotenv').config();

const WebSocket = require('ws');
const Redis = require('ioredis');
const TicTacToe = require('./game');

const PORT = Number(process.env.PORT) || 3001;
const SERVER_ID = process.env.SERVER_ID || 'S1';

// Redis connections
const redisSub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
const redisPub = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const PUB_CHANNEL = 'tictactoe:events';
const VER_KEY = 'tictactoe:version';
const STATE_KEY = 'tictactoe:state';

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`[${SERVER_ID}] WebSocket server up on :${PORT}`);
});

// Initialize game
const game = new TicTacToe();

const clients = new Map(); // ws -> { symbol: 'X'|'O' }

async function publishState(origin, reason) {
  try {
    // Update game version before publishing
    game.version = await redisPub.incr(VER_KEY);
    
    await redisPub.set(STATE_KEY, JSON.stringify(game.getState()));
    const payload = {
      kind: 'state',
      state: game.getState(),
      origin,
      reason,
      timestamp: Date.now()
    };
    await redisPub.publish(PUB_CHANNEL, JSON.stringify(payload));
    console.log(`[${SERVER_ID}] Published state v${game.version} (${reason})`);
  } catch (error) {
    console.error('Error publishing state:', error);
  }
}

function broadcastUpdate() {
  const msg = JSON.stringify({
    type: 'update',
    board: game.board,
    nextTurn: game.currentPlayer,
    winner: game.winner || undefined,
    draw: game.draw || undefined
  });
  
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

function sendStatus(ws, message) {
  ws.send(JSON.stringify({ type: 'status', message }));
}

function sendSymbol(ws, symbol) {
  ws.send(JSON.stringify({ type: 'symbol', symbol }));
}

function welcome(ws) {
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: `Connected to ${SERVER_ID}:${PORT}`,
    serverId: SERVER_ID
  }));
}

// ADD THE MISSING handleJoin FUNCTION
async function handleJoin(ws, requestedSymbol) {
  // Check if game is already full
  if (game.isGameFull()) {
    ws.send(JSON.stringify({ 
      type: 'error', 
      message: 'Game is full. Both players already connected.' 
    }));
    return;
  }

  let symbol = requestedSymbol;
  
  // Validate symbol
  if (symbol && !['X', 'O'].includes(symbol)) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid symbol. Please choose X or O.'
    }));
    return;
  }

  // If no symbol requested and both slots are empty, ask to choose
  if (!symbol && game.players.X === null && game.players.O === null) {
    ws.send(JSON.stringify({ type: 'choose_symbol' }));
    return;
  }

  // If no symbol requested, assign the available one
  if (!symbol) {
    symbol = game.players.X === null ? 'X' : 'O';
  }

  // Check if requested symbol is already taken
  if (game.players[symbol] !== null) {
    const availableSymbol = game.players.X === null ? 'X' : 'O';
    ws.send(JSON.stringify({
      type: 'symbol_taken',
      available: availableSymbol,
      message: `Symbol ${symbol} is already taken. You will be assigned ${availableSymbol}.`
    }));
    symbol = availableSymbol;
  }

  // Assign the symbol
  clients.set(ws, { symbol });
  game.addPlayer(symbol, SERVER_ID);

  await publishState(SERVER_ID, 'join');
  sendSymbol(ws, symbol);

  // Check if both players are now connected
  if (game.isGameFull()) {
    // Notify ALL clients that both players are connected
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        sendStatus(client, 'Both players connected! Game starts with X.');
      }
    }
    broadcastUpdate();
  } else {
    const waitingMessage = symbol === 'X' ? 
      'Waiting for O to connect...' : 'Waiting for X to connect...';
    sendStatus(ws, waitingMessage);
  }
}

// REMOVE THE DUPLICATE handleMove FUNCTION - KEEP ONLY THIS ONE
async function handleMove(ws, row, col, playerSymbol) {
  // Basic validation
  if (game.winner || game.draw) {
    ws.send(JSON.stringify({ type: 'error', message: 'Game already finished.' }));
    return;
  }
  
  const clientData = clients.get(ws);
  if (!clientData || clientData.symbol !== playerSymbol) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid player.' }));
    return;
  }
  
  if (playerSymbol !== game.currentPlayer) {
    ws.send(JSON.stringify({ type: 'error', message: 'Not your turn.' }));
    return;
  }
  
  if (row < 0 || row > 2 || col < 0 || col > 2) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid cell coordinates.' }));
    return;
  }
  
  if (game.board[row][col]) {
    ws.send(JSON.stringify({ type: 'error', message: 'Cell already occupied.' }));
    return;
  }

  // Apply move using game class
  if (!game.makeMove(row, col, playerSymbol)) {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid move.' }));
    return;
  }

  await publishState(SERVER_ID, 'move');
  broadcastUpdate();

  // Send game end messages
  if (game.winner) {
    const winMsg = JSON.stringify({ type: 'win', winner: game.winner });
    for (const c of wss.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(winMsg);
    }
  } else if (game.draw) {
    const drawMsg = JSON.stringify({ type: 'draw' });
    for (const c of wss.clients) {
      if (c.readyState === WebSocket.OPEN) c.send(drawMsg);
    }
  }
}

// Handle Redis messages for server synchronization
redisSub.subscribe(PUB_CHANNEL);
redisSub.on('message', async (_channel, raw) => {
  try {
    const msg = JSON.parse(raw);
    if (msg.kind !== 'state') return;

    console.log(`[${SERVER_ID}] Received state v${msg.state.version} from ${msg.origin} (reason: ${msg.reason})`);

    // Only apply if the incoming state is newer
    if (msg.state.version > game.version) {
      const wasGameFullBefore = game.isGameFull();
      game.setState(msg.state);
      console.log(`[${SERVER_ID}] Updated to state v${game.version}`);
      
      // If the game just became ready, notify all clients
      if (!wasGameFullBefore && game.isGameFull()) {
        console.log(`[${SERVER_ID}] Game just became ready via Redis sync`);
        
        for (const client of wss.clients) {
          if (client.readyState === WebSocket.OPEN) {
            sendStatus(client, 'Both players connected! Game starts with X.');
          }
        }
      }
      
      // Send update to ALL clients
      broadcastUpdate();

      // Notify about game end if applicable
      if (game.winner) {
        const winMsg = JSON.stringify({ type: 'win', winner: game.winner });
        for (const c of wss.clients) {
          if (c.readyState === WebSocket.OPEN) c.send(winMsg);
        }
      } else if (game.draw) {
        const drawMsg = JSON.stringify({ type: 'draw' });
        for (const c of wss.clients) {
          if (c.readyState === WebSocket.OPEN) c.send(drawMsg);
        }
      }
    }
  } catch (e) {
    console.error('Error processing federation message:', e);
  }
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log(`[${SERVER_ID}] New client connected`);
  clients.set(ws, null);
  welcome(ws);

  // Send current game state to the new client
  ws.send(JSON.stringify({
    type: 'update',
    board: game.board,
    nextTurn: game.currentPlayer,
    winner: game.winner || undefined,
    draw: game.draw || undefined
  }));

  // Handle automatic joining based on game state
  if (game.players.X === null && game.players.O === null) {
    // No players yet, ask first player to choose
    ws.send(JSON.stringify({ type: 'choose_symbol' }));
    sendStatus(ws, 'You are the first player. Please choose X or O.');
  } else if (game.isGameFull()) {
    // Game is already full, can only spectate
    sendStatus(ws, 'Game is full. You can watch the game.');
  } else {
    // One player already connected, automatically join as the second player
    const availableSymbol = game.players.X === null ? 'X' : 'O';
    console.log(`[${SERVER_ID}] Auto-joining client as ${availableSymbol}`);
    handleJoin(ws, availableSymbol);
  }

  ws.on('message', async (buf) => {
    let data;
    try {
      data = JSON.parse(buf.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON format' }));
      return;
    }

    try {
      if (data.type === 'join') {
        await handleJoin(ws, data.playerId);
      } else if (data.type === 'move') {
        await handleMove(ws, data.row, data.col, data.player);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
    }
  });

  ws.on('close', async () => {
    console.log(`[${SERVER_ID}] Client disconnected`);
    const clientData = clients.get(ws);
    clients.delete(ws);
    
    if (clientData && clientData.symbol) {
      // Free up the player slot
      game.removePlayer(clientData.symbol);
      
      // Reset game if both players were connected
      if (game.isGameFull()) {
        // Only reset if game wasn't finished
        if (!game.winner && !game.draw) {
          game.reset();
        }
      }
      
      await publishState(SERVER_ID, 'disconnect');
      
      // Notify remaining clients
      for (const c of wss.clients) {
        if (c.readyState === WebSocket.OPEN) {
          sendStatus(c, `Player ${clientData.symbol} disconnected.`);
        }
      }
    }
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log(`\n[${SERVER_ID}] Shutting down gracefully...`);
  redisSub.disconnect();
  redisPub.disconnect();
  wss.close();
  process.exit(0);
});