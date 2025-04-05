"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeck = createDeck;
exports.shuffleDeck = shuffleDeck;
exports.compareCards = compareCards;
exports.getCardValue = getCardValue;
exports.isQueenOfSpades = isQueenOfSpades;
const types_1 = require("./types");
/** Creates a standard 52-card deck */
function createDeck() {
    const suits = Object.values(types_1.Suit);
    const ranks = Object.values(types_1.Rank);
    const deck = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}
/** Shuffles an array of cards in place using Fisher-Yates algorithm */
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
    }
}
/** Compares two cards for sorting purposes (e.g., in hand) */
function compareCards(a, b) {
    const suitOrder = [types_1.Suit.Clubs, types_1.Suit.Diamonds, types_1.Suit.Spades, types_1.Suit.Hearts];
    const rankOrder = Object.values(types_1.Rank); // Assuming enum order is 2-A
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) {
        return suitDiff;
    }
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
}
/** Returns the point value of a card in Hearts */
function getCardValue(card) {
    if (card.suit === types_1.Suit.Hearts) {
        return 1;
    }
    if (card.suit === types_1.Suit.Spades && card.rank === types_1.Rank.Queen) {
        return 13;
    }
    return 0;
}
/** Checks if a card is the Queen of Spades */
function isQueenOfSpades(card) {
    return card.suit === types_1.Suit.Spades && card.rank === types_1.Rank.Queen;
}
