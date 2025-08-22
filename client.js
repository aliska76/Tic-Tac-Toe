const WebSocket = require('ws');
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const SERVER_URL = process.argv[2] || 'ws://localhost:3001'; // Or ws://localhost:3002

let player = null;
let nextTurn = null;
let board = null;
let gameReady = false;

function printBoard(b) {
    //console.clear();
    console.log('\n  0   1   2');
    b.forEach((row, i) => {
        console.log(i + ' ' + row.map(cell => cell || ' ').join(' | '));
        if (i < 2) console.log('  ---------');
    });
}

const ws = new WebSocket(SERVER_URL);

ws.on('open', () => {
    // Wait for server instructions
});

ws.on('message', msg => {
    const data = JSON.parse(msg);
    
    if (data.type === 'welcome') {
        console.log(data.message);
    }

    if (data.type === 'choose_symbol') {
        // Only the FIRST client will get this message from the server
        rl.question('Choose your player (X/O): ', answer => {
            ws.send(JSON.stringify({ type: 'join', playerId: answer.toUpperCase() }));
        });
    }

    if (data.type === 'symbol') {
        player = data.symbol;
        console.log(`You are "${player}".`);
    }

    if (data.type === 'status') {
        console.log(data.type, data.message);
        
        if (data.message.includes('Opponent connected') || data.message.includes('Your turn!')) {
            gameReady = true;
        }

        if (data.message.includes('Wait for opponent') || data.message.includes("Wait for the first player's move.") || data.message.includes('Opponent disconnected')) {
            gameReady = false;
        }
    }
    
    if (data.type === 'update') {
        board = data.board;
        nextTurn = data.nextTurn;

        if (gameReady && nextTurn === player && !data.winner) {
            printBoard(board);
            rl.question('Your move (row,col): ', input => {
                const [row, col] = input.split(',').map(Number);
                ws.send(JSON.stringify({ type: 'move', row, col, player }));
            });
        }
    } else if (data.type === 'win') {
        console.log(`Game over! Winner: ${data.winner}`);
        process.exit();
    } else if (data.type === 'draw') {
        console.log('Game over! Draw.');
        process.exit();
    } else if (data.type === 'error') {
        console.log('Error:', data.message);
    }
});

// Handle connection errors (e.g. ECONNREFUSED)
ws.on('error', err => {
    console.log('Could not connect to the server or lost connection. Please check if the server is running.');
    process.exit(1);
});

// Handle server-side disconnects gracefully
ws.on('close', () => {
    console.log('Connection to server was closed. The game has ended or the server shut down.');
    process.exit(1);
});