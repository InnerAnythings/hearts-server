import WebSocket from 'ws';
import { Card, PlayerInfo, WebSocketMessage } from './types';

// Helper function from card.ts needed here
import { compareCards } from './card';
/** Represents a connected player within a game instance */
export class Player {
    id: string;
    name: string;
    ws: WebSocket; // WebSocket connection for this player
    hand: Card[] = [];
    score: number = 0; // Total game score
    roundScore: number = 0; // Score from tricks taken this round
    cardsToPass: Card[] | null = null; // Cards selected for passing
    receivedCards: Card[] | null = null; // Cards received during passing

    constructor(id: string, name: string, ws: WebSocket) {
        this.id = id;
        this.name = name;
        this.ws = ws;
    }

    /** Resets player state for a new round */
    resetForNewRound() {
        this.hand = [];
        this.roundScore = 0;
        this.cardsToPass = null;
        this.receivedCards = null;
    }

    /** Adds received cards to the hand and sorts it */
    addReceivedCardsToHand() {
        if (this.receivedCards) {
            this.hand.push(...this.receivedCards);
            this.hand.sort(compareCards); // Ensure hand is sorted
            this.receivedCards = null; // Clear received cards
        }
    }

    /** Gets basic player info for broadcasting */
    getPlayerInfo(): PlayerInfo {
        return {
            id: this.id,
            name: this.name,
            score: this.score,
            roundScore: this.roundScore,
        };
    }

    /** Sends a message to this specific player */
    sendMessage(message: WebSocketMessage) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn(`Attempted to send message to closed socket for player ${this.id}`);
            // Handle disconnected player state if necessary
        }
    }
}
