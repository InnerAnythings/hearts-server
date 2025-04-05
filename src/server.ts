import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Game } from './game';
import { Player } from './player';
import { WebSocketMessage, ClientToServerMessageType, ServerToClientMessageType } from './types';

const PORT = process.env.PORT || 8080;

// --- Game Management ---
const games = new Map<string, Game>(); // Map gameId to Game instance
const clients = new Map<WebSocket, { playerId: string; gameId: string }>(); // Map ws connection to player/game info

// --- WebSocket Server Setup ---
const wss = new WebSocketServer({ port: Number(PORT) });

console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        try {
            const parsedMessage: WebSocketMessage = JSON.parse(message.toString());
            console.log('Received:', parsedMessage);

            const clientInfo = clients.get(ws);

            if (parsedMessage.type === ClientToServerMessageType.JoinGame) {
                handleJoinGame(ws, parsedMessage.payload.playerName || `Player_${uuidv4().substring(0, 4)}`);
            } else if (clientInfo) {
                // Message from a player already in a game
                const game = games.get(clientInfo.gameId);
                if (game) {
                    game.handleMessage(clientInfo.playerId, parsedMessage);
                } else {
                    console.warn(`Received message from player ${clientInfo.playerId} but game ${clientInfo.gameId} not found.`);
                    // Optionally send an error back to the client
                }
            } else {
                console.warn("Received message from unknown client or client not in a game.");
                // Optionally send an error back
                ws.send(JSON.stringify({
                    type: ServerToClientMessageType.Error,
                    payload: { message: "You have not joined a game." }
                }));
            }

        } catch (error) {
            console.error('Failed to process message or invalid JSON:', message.toString(), error);
            // Optionally send an error message back to the sender if the ws connection is known
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: ServerToClientMessageType.Error,
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
            game?.removePlayer(clientInfo.playerId); // Let the game handle removal logic
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
            game?.removePlayer(clientInfo.playerId);
            clients.delete(ws);
        }
    });
});

// --- Helper Functions ---

function findOrCreateGame(): Game {
    // Try to find a game waiting for players
    for (const game of games.values()) {
        if (game.phase === 'WAITING_FOR_PLAYERS' && game.players.size < 4) {
            console.log(`Found existing game ${game.gameId} for new player.`);
            return game;
        }
    }

    // No suitable game found, create a new one
    const gameId = uuidv4();
    const broadcast = (message: WebSocketMessage, excludePlayerId?: string) => {
        const game = games.get(gameId);
        if (!game) return;
        game.players.forEach(player => {
            if (player.id !== excludePlayerId) {
                sendToClient(player.ws, message);
            }
        });
    };

    const sendToPlayer = (playerId: string, message: WebSocketMessage) => {
        const game = games.get(gameId);
        const player = game?.players.get(playerId);
        if (player) {
            sendToClient(player.ws, message);
        }
    };

    const onGameEnd = (endedGameId: string) => {
         console.log(`Game ${endedGameId} ended. Removing from active games.`);
         const game = games.get(endedGameId);
         if(game) {
            // Clean up client map entries for players of this game
            game.players.forEach((player, playerId) => {
                clients.delete(player.ws);
                // Optionally close the WebSocket connection? Or let client reconnect/join new game.
                // player.ws.close(); // Be careful with this, client might want to rejoin
            });
            games.delete(endedGameId);
         }
    };


    const newGame = new Game(gameId, broadcast, sendToPlayer, onGameEnd);
    games.set(gameId, newGame);
    console.log(`Created new game ${gameId}.`);
    return newGame;
}

function handleJoinGame(ws: WebSocket, playerName: string) {
    if (clients.has(ws)) {
        console.warn("Client attempting to join game multiple times.");
        sendToClient(ws, { type: ServerToClientMessageType.Error, payload: { message: "Already in a game." } });
        return;
    }

    const game = findOrCreateGame();
    const player = game.addPlayer(ws, playerName);

    if (player) {
        // Store mapping for future messages and cleanup
        clients.set(ws, { playerId: player.id, gameId: game.gameId });
    } else {
        // Game was full or couldn't add player
        sendToClient(ws, { type: ServerToClientMessageType.Error, payload: { message: "Failed to join game (maybe full or already started)." } });
        ws.close(); // Close connection if they couldn't join
    }
}

function sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
         console.warn("Attempted to send message to a non-open WebSocket.");
         // Handle cleanup if the socket is closed/closing
         const clientInfo = clients.get(ws);
         if (clientInfo) {
             const game = games.get(clientInfo.gameId);
             game?.removePlayer(clientInfo.playerId);
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