class TicTacToe {
    constructor() {
        this.board = [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""]
        ];
        this.players = { X: null, O: null }; // Track which server each player is on
        this.currentPlayer = 'X';
        this.winner = null;
        this.draw = false;
        this.version = 0;
    }

    addPlayer(symbol, serverId) {
        if (this.players[symbol] === null) {
            this.players[symbol] = serverId;
            
            // Set currentPlayer to the first joined player
            if (this.players.X !== null && this.players.O === null) {
                this.currentPlayer = 'X';
            } else if (this.players.X === null && this.players.O !== null) {
                this.currentPlayer = 'O';
            }
        }
    }

    removePlayer(symbol) {
        this.players[symbol] = null;
    }

    isGameFull() {
        return this.players.X !== null && this.players.O !== null;
    }

    isValidMove(row, col, player) {
        return (
            row >= 0 && row < 3 &&
            col >= 0 && col < 3 &&
            this.board[row][col] === "" &&
            player === this.currentPlayer &&
            !this.winner &&
            !this.draw
        );
    }

    makeMove(row, col, player) {
        if (!this.isValidMove(row, col, player)) return false;
        
        this.board[row][col] = player;
        this.checkWinner();
        
        // Switch turn if no winner
        if (!this.winner && !this.draw) {
            this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        }
        
        return true;
    }

    checkWinner() {
        const b = this.board;
        const lines = [
            // Rows
            [b[0][0], b[0][1], b[0][2]],
            [b[1][0], b[1][1], b[1][2]],
            [b[2][0], b[2][1], b[2][2]],
            // Columns
            [b[0][0], b[1][0], b[2][0]],
            [b[0][1], b[1][1], b[2][1]],
            [b[0][2], b[1][2], b[2][2]],
            // Diagonals
            [b[0][0], b[1][1], b[2][2]],
            [b[0][2], b[1][1], b[2][0]],
        ];
        
        for (const line of lines) {
            if (line[0] && line[0] === line[1] && line[1] === line[2]) {
                this.winner = line[0];
                return;
            }
        }
        
        // Check for draw
        if (this.isDraw()) {
            this.draw = true;
        }
    }

    isDraw() {
        return this.board.flat().every(cell => cell) && !this.winner;
    }

    getState() {
        return {
            board: this.board,
            nextTurn: this.currentPlayer,
            winner: this.winner || undefined,
            draw: this.draw || undefined,
            players: {...this.players},
            version: this.version
        };
    }

    setState(newState) {
        this.board = newState.board;
        this.currentPlayer = newState.nextTurn;
        this.winner = newState.winner || null;
        this.draw = newState.draw || false;
        this.players = {...newState.players};
        this.version = newState.version;
    }

    reset() {
        this.board = [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""]
        ];
        this.winner = null;
        this.draw = false;
        // Keep players but reset current player to first joined
        if (this.players.X !== null) {
            this.currentPlayer = 'X';
        } else if (this.players.O !== null) {
            this.currentPlayer = 'O';
        }
    }
}

module.exports = TicTacToe;