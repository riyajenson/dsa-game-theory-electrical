#include "GameTheoryEngine.h"

#include <algorithm>

using std::string;
using std::vector;

namespace {
double clampValue(double value, double lower, double upper) {
    return std::max(lower, std::min(value, upper));
}
}

NodeAction GameTheoryEngine::chooseBestAction(
    const SensorNode& node,
    const DecisionContext& context
) const {
    vector<ActionUtility> utilities = calculateUtilities(node, context);

    auto best = std::max_element(
        utilities.begin(),
        utilities.end(),
        [](const ActionUtility& left, const ActionUtility& right) {
            return left.value < right.value;
        }
    );

    return best->action;
}

vector<ActionUtility> GameTheoryEngine::calculateUtilities(
    const SensorNode& node,
    const DecisionContext& context
) const {
    return {
        {NodeAction::Transmit, calculateTransmitUtility(node, context)},
        {NodeAction::Relay, calculateRelayUtility(node, context)},
        {NodeAction::Sleep, calculateSleepUtility(node, context)},
        {NodeAction::Idle, calculateIdleUtility(node, context)}
    };
}

void GameTheoryEngine::applyActionResult(
    SensorNode& node,
    NodeAction action,
    bool packetDelivered
) const {
    if (action == NodeAction::Transmit) {
        node.energy -= 4.0;
        node.reputation += packetDelivered ? 0.02 : -0.03;
    } else if (action == NodeAction::Relay) {
        node.relayRequests++;
        node.energy -= 3.0;

        if (packetDelivered) {
            node.successfulRelays++;
            node.reputation += 0.06;
        } else {
            node.reputation -= 0.08;
        }
    } else if (action == NodeAction::Sleep) {
        node.relayRequests++;
        node.energy += 1.5;
        node.selfishDecisions++;
        node.reputation -= 0.10;
    } else {
        node.energy -= 0.3;
    }

    node.energy = clampValue(node.energy, 0.0, 100.0);
    node.reputation = clampValue(node.reputation, 0.0, 1.0);
}

bool GameTheoryEngine::isSelfishNode(const SensorNode& node) const {
    if (node.relayRequests < 3) {
        return false;
    }

    double cooperationRatio =
        static_cast<double>(node.successfulRelays) / node.relayRequests;

    return cooperationRatio < 0.45 && node.energy > 30.0 && node.reputation < 0.55;
}

string GameTheoryEngine::actionToString(NodeAction action) const {
    switch (action) {
        case NodeAction::Transmit:
            return "TRANSMIT";
        case NodeAction::Relay:
            return "RELAY";
        case NodeAction::Sleep:
            return "SLEEP";
        case NodeAction::Idle:
            return "IDLE";
    }

    return "UNKNOWN";
}

string GameTheoryEngine::strategyToString(NodeStrategy strategy) const {
    return strategy == NodeStrategy::Cooperative ? "Cooperative" : "Selfish";
}

double GameTheoryEngine::calculateTransmitUtility(
    const SensorNode& node,
    const DecisionContext& context
) const {
    if (!context.nodeHasOwnData || node.energy < context.transmitEnergyCost) {
        return -1000.0;
    }

    double networkBenefit = context.deliveryReward * strategyWeight(node.strategy);
    double energyPenalty = context.transmitEnergyCost;
    double trustBenefit = node.reputation * 1.5;

    return networkBenefit + trustBenefit - energyPenalty - context.delayPenalty;
}

double GameTheoryEngine::calculateRelayUtility(
    const SensorNode& node,
    const DecisionContext& context
) const {
    if (!context.packetNeedsRelay || node.energy < context.relayEnergyCost) {
        return -1000.0;
    }

    double cooperationReward = context.deliveryReward * strategyWeight(node.strategy);
    double reputationGain = 3.0 * node.reputation;
    double energyPenalty = context.relayEnergyCost;
    double selfishResistance = node.strategy == NodeStrategy::Selfish ? 3.2 : 0.4;

    return cooperationReward + reputationGain - energyPenalty - selfishResistance;
}

double GameTheoryEngine::calculateSleepUtility(
    const SensorNode& node,
    const DecisionContext& context
) const {
    double energySavingBenefit = context.sleepRecovery;
    double lowEnergyUrgency = std::max(0.0, 40.0 - node.energy) * 0.12;
    double networkPenalty = context.packetNeedsRelay ? 4.0 * node.reputation : 0.5;

    if (node.strategy == NodeStrategy::Selfish) {
        energySavingBenefit *= 2.0;
        networkPenalty *= 0.45;
    }

    return energySavingBenefit + lowEnergyUrgency - networkPenalty;
}

double GameTheoryEngine::calculateIdleUtility(
    const SensorNode& node,
    const DecisionContext& context
) const {
    double stabilityBenefit = 0.8;
    double missedOpportunityPenalty = 0.0;

    if (context.packetNeedsRelay || context.nodeHasOwnData) {
        missedOpportunityPenalty = node.reputation * 2.0;
    }

    return stabilityBenefit - missedOpportunityPenalty;
}

double GameTheoryEngine::strategyWeight(NodeStrategy strategy) const {
    return strategy == NodeStrategy::Cooperative ? 1.0 : 0.45;
}