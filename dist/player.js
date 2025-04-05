"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const ws_1 = __importDefault(require("ws"));
// Helper function from card.ts needed here
const card_1 = require("./card");
/** Represents a connected player within a game instance */
class Player {
    constructor(id, name, ws) {
        this.hand = [];
        this.score = 0; // Total game score
        this.roundScore = 0; // Score from tricks taken this round
        this.cardsToPass = null; // Cards selected for passing
        this.receivedCards = null; // Cards received during passing
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
            this.hand.sort(card_1.compareCards); // Ensure hand is sorted
            this.receivedCards = null; // Clear received cards
        }
    }
    /** Gets basic player info for broadcasting */
    getPlayerInfo() {
        return {
            id: this.id,
            name: this.name,
            score: this.score,
            roundScore: this.roundScore,
        };
    }
    /** Sends a message to this specific player */
    sendMessage(message) {
        if (this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
        else {
            console.warn(`Attempted to send message to closed socket for player ${this.id}`);
            // Handle disconnected player state if necessary
        }
    }
}
exports.Player = Player;
