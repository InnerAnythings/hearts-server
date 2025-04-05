/** Enum representing card suits */
export enum Suit {
    Hearts = 'H',
    Diamonds = 'D',
    Clubs = 'C',
    Spades = 'S',
}

/** Enum representing card ranks */
export enum Rank {
    Two = '2', Three = '3', Four = '4', Five = '5', Six = '6', Seven = '7',
    Eight = '8', Nine = '9', Ten = 'T', Jack = 'J', Queen = 'Q', King = 'K', Ace = 'A',
}

/** Interface representing a single playing card */
export interface Card {
    suit: Suit;
    rank: Rank;
}

/** Interface representing a player in the game */
export interface PlayerInfo {
    id: string;
    name: string;
    score: number; // Total score across rounds
    roundScore: number; // Score accumulated in the current round
}

/** Represents the state of the current trick */
export interface Trick {
    leadingSuit: Suit | null;
    cards: { playerId: string; card: Card }[];
    trickWinnerId: string | null; // ID of the player who won the trick
}

/** Represents the overall state of a game instance */
export interface GameState {
    gameId: string;
    players: PlayerInfo[];
    currentPlayerId: string | null; // Whose turn it is
    phase: GamePhase;
    roundNumber: number;
    passingDirection: PassingDirection | null;
    currentTrick: Trick;
    heartsBroken: boolean;
    // Client-specific state (sent individually)
    hand?: Card[]; // Only send the player their own hand
    validMoves?: Card[]; // Potentially send valid moves to the current player
    cardsToPass?: Card[]; // Cards selected by the player to pass
}

/** Enum for different phases of the game */
export enum GamePhase {
    WaitingForPlayers = 'WAITING_FOR_PLAYERS',
    Passing = 'PASSING',
    PassingComplete = 'PASSING_COMPLETE', // Internal state before first trick
    PlayingTrick = 'PLAYING_TRICK',
    TrickComplete = 'TRICK_COMPLETE',
    RoundScoring = 'ROUND_SCORING',
    RoundOver = 'ROUND_OVER',
    GameOver = 'GAME_OVER',
}

/** Enum for card passing directions */
export enum PassingDirection {
    Left = 'LEFT',
    Right = 'RIGHT',
    Across = 'ACROSS',
    Hold = 'HOLD', // No passing
}

// --- WebSocket Message Types ---

/** Types of messages sent from Client to Server */
export enum ClientToServerMessageType {
    JoinGame = 'JOIN_GAME',
    SelectCardsToPass = 'SELECT_CARDS_TO_PASS',
    PlayCard = 'PLAY_CARD',
    // Add others like LeaveGame, RequestState, etc.
}

/** Types of messages sent from Server to Client */
export enum ServerToClientMessageType {
    GameJoined = 'GAME_JOINED', // Confirmation with player ID and initial state
    GameStateUpdate = 'GAME_STATE_UPDATE', // General update for all players
    YourTurn = 'YOUR_TURN', // Specific notification to the current player
    CardsPassed = 'CARDS_PASSED', // Notify player which cards they received
    TrickWon = 'TRICK_WON',
    RoundScored = 'ROUND_SCORED',
    GameOver = 'GAME_OVER',
    Error = 'ERROR', // Send error messages to specific clients
}

/** Base structure for WebSocket messages */
export interface WebSocketMessage<T = any> {
    type: ClientToServerMessageType | ServerToClientMessageType;
    payload: T;
}