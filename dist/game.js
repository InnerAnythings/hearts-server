"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Game = void 0;
const uuid_1 = require("uuid"); // For generating unique IDs
const player_1 = require("./player");
const types_1 = require("./types");
const card_1 = require("./card");
const MAX_PLAYERS = 4;
const SCORE_LIMIT = 100;
const PASS_COUNT = 3;
/** Represents a single instance of a Hearts game */
class Game {
    constructor(gameId, broadcast, sendToPlayer, onGameEnd) {
        this.players = new Map(); // Map player ID to Player object
        this.playerOrder = []; // Order of players for turns
        this.deck = [];
        this.roundNumber = 0;
        this.passingDirection = null;
        this.currentPlayerIndex = -1; // Index in playerOrder
        this.currentTrick = this.createEmptyTrick();
        this.heartsBroken = false;
        this.phase = types_1.GamePhase.WaitingForPlayers;
        this.gameId = gameId;
        this.broadcast = broadcast;
        this.sendToPlayer = sendToPlayer;
        this.onGameEnd = onGameEnd;
        console.log(`Game ${gameId} created.`);
    }
    /** Adds a player to the game */
    addPlayer(ws, playerName) {
        if (this.players.size >= MAX_PLAYERS) {
            console.warn(`Game ${this.gameId}: Attempted to add player beyond limit.`);
            return null; // Game is full
        }
        if (this.phase !== types_1.GamePhase.WaitingForPlayers) {
            console.warn(`Game ${this.gameId}: Attempted to add player while game in progress.`);
            return null; // Can only join before starting
        }
        const playerId = (0, uuid_1.v4)();
        const player = new player_1.Player(playerId, playerName, ws);
        this.players.set(playerId, player);
        this.playerOrder.push(playerId); // Add to the end for now
        console.log(`Player ${playerName} (${playerId}) joined game ${this.gameId}`);
        // Notify player they joined
        this.sendToPlayer(playerId, {
            type: types_1.ServerToClientMessageType.GameJoined,
            payload: { playerId: playerId, gameId: this.gameId }
        });
        this.broadcastGameState(); // Update everyone
        // Start game if full
        if (this.players.size === MAX_PLAYERS) {
            this.startNewRound();
        }
        return player;
    }
    /** Removes a player (e.g., on disconnect) */
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (player) {
            console.log(`Player ${player.name} (${playerId}) left game ${this.gameId}`);
            this.players.delete(playerId);
            this.playerOrder = this.playerOrder.filter(id => id !== playerId);
            // Handle game state changes due to player leaving
            if (this.phase !== types_1.GamePhase.WaitingForPlayers && this.phase !== types_1.GamePhase.GameOver) {
                // For simplicity, end the game if a player leaves mid-game
                console.log(`Game ${this.gameId} ending due to player departure.`);
                this.endGame(`Player ${player.name} left the game.`);
            }
            else if (this.phase === types_1.GamePhase.WaitingForPlayers) {
                this.broadcastGameState(); // Update remaining players
            }
        }
    }
    /** Handles incoming messages from a specific player */
    handleMessage(playerId, message) {
        const player = this.players.get(playerId);
        if (!player)
            return; // Ignore messages from unknown players
        try {
            switch (message.type) {
                case types_1.ClientToServerMessageType.SelectCardsToPass:
                    if (this.phase === types_1.GamePhase.Passing && playerId === player.id) {
                        this.handlePassCards(player, message.payload.cards);
                    }
                    else {
                        throw new Error("Cannot pass cards at this time.");
                    }
                    break;
                case types_1.ClientToServerMessageType.PlayCard:
                    if (this.phase === types_1.GamePhase.PlayingTrick && this.getCurrentPlayerId() === playerId) {
                        this.handlePlayCard(player, message.payload.card);
                    }
                    else {
                        throw new Error("Not your turn or not in playing phase.");
                    }
                    break;
                // Add handlers for other client messages if needed
                default:
                    console.warn(`Game ${this.gameId}: Received unknown message type ${message.type} from ${playerId}`);
            }
        }
        catch (error) {
            console.error(`Error handling message from ${playerId}: ${error.message}`);
            this.sendError(playerId, error.message);
        }
    }
    // --- Game Flow Methods ---
    startNewRound() {
        if (this.players.size !== MAX_PLAYERS)
            return; // Should not happen if called correctly
        this.roundNumber++;
        console.log(`Game ${this.gameId}: Starting Round ${this.roundNumber}`);
        this.heartsBroken = false;
        this.currentTrick = this.createEmptyTrick();
        this.players.forEach(p => p.resetForNewRound());
        // 1. Determine Passing Direction
        this.passingDirection = this.getPassingDirection(this.roundNumber);
        // 2. Deal Cards
        this.deck = (0, card_1.createDeck)();
        (0, card_1.shuffleDeck)(this.deck);
        this.dealCards();
        // 3. Start Passing or Play
        if (this.passingDirection === types_1.PassingDirection.Hold) {
            this.phase = types_1.GamePhase.PlayingTrick;
            // Find player with 2 of Clubs to start
            this.currentPlayerIndex = this.findPlayerWithTwoOfClubs();
            this.broadcastGameState();
            this.notifyCurrentPlayerTurn();
        }
        else {
            this.phase = types_1.GamePhase.Passing;
            this.broadcastGameState(); // Inform clients about passing phase and their hands
        }
    }
    dealCards() {
        let playerIndex = 0;
        this.deck.forEach((card, i) => {
            const playerId = this.playerOrder[playerIndex % MAX_PLAYERS];
            const player = this.players.get(playerId);
            if (player) {
                player.hand.push(card);
            }
            playerIndex++;
        });
        // Sort hands
        this.players.forEach(p => p.hand.sort(card_1.compareCards));
    }
    getPassingDirection(round) {
        const directionIndex = (round - 1) % 4; // 0=Left, 1=Right, 2=Across, 3=Hold
        switch (directionIndex) {
            case 0: return types_1.PassingDirection.Left;
            case 1: return types_1.PassingDirection.Right;
            case 2: return types_1.PassingDirection.Across;
            default: return types_1.PassingDirection.Hold;
        }
    }
    findPlayerWithTwoOfClubs() {
        for (let i = 0; i < this.playerOrder.length; i++) {
            const playerId = this.playerOrder[i];
            const player = this.players.get(playerId);
            if (player === null || player === void 0 ? void 0 : player.hand.some(c => c.rank === types_1.Rank.Two && c.suit === types_1.Suit.Clubs)) {
                return i;
            }
        }
        // Should always find one in a standard game
        console.error(`Game ${this.gameId}: CRITICAL - Two of Clubs not found!`);
        return 0; // Default to first player if something went wrong
    }
    handlePassCards(player, cardsToPass) {
        if (!Array.isArray(cardsToPass) || cardsToPass.length !== PASS_COUNT) {
            throw new Error(`Invalid number of cards selected. Please select ${PASS_COUNT}.`);
        }
        if (player.cardsToPass) {
            throw new Error("You have already selected cards to pass.");
        }
        // Validate that the player actually has these cards
        const handSet = new Set(player.hand.map(c => `${c.suit}${c.rank}`));
        for (const card of cardsToPass) {
            if (!card || typeof card.suit !== 'string' || typeof card.rank !== 'string' || !handSet.has(`${card.suit}${card.rank}`)) {
                throw new Error("Invalid card selected or card not in hand.");
            }
        }
        // Store selected cards and remove from hand temporarily
        player.cardsToPass = cardsToPass.map(c => (Object.assign({}, c))); // Deep copy
        player.hand = player.hand.filter(handCard => !cardsToPass.some(passCard => passCard.suit === handCard.suit && passCard.rank === handCard.rank));
        console.log(`Player ${player.name} selected cards to pass.`);
        this.sendToPlayer(player.id, { type: types_1.ServerToClientMessageType.GameStateUpdate, payload: this.getGameStateForPlayer(player.id) }); // Update sender's state
        // Check if all players have passed
        if (Array.from(this.players.values()).every(p => p.cardsToPass !== null)) {
            this.executePassing();
        }
        else {
            // Optionally, update others that this player is ready (but don't reveal cards)
            this.broadcastGameState(); // Or a more specific 'PlayerReady' message
        }
    }
    executePassing() {
        console.log(`Game ${this.gameId}: Executing card pass (${this.passingDirection}).`);
        if (!this.passingDirection || this.passingDirection === types_1.PassingDirection.Hold)
            return;
        const playerIds = this.playerOrder;
        const numPlayers = playerIds.length;
        const tempReceived = new Map();
        for (let i = 0; i < numPlayers; i++) {
            const currentPlayerId = playerIds[i];
            const currentPlayer = this.players.get(currentPlayerId);
            const cards = currentPlayer.cardsToPass;
            let targetPlayerIndex;
            switch (this.passingDirection) {
                case types_1.PassingDirection.Left:
                    targetPlayerIndex = (i + 1) % numPlayers;
                    break;
                case types_1.PassingDirection.Right:
                    targetPlayerIndex = (i - 1 + numPlayers) % numPlayers;
                    break;
                case types_1.PassingDirection.Across:
                    targetPlayerIndex = (i + 2) % numPlayers; // Assumes 4 players
                    break;
                default: // Should not happen
                    targetPlayerIndex = i;
            }
            const targetPlayerId = playerIds[targetPlayerIndex];
            tempReceived.set(targetPlayerId, cards);
            currentPlayer.cardsToPass = null; // Clear passed cards marker
        }
        // Assign received cards and update hands
        this.players.forEach((player, playerId) => {
            player.receivedCards = tempReceived.get(playerId) || [];
            player.addReceivedCardsToHand(); // Adds received cards and sorts hand
            // Notify player of received cards (optional, could be part of game state update)
            this.sendToPlayer(playerId, {
                type: types_1.ServerToClientMessageType.CardsPassed,
                payload: { receivedCards: player.receivedCards } // This is redundant now as they are in hand
            });
        });
        // Transition to playing phase
        this.phase = types_1.GamePhase.PlayingTrick;
        // Find player with 2 of Clubs to start the first trick
        this.currentPlayerIndex = this.findPlayerWithTwoOfClubs();
        this.broadcastGameState();
        this.notifyCurrentPlayerTurn();
    }
    handlePlayCard(player, card) {
        // 1. Validate the Play
        if (!this.isValidPlay(player, card)) {
            // Error is sent by isValidPlay
            return;
        }
        // 2. Remove card from player's hand
        const cardIndex = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
        if (cardIndex === -1) {
            this.sendError(player.id, "Card not found in your hand."); // Should not happen if validation is correct
            return;
        }
        player.hand.splice(cardIndex, 1);
        // 3. Add card to the current trick
        this.currentTrick.cards.push({ playerId: player.id, card });
        if (this.currentTrick.cards.length === 1) {
            this.currentTrick.leadingSuit = card.suit; // Set leading suit
        }
        // 4. Check if Hearts are broken
        if (card.suit === types_1.Suit.Hearts && !this.heartsBroken) {
            this.heartsBroken = true;
            console.log(`Game ${this.gameId}: Hearts have been broken!`);
        }
        if ((0, card_1.isQueenOfSpades)(card) && !this.heartsBroken && this.currentTrick.cards.length < MAX_PLAYERS && this.isFirstTrick()) {
            // Technically Queen of Spades can be played on the first trick if player has no other choice
            // but breaking hearts rule often applied implicitly. Re-evaluate rule needed here.
            // Let's assume for now QOS *can* break hearts if no other choice.
            // if (!this.heartsBroken) this.heartsBroken = true; // Decide if QOS breaks hearts implicitly
        }
        console.log(`Player ${player.name} played ${card.rank}${card.suit}`);
        // 5. Check if trick is complete
        if (this.currentTrick.cards.length === this.players.size) {
            this.broadcastGameState(); // Update everyone on the played card
            this.endTrick();
        }
        else {
            // 6. Advance turn
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.size;
            this.broadcastGameState(); // Update everyone on the played card
            this.notifyCurrentPlayerTurn();
        }
    }
    isValidPlay(player, card) {
        const hand = player.hand;
        const isFirstPlayerInTrick = this.currentTrick.cards.length === 0;
        const leadingSuit = this.currentTrick.leadingSuit;
        // Basic check: Does the player have the card?
        if (!hand.some(c => c.suit === card.suit && c.rank === card.rank)) {
            this.sendError(player.id, "Invalid play: Card not in hand.");
            return false;
        }
        // Rule: Must play 2 of Clubs on the very first trick
        if (this.isFirstTrick() && isFirstPlayerInTrick) {
            if (card.suit !== types_1.Suit.Clubs || card.rank !== types_1.Rank.Two) {
                this.sendError(player.id, "Invalid play: Must lead with the 2 of Clubs on the first trick.");
                return false;
            }
            return true; // 2 of Clubs is always valid first play
        }
        // Rule: No points on the first trick (Hearts or Queen of Spades)
        if (this.isFirstTrick()) {
            if ((0, card_1.getCardValue)(card) > 0) {
                // Exception: Can play points if player *only* has point cards
                const hasOnlyPoints = hand.every(c => (0, card_1.getCardValue)(c) > 0);
                if (!hasOnlyPoints) {
                    this.sendError(player.id, "Invalid play: Cannot play Hearts or Queen of Spades on the first trick unless it's all you have.");
                    return false;
                }
                // Allow if it's the only option
            }
        }
        // Rule: Following suit
        if (!isFirstPlayerInTrick && leadingSuit) {
            const hasLeadingSuit = hand.some(c => c.suit === leadingSuit);
            if (hasLeadingSuit && card.suit !== leadingSuit) {
                this.sendError(player.id, `Invalid play: Must follow the leading suit (${leadingSuit}).`);
                return false;
            }
            // If player cannot follow suit, they can play anything (respecting other rules)
        }
        // Rule: Cannot lead with Hearts unless broken or only Hearts left
        if (isFirstPlayerInTrick) {
            if (card.suit === types_1.Suit.Hearts && !this.heartsBroken) {
                const hasOnlyHearts = hand.every(c => c.suit === types_1.Suit.Hearts);
                if (!hasOnlyHearts) {
                    this.sendError(player.id, "Invalid play: Cannot lead with Hearts until they are broken (or it's all you have).");
                    return false;
                }
            }
        }
        // If we reach here, the play is valid according to the rules checked
        return true;
    }
    isFirstTrick() {
        var _a;
        // Check if it's the first trick of the round (no player has any round score yet, implies no tricks taken)
        // A more robust check might be needed if scores could be manipulated,
        // but checking if player hands still sum to 13 cards played is better.
        return ((_a = this.players.get(this.playerOrder[0])) === null || _a === void 0 ? void 0 : _a.hand.length) === (13); // 13 cards initially dealt -1 for current trick leader
        // Or check if total cards played in the game round is less than MAX_PLAYERS
        // return this.currentTrick.cards.length === 0 && Array.from(this.players.values()).every(p => p.roundScore === 0);
    }
    endTrick() {
        this.phase = types_1.GamePhase.TrickComplete; // Intermediate state
        console.log(`Game ${this.gameId}: Trick complete.`);
        // 1. Determine Trick Winner
        const winnerInfo = this.calculateTrickWinner();
        this.currentTrick.trickWinnerId = winnerInfo.winnerId;
        const winningPlayer = this.players.get(winnerInfo.winnerId);
        // 2. Calculate Points in Trick
        let trickPoints = 0;
        const trickCards = [];
        this.currentTrick.cards.forEach(playedCard => {
            trickPoints += (0, card_1.getCardValue)(playedCard.card);
            trickCards.push(playedCard.card);
        });
        // 3. Assign Points to Winner
        winningPlayer.roundScore += trickPoints;
        console.log(`Trick won by ${winningPlayer.name} with ${winnerInfo.winningCard.rank}${winnerInfo.winningCard.suit}. Points: ${trickPoints}`);
        // Notify players about the trick winner and points
        this.broadcast({
            type: types_1.ServerToClientMessageType.TrickWon,
            payload: {
                winnerId: winnerInfo.winnerId,
                winnerName: winningPlayer.name,
                pointsTaken: trickPoints,
                trickCards: this.currentTrick.cards // Show what was played
            }
        });
        // Short delay before starting next trick or round (optional)
        setTimeout(() => {
            // 4. Check if Round is Over (no cards left)
            if (winningPlayer.hand.length === 0) {
                this.endRound();
            }
            else {
                // 5. Start Next Trick
                this.phase = types_1.GamePhase.PlayingTrick;
                this.currentPlayerIndex = this.playerOrder.indexOf(winnerInfo.winnerId); // Winner leads next trick
                this.currentTrick = this.createEmptyTrick();
                this.broadcastGameState();
                this.notifyCurrentPlayerTurn();
            }
        }, 2000); // 2 second delay to see trick results
    }
    calculateTrickWinner() {
        if (this.currentTrick.cards.length === 0 || !this.currentTrick.leadingSuit) {
            // Should not happen in endTrick
            throw new Error("Cannot determine winner of an empty or non-started trick.");
        }
        const leadingSuit = this.currentTrick.leadingSuit;
        let winningCard = this.currentTrick.cards[0].card; // First card played is initially winning
        let winnerId = this.currentTrick.cards[0].playerId;
        // Iterate through the rest of the cards played in the trick
        for (let i = 1; i < this.currentTrick.cards.length; i++) {
            const currentPlayed = this.currentTrick.cards[i];
            const currentCard = currentPlayed.card;
            // Only compare if the current card is of the leading suit
            if (currentCard.suit === leadingSuit) {
                // Compare ranks (assuming rank enum order or a helper function)
                const rankOrder = Object.values(types_1.Rank);
                if (rankOrder.indexOf(currentCard.rank) > rankOrder.indexOf(winningCard.rank)) {
                    winningCard = currentCard;
                    winnerId = currentPlayed.playerId;
                }
            }
            // If not leading suit, it cannot win unless the current winner isn't leading suit (impossible by rules)
        }
        return { winnerId, winningCard };
    }
    endRound() {
        this.phase = types_1.GamePhase.RoundScoring;
        console.log(`Game ${this.gameId}: Round ${this.roundNumber} over. Calculating scores...`);
        // Check for Shooting the Moon
        let shooter = null;
        for (const player of this.players.values()) { // Iterate directly over Player objects
            if (player.roundScore === 26) { // 13 hearts + 13 for Queen of Spades
                shooter = player;
                break; // Found the shooter, no need to check others
            }
        }
        if (shooter) {
            console.log(`!!! ${shooter.name} shot the moon !!!`);
            // Assign scores: shooter gets 0, others get 26
            this.players.forEach(player => {
                if (player.id === shooter.id) {
                    player.score += 0; // Or optionally subtract 26 if score allows
                }
                else {
                    player.score += 26;
                }
            });
        }
        else {
            // Standard scoring: add round score to total score
            this.players.forEach(player => {
                player.score += player.roundScore;
            });
        }
        // Log scores
        this.players.forEach(p => console.log(`${p.name}: Round Score=${p.roundScore}, Total Score=${p.score}`));
        // Broadcast round results
        this.broadcast({
            type: types_1.ServerToClientMessageType.RoundScored,
            payload: {
                scores: this.getAllPlayerInfo(),
                shooterId: shooter ? shooter.id : null
            }
        });
        // Check for Game Over condition
        const gameOver = Array.from(this.players.values()).some(p => p.score >= SCORE_LIMIT);
        // Delay before next round or game over
        setTimeout(() => {
            if (gameOver) {
                this.endGame();
            }
            else {
                this.startNewRound(); // Start the next round
            }
        }, 3000); // 3 second delay
    }
    endGame(reason = "Score limit reached.") {
        this.phase = types_1.GamePhase.GameOver;
        console.log(`Game ${this.gameId}: Game Over. ${reason}`);
        // Determine winner (lowest score)
        let winner = null;
        let lowestScore = Infinity;
        this.players.forEach(player => {
            const info = player.getPlayerInfo();
            if (info.score < lowestScore) {
                lowestScore = info.score;
                winner = info;
            }
            // Handle ties if necessary (e.g., list all players with the lowest score)
        });
        this.broadcast({
            type: types_1.ServerToClientMessageType.GameOver,
            payload: {
                winner: winner,
                finalScores: this.getAllPlayerInfo(),
                reason: reason
            }
        });
        // Clean up game resources / notify manager
        this.onGameEnd(this.gameId);
    }
    // --- Communication Helpers ---
    broadcastGameState() {
        // Send tailored state to each player (only their hand)
        this.players.forEach((player, playerId) => {
            const state = this.getGameStateForPlayer(playerId);
            this.sendToPlayer(playerId, { type: types_1.ServerToClientMessageType.GameStateUpdate, payload: state });
        });
    }
    /** Gets the game state tailored for a specific player */
    getGameStateForPlayer(playerId) {
        var _a;
        const player = this.players.get(playerId);
        if (!player)
            throw new Error("Player not found for state generation");
        const publicPlayerInfo = this.getAllPlayerInfo();
        const state = {
            gameId: this.gameId,
            players: publicPlayerInfo,
            currentPlayerId: this.getCurrentPlayerId(),
            phase: this.phase,
            roundNumber: this.roundNumber,
            passingDirection: this.passingDirection,
            currentTrick: {
                leadingSuit: this.currentTrick.leadingSuit,
                cards: this.currentTrick.cards,
                trickWinnerId: null // Winner known only after trick ends
            },
            heartsBroken: this.heartsBroken,
            // Player specific info:
            hand: player.hand, // Send only this player's hand
            // Optionally calculate and send valid moves if it's their turn
            // validMoves: (this.getCurrentPlayerId() === playerId && this.phase === GamePhase.PlayingTrick)
            //     ? this.calculateValidMoves(player)
            //     : undefined,
            cardsToPass: (_a = player.cardsToPass) !== null && _a !== void 0 ? _a : undefined, // Show selected cards if passing phase
        };
        return state;
    }
    /** Sends a specific "Your Turn" message, potentially with valid moves */
    notifyCurrentPlayerTurn() {
        const currentPlayerId = this.getCurrentPlayerId();
        if (currentPlayerId && this.phase === types_1.GamePhase.PlayingTrick) {
            const player = this.players.get(currentPlayerId);
            const validMoves = this.calculateValidMoves(player); // Calculate valid moves
            this.sendToPlayer(currentPlayerId, {
                type: types_1.ServerToClientMessageType.YourTurn,
                payload: {
                    validMoves: validMoves
                }
            });
            console.log(`Notified ${player.name} it's their turn.`);
        }
    }
    /** Calculates the valid cards a player can play */
    calculateValidMoves(player) {
        // This is essentially the logic from `isValidPlay` applied to the whole hand
        const hand = player.hand;
        const validMoves = [];
        const isFirstPlayerInTrick = this.currentTrick.cards.length === 0;
        const leadingSuit = this.currentTrick.leadingSuit;
        // Rule: Must play 2 of Clubs on the very first trick
        if (this.isFirstTrick() && isFirstPlayerInTrick) {
            const twoOfClubs = hand.find(c => c.rank === types_1.Rank.Two && c.suit === types_1.Suit.Clubs);
            return twoOfClubs ? [twoOfClubs] : []; // Should always have it
        }
        const canFollowSuit = leadingSuit ? hand.some(c => c.suit === leadingSuit) : false;
        // Rule: No points on the first trick (Hearts or Queen of Spades)
        const isFirst = this.isFirstTrick();
        const canPlayPointsOnFirstTrick = hand.every(c => (0, card_1.getCardValue)(c) > 0); // Only if forced
        // Rule: Cannot lead with Hearts unless broken or only Hearts left
        const canLeadHearts = this.heartsBroken || hand.every(c => c.suit === types_1.Suit.Hearts);
        for (const card of hand) {
            let isValid = true;
            // Check first trick point rule
            if (isFirst && (0, card_1.getCardValue)(card) > 0 && !canPlayPointsOnFirstTrick) {
                isValid = false;
            }
            // Check following suit rule
            if (leadingSuit && canFollowSuit && card.suit !== leadingSuit) {
                isValid = false;
            }
            // Check leading hearts rule
            if (isFirstPlayerInTrick && card.suit === types_1.Suit.Hearts && !canLeadHearts) {
                isValid = false;
            }
            if (isValid) {
                validMoves.push(card);
            }
        }
        // If following suit resulted in NO valid moves (e.g., had to follow, but all following cards broke first trick rule)
        // This implies a contradiction or a complex edge case. Usually, if you can follow suit, you must.
        // If `validMoves` is empty *after* applying all rules, it means *any* card is valid (usually because cannot follow suit).
        // However, the logic above tries to filter directly.
        // If player cannot follow suit, *all* their cards are potentially valid (subject to first trick/lead hearts rules)
        if (leadingSuit && !canFollowSuit) {
            // Re-evaluate all cards, only applying first-trick and lead-hearts rules
            const nonFollowMoves = [];
            for (const card of hand) {
                let isNonFollowValid = true;
                if (isFirst && (0, card_1.getCardValue)(card) > 0 && !canPlayPointsOnFirstTrick)
                    isNonFollowValid = false;
                // Cannot lead hearts rule doesn't apply if not leading
                if (isNonFollowValid)
                    nonFollowMoves.push(card);
            }
            // If after these checks, still no valid moves (e.g., must play points on first trick but have none), something is wrong.
            return nonFollowMoves.length > 0 ? nonFollowMoves : hand; // Fallback: allow any card if logic fails
        }
        // If after all checks, validMoves is empty, it implies an issue or edge case not handled.
        // For robustness, maybe return the whole hand if calculation yields nothing? Or log error.
        if (validMoves.length === 0 && hand.length > 0) {
            console.warn(`Game ${this.gameId}: No valid moves calculated for ${player.name}, allowing any card as fallback.`);
            return hand; // Fallback
        }
        return validMoves;
    }
    sendError(playerId, message) {
        this.sendToPlayer(playerId, {
            type: types_1.ServerToClientMessageType.Error,
            payload: { message }
        });
    }
    getCurrentPlayerId() {
        if (this.currentPlayerIndex < 0 || this.currentPlayerIndex >= this.playerOrder.length) {
            return null;
        }
        return this.playerOrder[this.currentPlayerIndex];
    }
    getAllPlayerInfo() {
        return this.playerOrder.map(id => this.players.get(id).getPlayerInfo());
    }
    createEmptyTrick() {
        return {
            leadingSuit: null,
            cards: [],
            trickWinnerId: null
        };
    }
}
exports.Game = Game;
