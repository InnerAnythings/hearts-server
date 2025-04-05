import { Suit, Rank, Card } from './types';

/** Creates a standard 52-card deck */
export function createDeck(): Card[] {
    const suits = Object.values(Suit);
    const ranks = Object.values(Rank);
    const deck: Card[] = [];
    for (const suit of suits) {
        for (const rank of ranks) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

/** Shuffles an array of cards in place using Fisher-Yates algorithm */
export function shuffleDeck(deck: Card[]): void {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
    }
}

/** Compares two cards for sorting purposes (e.g., in hand) */
export function compareCards(a: Card, b: Card): number {
    const suitOrder = [Suit.Clubs, Suit.Diamonds, Suit.Spades, Suit.Hearts];
    const rankOrder = Object.values(Rank); // Assuming enum order is 2-A

    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    if (suitDiff !== 0) {
        return suitDiff;
    }
    return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
}

/** Returns the point value of a card in Hearts */
export function getCardValue(card: Card): number {
    if (card.suit === Suit.Hearts) {
        return 1;
    }
    if (card.suit === Suit.Spades && card.rank === Rank.Queen) {
        return 13;
    }
    return 0;
}

/** Checks if a card is the Queen of Spades */
export function isQueenOfSpades(card: Card): boolean {
    return card.suit === Suit.Spades && card.rank === Rank.Queen;
}