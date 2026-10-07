#ifndef GAME_SESSION_H
#define GAME_SESSION_H

#include "GameTheoryEngine.h"
#include "NetworkGraph.h"

#include <string>
#include <vector>

struct GameLink { int source; int target; double weight; bool interference; };
struct GameTurn {
    int round;
    NodeAction playerAction;
    bool delivered;
    std::string message;
    std::vector<int> packetRoute;
    std::vector<NodeAction> aiActions;
    double energyDelta;
    double reputationDelta;
};
struct GamePreview {
    NodeAction action;
    bool legal;
    std::string reason;
    bool delivered;
    double energyDelta;
    double reputationDelta;
    std::vector<int> packetRoute;
};
struct GameState {
    int seed;
    int round;
    std::string status;
    std::vector<SensorNode> nodes;
    std::vector<GameLink> links;
    RouteResult shortest;
    RouteResult energyAware;
    int attempted;
    int delivered;
    int selfishDecisions;
    int score;
    std::vector<GameTurn> history;
    std::vector<GamePreview> previews;
};

GameState runGame(int seed, const std::vector<NodeAction>& actions);
std::string gameToJson(const GameState& state);
NodeAction parseGameAction(const std::string& text);

#endif
