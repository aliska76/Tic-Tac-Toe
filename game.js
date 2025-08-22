class TicTacToe {
    constructor() {
        this.board = [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""]
        ];
        this.players = [];
        this.currentPlayer = 'X';
        this.winner = null;
    }

    addPlayer(symbol) {
        if (!this.players.includes(symbol)) {
            this.players.push(symbol);
            // Set currentPlayer to the first joined player
            if (this.players.length === 1) {
                this.currentPlayer = symbol;
            }
        }
    }

    isValidMove(row, col, player) {
        return (
            row >= 0 && row < 3 &&
            col >= 0 && col < 3 &&
            this.board[row][col] === "" &&
            player === this.currentPlayer &&
            !this.winner
        );
    }

    makeMove(row, col, player) {
        if (!this.isValidMove(row, col, player)) return false;
        this.board[row][col] = player;
        this.checkWinner();
        
        // Switch turn if no winner
        if (!this.winner) {
            this.currentPlayer = this.players.find(p => p !== player);
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
        if (b.flat().every(cell => cell)) {
            this.winner = "draw";
        }
    }

    getState() {
        return {
            board: this.board,
            nextTurn: this.currentPlayer,
            winner: this.winner
        };
    }

    reset() {
        this.board = [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""]
        ];
        this.winner = null;
        // Do NOT reset players here!
        if (this.players.length) {
            this.currentPlayer = this.players[0];
        }
    }
}

module.exports = TicTacToe;