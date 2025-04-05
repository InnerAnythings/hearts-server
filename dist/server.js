"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importStar(require("ws"));
const uuid_1 = require("uuid");
const game_1 = require("./game");
const types_1 = require("./types");
const PORT = process.env.PORT || 8080;
// --- Game Management ---
const games = new Map(); // Map gameId to Game instance
const clients = new Map(); // Map ws connection to player/game info
// --- WebSocket Server Setup ---
const wss = new ws_1.WebSocketServer({ port: Number(PORT) });
console.log(`WebSocket server started on port ${PORT}`);
wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message.toString());
            console.log('Received:', parsedMessage);
            const clientInfo = clients.get(ws);
            if (parsedMessage.type === types_1.ClientToServerMessageType.JoinGame) {
                handleJoinGame(ws, parsedMessage.payload.playerName || `Player_${(0, uuid_1.v4)().substring(0, 4)}`);
            }
            else if (clientInfo) {
                // Message from a player already in a game
                const game = games.get(clientInfo.gameId);
                if (game) {
                    game.handleMessage(clientInfo.playerId, parsedMessage);
                }
                else {
                    console.warn(`Received message from player ${clientInfo.playerId} but game ${clientInfo.gameId} not found.`);
                    // Optionally send an error back to the client
                }
            }
            else {
                console.warn("Received message from unknown client or client not in a game.");
                // Optionally send an error back
                ws.send(JSON.stringify({
                    type: types_1.ServerToClientMessageType.Error,
                    payload: { message: "You have not joined a game." }
                }));
            }
        }
        catch (error) {
            console.error('Failed to process message or invalid JSON:', message.toString(), error);
            // Optionally send an error message back to the sender if the ws connection is known
            if (ws.readyState === ws_1.default.OPEN) {
                ws.send(JSON.stringify({
                    type: types_1.ServerToClientMessageType.Error,
                    payload: { message: "Invalid message format." }
                }));
            }
        }
    });
    ws.on('close', () => {
        console.log('Client disconnected');
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            const game = games.get(clientInfo.gameId);
            game === null || game === void 0 ? void 0 : game.removePlayer(clientInfo.playerId); // Let the game handle removal logic
            clients.delete(ws); // Remove from the central client map
            // If game becomes empty after removal, game.removePlayer should handle cleanup via onGameEnd
        }
    });
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        // Clean up associated player/game if possible
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            const game = games.get(clientInfo.gameId);
            game === null || game === void 0 ? void 0 : game.removePlayer(clientInfo.playerId);
            clients.delete(ws);
        }
    });
});
// --- Helper Functions ---
function findOrCreateGame() {
    // Try to find a game waiting for players
    for (const game of games.values()) {
        if (game.phase === 'WAITING_FOR_PLAYERS' && game.players.size < 4) {
            console.log(`Found existing game ${game.gameId} for new player.`);
            return game;
        }
    }
    // No suitable game found, create a new one
    const gameId = (0, uuid_1.v4)();
    const broadcast = (message, excludePlayerId) => {
        const game = games.get(gameId);
        if (!game)
            return;
        game.players.forEach(player => {
            if (player.id !== excludePlayerId) {
                sendToClient(player.ws, message);
            }
        });
    };
    const sendToPlayer = (playerId, message) => {
        const game = games.get(gameId);
        const player = game === null || game === void 0 ? void 0 : game.players.get(playerId);
        if (player) {
            sendToClient(player.ws, message);
        }
    };
    const onGameEnd = (endedGameId) => {
        console.log(`Game ${endedGameId} ended. Removing from active games.`);
        const game = games.get(endedGameId);
        if (game) {
            // Clean up client map entries for players of this game
            game.players.forEach((player, playerId) => {
                clients.delete(player.ws);
                // Optionally close the WebSocket connection? Or let client reconnect/join new game.
                // player.ws.close(); // Be careful with this, client might want to rejoin
            });
            games.delete(endedGameId);
        }
    };
    const newGame = new game_1.Game(gameId, broadcast, sendToPlayer, onGameEnd);
    games.set(gameId, newGame);
    console.log(`Created new game ${gameId}.`);
    return newGame;
}
function handleJoinGame(ws, playerName) {
    if (clients.has(ws)) {
        console.warn("Client attempting to join game multiple times.");
        sendToClient(ws, { type: types_1.ServerToClientMessageType.Error, payload: { message: "Already in a game." } });
        return;
    }
    const game = findOrCreateGame();
    const player = game.addPlayer(ws, playerName);
    if (player) {
        // Store mapping for future messages and cleanup
        clients.set(ws, { playerId: player.id, gameId: game.gameId });
    }
    else {
        // Game was full or couldn't add player
        sendToClient(ws, { type: types_1.ServerToClientMessageType.Error, payload: { message: "Failed to join game (maybe full or already started)." } });
        ws.close(); // Close connection if they couldn't join
    }
}
function sendToClient(ws, message) {
    if (ws.readyState === ws_1.default.OPEN) {
        ws.send(JSON.stringify(message));
    }
    else {
        console.warn("Attempted to send message to a non-open WebSocket.");
        // Handle cleanup if the socket is closed/closing
        const clientInfo = clients.get(ws);
        if (clientInfo) {
            const game = games.get(clientInfo.gameId);
            game === null || game === void 0 ? void 0 : game.removePlayer(clientInfo.playerId);
            clients.delete(ws);
        }
    }
}
// Graceful shutdown (optional but recommended)
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    wss.close(() => {
        console.log('WebSocket server closed.');
        // Add any other cleanup logic here
        process.exit(0);
    });
    // Force close connections after a timeout if needed
    setTimeout(() => {
        console.error("Could not close connections gracefully, forcing exit.");
        process.exit(1);
    }, 5000);
});
