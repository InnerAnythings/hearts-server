"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerToClientMessageType = exports.ClientToServerMessageType = exports.PassingDirection = exports.GamePhase = exports.Rank = exports.Suit = void 0;
/** Enum representing card suits */
var Suit;
(function (Suit) {
    Suit["Hearts"] = "H";
    Suit["Diamonds"] = "D";
    Suit["Clubs"] = "C";
    Suit["Spades"] = "S";
})(Suit || (exports.Suit = Suit = {}));
/** Enum representing card ranks */
var Rank;
(function (Rank) {
    Rank["Two"] = "2";
    Rank["Three"] = "3";
    Rank["Four"] = "4";
    Rank["Five"] = "5";
    Rank["Six"] = "6";
    Rank["Seven"] = "7";
    Rank["Eight"] = "8";
    Rank["Nine"] = "9";
    Rank["Ten"] = "T";
    Rank["Jack"] = "J";
    Rank["Queen"] = "Q";
    Rank["King"] = "K";
    Rank["Ace"] = "A";
})(Rank || (exports.Rank = Rank = {}));
/** Enum for different phases of the game */
var GamePhase;
(function (GamePhase) {
    GamePhase["WaitingForPlayers"] = "WAITING_FOR_PLAYERS";
    GamePhase["Passing"] = "PASSING";
    GamePhase["PassingComplete"] = "PASSING_COMPLETE";
    GamePhase["PlayingTrick"] = "PLAYING_TRICK";
    GamePhase["TrickComplete"] = "TRICK_COMPLETE";
    GamePhase["RoundScoring"] = "ROUND_SCORING";
    GamePhase["RoundOver"] = "ROUND_OVER";
    GamePhase["GameOver"] = "GAME_OVER";
})(GamePhase || (exports.GamePhase = GamePhase = {}));
/** Enum for card passing directions */
var PassingDirection;
(function (PassingDirection) {
    PassingDirection["Left"] = "LEFT";
    PassingDirection["Right"] = "RIGHT";
    PassingDirection["Across"] = "ACROSS";
    PassingDirection["Hold"] = "HOLD";
})(PassingDirection || (exports.PassingDirection = PassingDirection = {}));
// --- WebSocket Message Types ---
/** Types of messages sent from Client to Server */
var ClientToServerMessageType;
(function (ClientToServerMessageType) {
    ClientToServerMessageType["JoinGame"] = "JOIN_GAME";
    ClientToServerMessageType["SelectCardsToPass"] = "SELECT_CARDS_TO_PASS";
    ClientToServerMessageType["PlayCard"] = "PLAY_CARD";
    // Add others like LeaveGame, RequestState, etc.
})(ClientToServerMessageType || (exports.ClientToServerMessageType = ClientToServerMessageType = {}));
/** Types of messages sent from Server to Client */
var ServerToClientMessageType;
(function (ServerToClientMessageType) {
    ServerToClientMessageType["GameJoined"] = "GAME_JOINED";
    ServerToClientMessageType["GameStateUpdate"] = "GAME_STATE_UPDATE";
    ServerToClientMessageType["YourTurn"] = "YOUR_TURN";
    ServerToClientMessageType["CardsPassed"] = "CARDS_PASSED";
    ServerToClientMessageType["TrickWon"] = "TRICK_WON";
    ServerToClientMessageType["RoundScored"] = "ROUND_SCORED";
    ServerToClientMessageType["GameOver"] = "GAME_OVER";
    ServerToClientMessageType["Error"] = "ERROR";
})(ServerToClientMessageType || (exports.ServerToClientMessageType = ServerToClientMessageType = {}));
