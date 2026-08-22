#include "GameTheoryEngine.h"

#include <iomanip>
#include <iostream>
#include <vector>

using std::cout;
using std::fixed;
using std::left;
using std::setprecision;
using std::setw;
using std::vector;

void printUtilities(
    const GameTheoryEngine& engine,
    const SensorNode& node,
    const DecisionContext& context
) {
    vector<ActionUtility> utilities = engine.calculateUtilities(node, context);

    cout << "Node " << node.id << " (" << engine.strategyToString(node.strategy) << ")\n";
    cout << "Energy: " << fixed << setprecision(2) << node.energy
         << " | Reputation: " << node.reputation << "\n";

    for (const ActionUtility& utility : utilities) {
        cout << "  " << left << setw(9) << engine.actionToString(utility.action)
             << " utility = " << fixed << setprecision(2) << utility.value << "\n";
    }

    NodeAction selectedAction = engine.chooseBestAction(node, context);
    cout << "  Selected action: " << engine.actionToString(selectedAction) << "\n\n";
}

void runRepeatedGameDemo() {
    GameTheoryEngine engine;

    vector<SensorNode> nodes = {
        {1, 86.0, 0.90, 0, 0, 0, NodeStrategy::Cooperative},
        {2, 91.0, 0.82, 0, 0, 0, NodeStrategy::Selfish},
        {3, 34.0, 0.70, 0, 0, 0, NodeStrategy::Cooperative},
        {4, 76.0, 0.55, 0, 0, 0, NodeStrategy::Selfish}
    };

    DecisionContext relayContext = {
        8.0,
        3.0,
        4.0,
        1.2,
        2.5,
        true,
        false
    };

    cout << "GAME THEORY DECISION DEMO\n";
    cout << "Each node calculates utility for TRANSMIT, RELAY, SLEEP, and IDLE.\n\n";

    for (const SensorNode& node : nodes) {
        printUtilities(engine, node, relayContext);
    }

    cout << "REPEATED GAME SIMULATION\n";
    cout << "Ten relay requests are simulated for each node.\n\n";

    for (int round = 1; round <= 10; round++) {
        for (SensorNode& node : nodes) {
            NodeAction action = engine.chooseBestAction(node, relayContext);
            bool packetDelivered = action == NodeAction::Relay;
            engine.applyActionResult(node, action, packetDelivered);
        }
    }

    cout << left << setw(8) << "Node"
         << setw(14) << "Strategy"
         << setw(10) << "Energy"
         << setw(13) << "Reputation"
         << setw(12) << "Requests"
         << setw(10) << "Relays"
         << "Flagged\n";

    for (const SensorNode& node : nodes) {
        cout << left << setw(8) << node.id
             << setw(14) << engine.strategyToString(node.strategy)
             << setw(10) << fixed << setprecision(2) << node.energy
             << setw(13) << node.reputation
             << setw(12) << node.relayRequests
             << setw(10) << node.successfulRelays
             << (engine.isSelfishNode(node) ? "YES" : "NO")
             << "\n";
    }
}

int main() {
    runRepeatedGameDemo();
    return 0;
}