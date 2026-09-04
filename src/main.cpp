#include "GameTheoryEngine.h"
#include "NetworkGraph.h"

#include <iomanip>
#include <iostream>
#include <vector>

using std::cout;
using std::fixed;
using std::left;
using std::setprecision;
using std::setw;
using std::vector;

void printRoute(const char* label, const RouteResult& route) {
    cout << label << "\n";

    if (!route.reachable) {
        cout << "  No route found.\n\n";
        return;
    }

    cout << "  Path: ";
    for (size_t index = 0; index < route.path.size(); index++) {
        if (index > 0) {
            cout << " -> ";
        }
        cout << route.path[index];
    }

    cout << "\n";
    cout << "  Total cost: " << fixed << setprecision(2) << route.totalCost << "\n\n";
}

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

void runRoutingDemo() {
    NetworkGraph graph;

    vector<SensorNode> nodes = {
        {1, 95.0, 0.94, 0, 0, 0, NodeStrategy::Cooperative},
        {2, 14.0, 0.38, 0, 0, 0, NodeStrategy::Selfish},
        {3, 88.0, 0.86, 0, 0, 0, NodeStrategy::Cooperative},
        {4, 72.0, 0.76, 0, 0, 0, NodeStrategy::Cooperative},
        {5, 64.0, 0.81, 0, 0, 0, NodeStrategy::Cooperative}
    };

    for (const SensorNode& node : nodes) {
        graph.addNode(node);
    }

    graph.addUndirectedEdge(1, 2, 1.0);
    graph.addUndirectedEdge(2, 5, 1.0);
    graph.addUndirectedEdge(1, 3, 2.0);
    graph.addUndirectedEdge(3, 4, 1.3);
    graph.addUndirectedEdge(4, 5, 1.1);
    graph.addUndirectedEdge(2, 4, 2.4);

    cout << "\nPHASE 2 ROUTING DEMO\n";
    cout << "Sensor nodes are vertices and communication links are weighted edges.\n";
    cout << "Energy-aware routing adds penalties for weak or low-reputation relay nodes.\n\n";

    cout << left << setw(8) << "Node"
         << setw(12) << "Energy"
         << setw(13) << "Reputation"
         << "Strategy\n";

    GameTheoryEngine engine;
    for (const SensorNode& node : nodes) {
        cout << left << setw(8) << node.id
             << setw(12) << fixed << setprecision(2) << node.energy
             << setw(13) << node.reputation
             << engine.strategyToString(node.strategy)
             << "\n";
    }

    cout << "\nCommunication links:\n";
    vector<int> ids = graph.getNodeIds();
    for (int nodeId : ids) {
        const vector<CommunicationLink>& neighbors = graph.getNeighbors(nodeId);
        for (const CommunicationLink& link : neighbors) {
            if (nodeId < link.targetNodeId) {
                cout << "  " << nodeId << " <-> " << link.targetNodeId
                     << " weight " << fixed << setprecision(2) << link.weight << "\n";
            }
        }
    }
    cout << "\n";

    RouteResult shortestRoute = graph.findShortestRoute(1, 5);
    RouteResult energyAwareRoute = graph.findEnergyAwareRoute(1, 5);

    printRoute("Shortest route by link weight:", shortestRoute);
    printRoute("Energy-aware route:", energyAwareRoute);
}

int main() {
    runRepeatedGameDemo();
    runRoutingDemo();
    return 0;
}
