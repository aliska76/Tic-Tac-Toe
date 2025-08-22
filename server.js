const WebSocket = require('ws');
const TicTacToe = require('./game');

// Parse ports from CLI args
const CLIENT_PORT = parseInt(process.argv[2], 10) || 3001;
const FEDERATION_PORT = parseInt(process.argv[3], 10) || 4001;
const PEER_FEDERATION_PORT = parseInt(process.argv[4], 10) || (FEDERATION_PORT === 4001 ? 4002 : 4001);
const PEER_FEDERATION_URL = `ws://localhost:${PEER_FEDERATION_PORT}`;

let clients = [];
let game = new TicTacToe();
let firstSymbol = null;

const welcomeMsg = "Welcome to the Tic-Tac-Toe game!";

// --- Federation WebSocket Server ---
const federationWSS = new WebSocket.Server({ port: FEDERATION_PORT });
federationWSS.on('connection', ws => {
    ws.on('message', msg => {
        const data = JSON.parse(msg);

        if (data.type === 'federation_move') {
            if (game.makeMove(data.row, data.col, data.player)) {
                broadcastUpdate();
            }
        }
        if (data.type === 'federation_symbol') {
            firstSymbol = data.symbol;
            assignSymbolsToClients();
        }
    });
});

// --- Federation client ---
let federationClient;
function connectToPeer() {
    federationClient = new WebSocket(PEER_FEDERATION_URL);
    federationClient.on('open', () => console.log('Federation connected to peer.'));
    federationClient.on('close', () => setTimeout(connectToPeer, 1000));
    federationClient.on('error', () => {});
}
connectToPeer();

// --- Client WebSocket Server ---
const wss = new WebSocket.Server({ port: CLIENT_PORT });

wss.on('connection', ws => {
    clients.push({ ws, player: null });

    if (clients.length > 0) console.log(`Client connected. Total clients: ${clients.length}`);

    try {
        // Always notify the new client
        if (clients.length === 1) {
            ws.send(JSON.stringify({
                type: 'welcome',
                message: welcomeMsg + ' You are the first player.'
            }));
            ws.send(JSON.stringify({
                type: 'status',
                message: 'Wait for opponent.'
            }));
            ws.send(JSON.stringify({ type: 'choose_symbol' }));
        } else if (clients.length === 2) {
            ws.send(JSON.stringify({
                type: 'welcome',
                message: welcomeMsg + ' Wait for the first player move.'
            }));
            // Only assign symbols if not assigned already
            assignSymbolsToClients();
            // Notify both clients about readiness
            clients[0].ws.send(JSON.stringify({
                type: 'status',
                message: 'Opponent connected. You can start to move!'
            }));
            clients[1].ws.send(JSON.stringify({ type: 'status', message: 'Wait for the first player\'s move.' }));
            broadcastUpdate();

            // After update, tell the current player (usually X) it's their turn
            const firstTurnPlayer = clients.find(c => c.player === game.currentPlayer);
            if (firstTurnPlayer) {
                firstTurnPlayer.ws.send(JSON.stringify({ type: 'status', message: 'Your turn!' }));
            }
        } else {
            ws.send(JSON.stringify({
                type: 'welcome',
                message: 'Game is full. Please try again later.'
            }));
            ws.close();
            return;
        }
    } catch (e) {
        console.log(e);
    }

    ws.on('message', msg => {
        try {
            const data = JSON.parse(msg);


            if (data.type === 'join') {
                let assigned = null;
                if (!firstSymbol && !data.playerId) {
                    // If firstSymbol not set, prompt first client to choose
                    ws.send(JSON.stringify({ type: 'choose_symbol' }));
                    return;
                }
                if (!firstSymbol) {
                    assigned = assignPlayer(ws, data.playerId);
                    if (!assigned) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Symbol already taken or game full.' }));
                        return;
                    }
                    ws.send(JSON.stringify({ type: 'symbol', symbol: assigned }));
                    firstSymbol = assigned;

                    // Set current player for the game!
                    game.currentPlayer = assigned;

                    // Notify peer server of the symbol chosen
                    if (federationClient && federationClient.readyState === WebSocket.OPEN) {
                        federationClient.send(JSON.stringify({ type: 'federation_symbol', symbol: assigned }));
                    }
                } else {
                    assigned = assignPlayer(ws, firstSymbol === "X" ? "O" : "X");
                    ws.send(JSON.stringify({ type: 'symbol', symbol: assigned }));
                }

                assignSymbolsToClients();
                // Only after symbols assigned, send update
                broadcastUpdate();

                // At this point, tell the current player to move
                const turnPlayer = clients.find(c => c.player === game.currentPlayer);
                if (turnPlayer) {
                    turnPlayer.ws.send(JSON.stringify({ type: 'status', message: 'Your turn!' }));
                }

                return;
            }

            if (data.type === 'move') {
                const client = clients.find(c => c.ws === ws);

                if (!client || !client.player) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Player not assigned.' }));
                    return;
                }

                // Validate and make move
                if (game.isValidMove(data.row, data.col, client.player)) {
                    game.makeMove(data.row, data.col, client.player);
                    broadcastUpdate();

                    // Notify next player it's their turn
                    const nextPlayerSymbol = game.currentPlayer;
                    const nextClient = clients.find(c => c.player === nextPlayerSymbol);
                    if (nextClient) {
                        nextClient.ws.send(JSON.stringify({ type: 'status', message: 'Your turn!' }));
                    }
                    // Optionally, notify the player who just moved that it's not their turn
                    ws.send(JSON.stringify({ type: 'status', message: 'Waiting for opponent to move...' }));

                    if (federationClient && federationClient.readyState === WebSocket.OPEN) {
                        federationClient.send(JSON.stringify({ type: 'federation_move', row: data.row, col: data.col, player: client.player }));
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid move.' }));
                }
            }
        } catch (e) {
            ws.send(JSON.stringify({ type: 'error', message: 'Game error.' }));
        }
    });

    ws.on('close', () => {
        // Remove the disconnected client
        clients = clients.filter(c => c.ws !== ws);
        console.log(`Client disconnected. Total clients: ${clients.length}`);

        // Reset game state
        game = new TicTacToe();
        firstSymbol = null;
        clients.forEach(c => c.player = null);

        // Notify remaining client and prompt for a new game
        clients.forEach(c => {
            c.ws.send(JSON.stringify({ type: 'status', message: 'Opponent disconnected. The game will restart.' }));
            c.ws.send(JSON.stringify({ type: 'welcome', message: welcomeMsg + ' You are the first player.' }));
            c.ws.send(JSON.stringify({ type: 'choose_symbol' }));
        });
    });
});

function assignPlayer(ws, requestedSymbol) {
    requestedSymbol = requestedSymbol === "O" ? "O" : "X";
    if (clients.some(c => c.player === requestedSymbol)) return null;
    const client = clients.find(c => c.ws === ws);
    client.player = requestedSymbol;
    game.addPlayer(requestedSymbol);
    return requestedSymbol;
}

function assignSymbolsToClients() {
    if (!firstSymbol) return;
    clients.forEach(c => {
        if (!c.player) {
            const autoSymbol = firstSymbol === "X" ? "O" : "X";
            c.player = autoSymbol;
            // Set currentPlayer if not already
            if (!game.currentPlayer) game.currentPlayer = firstSymbol;
            c.ws.send(JSON.stringify({ type: 'symbol', symbol: autoSymbol }));
        }
    });
}

function broadcastUpdate() {
    const state = game.getState();
    clients.forEach(c => {
        c.ws.send(JSON.stringify({ type: 'update', ...state }));
        if (state.winner) {
            c.ws.send(JSON.stringify({ type: state.winner === "draw" ? "draw" : "win", winner: state.winner }));
        }
    });
}

console.log(`Server running on client port ${CLIENT_PORT}, federation port ${FEDERATION_PORT}, peer federation port ${PEER_FEDERATION_PORT}`);