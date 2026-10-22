#ifndef MULTIPLAYER_SESSION_H
#define MULTIPLAYER_SESSION_H

#include "GameSession.h"
#include <vector>
#include <string>

struct MultiplayerPlayer {
    SensorNode node;
    int ownDelivered;
    int relayed;
    int cooperativeRounds;
    int score;
    std::vector<bool> legal;
};
struct MultiplayerPacket {
    int source;
    std::vector<int> route;
    bool delivered;
    int blockedBy;
    std::string reason;
};
struct MultiplayerRound {
    int number;
    std::vector<NodeAction> actions;
    std::vector<MultiplayerPacket> packets;
    std::vector<double> energyDelta;
    std::vector<double> reputationDelta;
    std::vector<int> scoreDelta;
    bool routeChanged;
};
struct MultiplayerState {
    int seed;
    int playerCount;
    int round;
    int delivered;
    int target;
    std::string status;
    std::vector<MultiplayerPlayer> players;
    std::vector<GameLink> links;
    std::vector<std::vector<int> > routes;
    std::vector<MultiplayerRound> rounds;
};

MultiplayerState runMultiplayer(int seed, int playerCount,
    const std::vector<std::vector<NodeAction> >& rounds);
std::string multiplayerToJson(const MultiplayerState& state);

#endif
