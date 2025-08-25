const WebSocket = require('ws');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const SERVER_URL = process.argv[2] || 'ws://localhost:3001';

let player = null;
let nextTurn = null;
let board = null;
let gameReady = false;
let waitingForMove = false;
let lastBoardState = null; // Track the last board state to avoid redrawing

function printBoard(b) {
  console.log('\n  0   1   2');
  for (let i = 0; i < 3; i++) {
    console.log(`${i} ${b[i].map(cell => cell || ' ').join(' | ')}`);
    if (i < 2) console.log('  ---------');
  }
  console.log('');
}

function promptForMove() {
  if (waitingForMove || !gameReady || nextTurn !== player) return;
  
  waitingForMove = true;
  rl.question('Your move (row,col, e.g., 0,1): ', input => {
    waitingForMove = false;
    const parts = input.split(',').map(s => s.trim());
    
    if (parts.length !== 2) {
      console.log('Error: Please enter exactly two numbers separated by comma');
      return;
    }
    
    const row = parseInt(parts[0]);
    const col = parseInt(parts[1]);
    
    if (isNaN(row) || isNaN(col) || row < 0 || row > 2 || col < 0 || col > 2) {
      console.log('Error: Please enter valid row and column numbers (0-2)');
      return;
    }
    
    ws.send(JSON.stringify({ 
      type: 'move', 
      row, 
      col, 
      player 
    }));
  });
}

function boardsAreEqual(board1, board2) {
  if (!board1 || !board2) return false;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board1[i][j] !== board2[i][j]) return false;
    }
  }
  return true;
}

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
  console.log('Connected to server. Waiting for game state...');
});

ws.on('message', msg => {
  try {
    const data = JSON.parse(msg);
    
    switch (data.type) {
      case 'welcome':
        console.log(data.message);
        break;
        
      case 'choose_symbol':
        console.log('You are the first player!');
        rl.question('Choose your symbol (X/O): ', answer => {
          const symbol = answer.toUpperCase();
          if (symbol === 'X' || symbol === 'O') {
            ws.send(JSON.stringify({ type: 'join', playerId: symbol }));
          } else {
            console.log('Invalid symbol. Please choose X or O.');
          }
        });
        break;
        
      case 'symbol_taken':
        console.log(data.message);
        // Auto-join with the available symbol
        ws.send(JSON.stringify({ type: 'join', playerId: data.available }));
        break;
        
      case 'symbol':
        player = data.symbol;
        console.log(`You are player: ${player}`);
        break;
        
      case 'status':
        console.log('Status:', data.message);
        
        // Update game ready state only when it changes
        const wasGameReady = gameReady;
        gameReady = data.message.includes('Both players connected');
        
        if (gameReady && !wasGameReady) {
          console.log('Game is starting!');
          
          // Show board if we have it and it's the first time game is ready
          if (board && !boardsAreEqual(board, lastBoardState)) {
            console.log('\n=== GAME BOARD ===');
            printBoard(board);
            console.log(`Next turn: ${nextTurn}`);
            lastBoardState = JSON.parse(JSON.stringify(board)); // Deep copy
            promptForMove();
          }
        }
        break;
        
      case 'update':
        // Only process if the board actually changed
        if (!boardsAreEqual(data.board, board)) {
          board = data.board;
          nextTurn = data.nextTurn;
          
          // Only show board if game is ready and board has changed
          if (gameReady) {
            console.log('\n=== GAME BOARD ===');
            printBoard(board);
            console.log(`Next turn: ${nextTurn}`);
            lastBoardState = JSON.parse(JSON.stringify(board)); // Deep copy
            promptForMove();
          }
        }
        
        if (data.winner) {
          console.log(`Winner: ${data.winner}`);
        } else if (data.draw) {
          console.log('Game ended in a draw!');
        }
        break;
        
      case 'win':
        if (board) printBoard(board);
        console.log(`\n🎉 GAME OVER! Winner: ${data.winner}`);
        rl.close();
        break;
        
      case 'draw':
        if (board) printBoard(board);
        console.log('\n🤝 GAME OVER! It\'s a draw!');
        rl.close();
        break;
        
      case 'error':
        console.log('Error:', data.message);
        waitingForMove = false;
        
        // If it's still our turn after an error, prompt for move again
        if (gameReady && nextTurn === player) {
          setTimeout(promptForMove, 100);
        }
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  } catch (error) {
    console.log('Error parsing message:', error);
  }
});

ws.on('error', err => {
  console.log('Connection error:', err.message);
  rl.close();
  process.exit(1);
});

ws.on('close', () => {
  console.log('Connection closed');
  rl.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nGoodbye!');
  ws.close();
  rl.close();
  process.exit(0);
});