#include "SimulationRunner.h"

#include <algorithm>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace {
std::vector<SensorNode> initialNodes() {
    return {
        {1, 95.0, 0.94, 0, 0, 0, NodeStrategy::Cooperative},
        {2, 44.0, 0.50, 0, 0, 0, NodeStrategy::Selfish},
        {3, 88.0, 0.86, 0, 0, 0, NodeStrategy::Cooperative},
        {4, 72.0, 0.76, 0, 0, 0, NodeStrategy::Cooperative},
        {5, 64.0, 0.81, 0, 0, 0, NodeStrategy::Cooperative}
    };
}

std::vector<SimulationLink> topologyLinks() {
    return {
        {1, 2, 1.0},
        {2, 5, 1.0},
        {1, 3, 2.0},
        {3, 4, 1.3},
        {4, 5, 1.1},
        {2, 4, 2.4}
    };
}

void applyStrategy(std::vector<SensorNode>& nodes, const std::string& strategy) {
    for (std::size_t index = 0; index < nodes.size(); ++index) {
        if (strategy == "cooperative") {
            nodes[index].strategy = NodeStrategy::Cooperative;
        } else if (strategy == "selfish") {
            nodes[index].strategy = NodeStrategy::Selfish;
        } else {
            nodes[index].strategy = index == 1
                ? NodeStrategy::Selfish
                : NodeStrategy::Cooperative;
        }
    }
}

DecisionContext contextFor(int round, int nodeId) {
    return {
        8.0,
        3.0,
        4.0,
        1.2,
        2.5,
        true,
        nodeId == 1 || (round + nodeId) % 4 == 0
    };
}

bool actionDelivers(NodeAction action) {
    return action == NodeAction::Relay || action == NodeAction::Transmit;
}

double averageEnergy(const std::vector<SensorNode>& nodes) {
    if (nodes.empty()) {
        return 0.0;
    }
    double total = 0.0;
    for (const SensorNode& node : nodes) {
        total += node.energy;
    }
    return total / nodes.size();
}

NetworkGraph createGraph(
    const std::vector<SensorNode>& nodes,
    const std::vector<SimulationLink>& links
) {
    NetworkGraph graph;
    for (const SensorNode& node : nodes) {
        graph.addNode(node);
    }
    for (const SimulationLink& link : links) {
        graph.addUndirectedEdge(link.source, link.target, link.weight);
    }
    return graph;
}

std::string actionName(NodeAction action) {
    return GameTheoryEngine().actionToString(action);
}

std::string strategyName(NodeStrategy strategy) {
    return GameTheoryEngine().strategyToString(strategy);
}

std::string jsonEscape(const std::string& input) {
    std::ostringstream escaped;
    for (char character : input) {
        switch (character) {
            case '"': escaped << "\\\""; break;
            case '\\': escaped << "\\\\"; break;
            case '\n': escaped << "\\n"; break;
            case '\r': escaped << "\\r"; break;
            case '\t': escaped << "\\t"; break;
            default: escaped << character;
        }
    }
    return escaped.str();
}

void writeIntArray(std::ostringstream& output, const std::vector<int>& values) {
    output << "[";
    for (std::size_t index = 0; index < values.size(); ++index) {
        if (index) output << ",";
        output << values[index];
    }
    output << "]";
}

void writeActionArray(
    std::ostringstream& output,
    const std::vector<NodeAction>& actions
) {
    output << "[";
    for (std::size_t index = 0; index < actions.size(); ++index) {
        if (index) output << ",";
        output << "\"" << actionName(actions[index]) << "\"";
    }
    output << "]";
}

void writePlan(std::ostringstream& output, const EnergyPlan& plan) {
    output << "{\"actions\":";
    writeActionArray(output, plan.actions);
    output << ",\"totalUtility\":" << plan.totalUtility
           << ",\"remainingEnergy\":" << plan.remainingEnergy << "}";
}
}

SimulationResult runSimulation(int rounds, const std::string& strategy) {
    if (rounds < 1 || rounds > 20) {
        throw std::invalid_argument("rounds must be between 1 and 20");
    }
    if (strategy != "cooperative" &&
        strategy != "selfish" &&
        strategy != "mixed") {
        throw std::invalid_argument(
            "strategy must be cooperative, selfish, or mixed"
        );
    }

    std::vector<SensorNode> nodes = initialNodes();
    applyStrategy(nodes, strategy);
    const std::vector<SimulationLink> links = topologyLinks();
    SimulationMetrics metricCollector;
    std::vector<SimulationRound> history;
    GameTheoryEngine engine;

    for (int round = 1; round <= rounds; ++round) {
        int delivered = 0;
        for (SensorNode& node : nodes) {
            const DecisionContext context = contextFor(round, node.id);
            const NodeAction action = engine.chooseBestAction(node, context);
            const bool packetDelivered = actionDelivers(action);
            if (packetDelivered) {
                ++delivered;
            }
            engine.applyActionResult(node, action, packetDelivered);
        }
        metricCollector.recordRound({
            round,
            static_cast<int>(nodes.size()),
            delivered,
            nodes
        });
        history.push_back({
            round,
            static_cast<int>(nodes.size()),
            delivered,
            averageEnergy(nodes)
        });
    }

    const NetworkGraph graph = createGraph(nodes, links);
    const RouteResult shortest = graph.findShortestRoute(1, 5);
    const RouteResult energyAware = graph.findEnergyAwareRoute(1, 5);

    SensorNode plannerNode = nodes[2];
    const DecisionContext plannerContext = contextFor(1, plannerNode.id);
    EnergyPlanner planner;
    const EnergyPlan planned = planner.plan(plannerNode, plannerContext, rounds);
    const EnergyPlan greedy = planner.greedy(plannerNode, plannerContext, rounds);
    const std::string recommendation =
        planned.totalUtility > greedy.totalUtility + 0.0001
            ? "DP plan"
            : "Greedy plan";

    return {
        1,
        rounds,
        strategy,
        nodes,
        links,
        {
            {"Shortest route", shortest.reachable, shortest.totalCost, shortest.path},
            {"Energy-aware route", energyAware.reachable, energyAware.totalCost, energyAware.path}
        },
        history,
        metricCollector.getResult(),
        {planned, greedy, recommendation}
    };
}

std::string simulationToJson(const SimulationResult& result) {
    std::ostringstream output;
    output << std::fixed << std::setprecision(2);
    output << "{\"schemaVersion\":" << result.schemaVersion
           << ",\"updatedAt\":\"Live C++ simulation\""
           << ",\"input\":{\"rounds\":" << result.rounds
           << ",\"strategy\":\"" << jsonEscape(result.strategy) << "\"}";

    output << ",\"metrics\":{"
           << "\"attemptedPackets\":" << result.metrics.totalAttemptedPackets
           << ",\"deliveredPackets\":" << result.metrics.totalDeliveredPackets
           << ",\"deliveryRatio\":" << result.metrics.packetDeliveryRatio * 100.0
           << ",\"averageResidualEnergy\":" << result.metrics.averageResidualEnergy
           << ",\"networkLifetimeRound\":" << result.metrics.networkLifetimeRound
           << ",\"selfishEventCount\":" << result.metrics.selfishEventCount
           << "}";

    output << ",\"nodes\":[";
    GameTheoryEngine engine;
    for (std::size_t index = 0; index < result.nodes.size(); ++index) {
        const SensorNode& node = result.nodes[index];
        if (index) output << ",";
        output << "{\"id\":" << node.id
               << ",\"strategy\":\"" << strategyName(node.strategy) << "\""
               << ",\"energy\":" << node.energy
               << ",\"reputation\":" << node.reputation
               << ",\"suspicious\":"
               << (engine.isSelfishNode(node) ? "true" : "false")
               << "}";
    }
    output << "]";

    output << ",\"links\":[";
    for (std::size_t index = 0; index < result.links.size(); ++index) {
        const SimulationLink& link = result.links[index];
        if (index) output << ",";
        output << "{\"source\":" << link.source
               << ",\"target\":" << link.target
               << ",\"weight\":" << link.weight << "}";
    }
    output << "]";

    output << ",\"routes\":[";
    for (std::size_t index = 0; index < result.routes.size(); ++index) {
        const SimulationRoute& route = result.routes[index];
        if (index) output << ",";
        output << "{\"label\":\"" << jsonEscape(route.label) << "\""
               << ",\"reachable\":" << (route.reachable ? "true" : "false")
               << ",\"cost\":" << route.cost << ",\"path\":";
        writeIntArray(output, route.path);
        output << "}";
    }
    output << "]";

    output << ",\"history\":[";
    for (std::size_t index = 0; index < result.history.size(); ++index) {
        const SimulationRound& round = result.history[index];
        if (index) output << ",";
        output << "{\"round\":" << round.round
               << ",\"attemptedPackets\":" << round.attemptedPackets
               << ",\"deliveredPackets\":" << round.deliveredPackets
               << ",\"averageEnergy\":" << round.averageEnergy << "}";
    }
    output << "]";

    output << ",\"plannerComparison\":{\"planned\":";
    writePlan(output, result.planner.planned);
    output << ",\"greedy\":";
    writePlan(output, result.planner.greedy);
    output << ",\"recommendation\":\""
           << jsonEscape(result.planner.recommendation) << "\"}}";
    return output.str();
}
