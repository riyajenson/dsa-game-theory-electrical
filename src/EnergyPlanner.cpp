#include "EnergyPlanner.h"

#include <algorithm>
#include <limits>
#include <map>
#include <tuple>
#include <utility>

namespace {
int clampRounds(int rounds) {
    return std::max(0, std::min(20, rounds));
}

SensorNode normalizeNode(const SensorNode& source) {
    SensorNode node = source;
    node.energy = std::max(0.0, std::min(100.0, node.energy));
    return node;
}

double utilityFor(
    const std::vector<ActionUtility>& utilities,
    NodeAction action
) {
    for (const ActionUtility& candidate : utilities) {
        if (candidate.action == action) {
            return candidate.value;
        }
    }
    return -1000.0;
}

bool deliveredBy(NodeAction action) {
    return action == NodeAction::Transmit || action == NodeAction::Relay;
}

struct PlanState {
    std::vector<NodeAction> actions;
    double utility;
    SensorNode node;
};

typedef std::tuple<int, int, int, int, int, int> MemoKey;

PlanState solve(
    const GameTheoryEngine& engine,
    const SensorNode& node,
    const DecisionContext& context,
    int round,
    int rounds,
    std::map<MemoKey, PlanState>& memo
) {
    if (round >= rounds) {
        return {{}, 0.0, node};
    }

    MemoKey key(
        round,
        static_cast<int>(node.energy * 10.0 + 0.5),
        static_cast<int>(node.reputation * 100.0 + 0.5),
        node.relayRequests,
        node.successfulRelays,
        node.selfishDecisions
    );
    std::map<MemoKey, PlanState>::const_iterator cached = memo.find(key);
    if (cached != memo.end()) {
        return cached->second;
    }

    const std::vector<ActionUtility> utilities =
        engine.calculateUtilities(node, context);
    const NodeAction actions[] = {
        NodeAction::Transmit,
        NodeAction::Relay,
        NodeAction::Sleep,
        NodeAction::Idle
    };

    PlanState best = {{}, -std::numeric_limits<double>::infinity(), node};
    for (NodeAction action : actions) {
        const double immediate = utilityFor(utilities, action);
        if (immediate <= -999.0) {
            continue;
        }

        SensorNode nextNode = node;
        engine.applyActionResult(nextNode, action, deliveredBy(action));
        PlanState future = solve(
            engine,
            nextNode,
            context,
            round + 1,
            rounds,
            memo
        );
        const double candidateUtility = immediate + future.utility;
        if (candidateUtility > best.utility) {
            best = future;
            best.utility = candidateUtility;
            best.actions.insert(best.actions.begin(), action);
        }
    }

    memo[key] = best;
    return best;
}
}

EnergyPlan EnergyPlanner::plan(
    const SensorNode& source,
    const DecisionContext& context,
    int requestedRounds
) const {
    const int rounds = clampRounds(requestedRounds);
    const SensorNode node = normalizeNode(source);
    std::map<MemoKey, PlanState> memo;
    PlanState result = solve(
        GameTheoryEngine(),
        node,
        context,
        0,
        rounds,
        memo
    );
    return {result.actions, result.utility, result.node.energy};
}

EnergyPlan EnergyPlanner::greedy(
    const SensorNode& source,
    const DecisionContext& context,
    int requestedRounds
) const {
    const int rounds = clampRounds(requestedRounds);
    SensorNode node = normalizeNode(source);
    GameTheoryEngine engine;
    EnergyPlan result = {{}, 0.0, node.energy};

    for (int round = 0; round < rounds; ++round) {
        const std::vector<ActionUtility> utilities =
            engine.calculateUtilities(node, context);
        NodeAction action = engine.chooseBestAction(node, context);
        result.actions.push_back(action);
        result.totalUtility += utilityFor(utilities, action);
        engine.applyActionResult(node, action, deliveredBy(action));
    }

    result.remainingEnergy = node.energy;
    return result;
}
