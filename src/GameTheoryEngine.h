#ifndef GAME_THEORY_ENGINE_H
#define GAME_THEORY_ENGINE_H

#include <string>
#include <vector>

enum class NodeAction {
    Transmit,
    Relay,
    Sleep,
    Idle
};

enum class NodeStrategy {
    Cooperative,
    Selfish
};

struct SensorNode {
    int id;
    double energy;
    double reputation;
    int relayRequests;
    int successfulRelays;
    int selfishDecisions;
    NodeStrategy strategy;
};

struct ActionUtility {
    NodeAction action;
    double value;
};

struct DecisionContext {
    double deliveryReward;
    double relayEnergyCost;
    double transmitEnergyCost;
    double delayPenalty;
    double sleepRecovery;
    bool packetNeedsRelay;
    bool nodeHasOwnData;
};

class GameTheoryEngine {
public:
    NodeAction chooseBestAction(const SensorNode& node, const DecisionContext& context) const;

    std::vector<ActionUtility> calculateUtilities(
        const SensorNode& node,
        const DecisionContext& context
    ) const;

    void applyActionResult(SensorNode& node, NodeAction action, bool packetDelivered) const;

    bool isSelfishNode(const SensorNode& node) const;

    std::string actionToString(NodeAction action) const;
    std::string strategyToString(NodeStrategy strategy) const;

private:
    double calculateTransmitUtility(const SensorNode& node, const DecisionContext& context) const;
    double calculateRelayUtility(const SensorNode& node, const DecisionContext& context) const;
    double calculateSleepUtility(const SensorNode& node, const DecisionContext& context) const;
    double calculateIdleUtility(const SensorNode& node, const DecisionContext& context) const;
    double strategyWeight(NodeStrategy strategy) const;
};

#endif