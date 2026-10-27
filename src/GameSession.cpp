#include "GameSession.h"

#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace {
const int maxRounds = 8;
const int targetPackets = 6;
const GameLink baseLinks[] = {
    {1, 2, 1.0, false}, {2, 5, 1.0, false}, {1, 3, 2.0, false},
    {3, 4, 1.3, false}, {4, 5, 1.1, false}, {2, 4, 2.4, false}
};

std::vector<SensorNode> initialNodes(int seed, const std::string& profile) {
    const NodeStrategy second = profile == "cooperative"
        ? NodeStrategy::Cooperative : NodeStrategy::Selfish;
    const NodeStrategy third = profile == "selfish" ||
        (profile == "mixed" && seed % 5 == 0)
        ? NodeStrategy::Selfish : NodeStrategy::Cooperative;
    const NodeStrategy later = profile == "selfish"
        ? NodeStrategy::Selfish : NodeStrategy::Cooperative;
    return {
        {1, 28.0, 0.55, 0, 0, 0, NodeStrategy::Cooperative},
        {2, 44.0, 0.50, 0, 0, 0, second},
        {3, 88.0, 0.86, 0, 0, 0, third},
        {4, 72.0, 0.76, 0, 0, 0, later},
        {5, 64.0, 0.81, 0, 0, 0, later}
    };
}

std::vector<GameLink> linksFor(int seed, int round) {
    std::vector<GameLink> links(baseLinks, baseLinks + 6);
    const int disturbed = (seed + round) % 6;
    links[disturbed].weight += 2.0;
    links[disturbed].interference = true;
    return links;
}

NetworkGraph graphFor(const std::vector<SensorNode>& nodes,
                      const std::vector<GameLink>& links, bool riskAware) {
    NetworkGraph graph;
    for (const SensorNode& node : nodes) {
        if (node.energy > 0.0) graph.addNode(node);
    }
    for (const GameLink& link : links) {
        bool unreliable = false;
        for (const SensorNode& node : nodes) {
            if (node.id != 1 && node.id != 5 &&
                (node.id == link.source || node.id == link.target) &&
                node.strategy == NodeStrategy::Selfish) unreliable = true;
        }
        graph.addUndirectedEdge(link.source, link.target,
            link.weight + (riskAware && unreliable ? 6.0 : 0.0));
    }
    return graph;
}

std::string actionName(NodeAction action) {
    return GameTheoryEngine().actionToString(action);
}

std::string escape(const std::string& value) {
    std::ostringstream out;
    for (char character : value) {
        if (character == '"') out << "\\\"";
        else if (character == '\\') out << "\\\\";
        else if (character == '\n') out << "\\n";
        else out << character;
    }
    return out.str();
}

void pathJson(std::ostringstream& out, const std::vector<int>& path) {
    out << "[";
    for (std::size_t i = 0; i < path.size(); ++i) {
        if (i) out << ",";
        out << path[i];
    }
    out << "]";
}

std::string illegalReason(const SensorNode& player, int round, NodeAction action) {
    if (action == NodeAction::Relay && (round + 1) % 2 != 0)
        return "Neighbor relay requests arrive on even rounds.";
    if (action == NodeAction::Transmit && player.energy < 4.0)
        return "Need 4 energy to transmit.";
    if (action == NodeAction::Relay && player.energy < 3.0)
        return "Need 3 energy to relay.";
    return "";
}

void updateRoutes(GameState& state) {
    state.links = linksFor(state.seed, state.round + 1);
    const NetworkGraph physical = graphFor(state.nodes, state.links, false);
    const NetworkGraph riskAware = graphFor(state.nodes, state.links, true);
    state.shortest = physical.findShortestRoute(1, 5);
    state.energyAware = riskAware.findEnergyAwareRoute(1, 5);
}

void applyTurn(GameState& state, NodeAction action) {
    if (state.status != "playing")
        throw std::invalid_argument("game has already ended");
    const std::string reason = illegalReason(state.nodes[0], state.round, action);
    if (!reason.empty()) throw std::invalid_argument(reason);

    GameTheoryEngine engine;
    const double beforeEnergy = state.nodes[0].energy;
    const double beforeReputation = state.nodes[0].reputation;
    const int beforeScore = state.score;
    const std::vector<int> beforeRoute = state.energyAware.path;
    const bool surge = (state.seed + state.round + 1) % 4 < 2;
    const std::vector<int> packetRoute = action == NodeAction::Transmit
        ? state.energyAware.path : (action == NodeAction::Relay ? std::vector<int>{2, 1, 3} : std::vector<int>());
    std::vector<NodeAction> aiActions;
    bool delivered = action == NodeAction::Relay;
    if (action == NodeAction::Transmit) delivered = state.energyAware.reachable;
    int blockedBy = 0;
    for (std::size_t i = 1; i < state.nodes.size(); ++i) {
        SensorNode& node = state.nodes[i];
        bool needed = false;
        if (action == NodeAction::Transmit) {
            for (std::size_t step = 1; step + 1 < packetRoute.size(); ++step) {
                if (packetRoute[step] == node.id) needed = true;
            }
        }
        DecisionContext context = {needed && surge ? 30.0 : 8.0,
            3.0, 4.0, 1.2, 2.5, needed, false};
        const NodeAction aiAction = engine.chooseBestAction(node, context);
        aiActions.push_back(aiAction);
        if (needed && aiAction != NodeAction::Relay) {
            delivered = false;
            if (!blockedBy) blockedBy = node.id;
        }
    }
    engine.applyActionResult(state.nodes[0], action, delivered);
    for (std::size_t i = 1; i < state.nodes.size(); ++i) {
        const bool relayed = action == NodeAction::Transmit && delivered &&
            aiActions[i - 1] == NodeAction::Relay;
        engine.applyActionResult(state.nodes[i], aiActions[i - 1], relayed);
    }
    state.round++;
    state.attempted++;
    if (delivered) state.delivered++;
    if (delivered && action == NodeAction::Transmit) state.ownDelivered++;
    state.selfishDecisions = state.nodes[0].selfishDecisions;
    const double ratio = static_cast<double>(state.delivered) / state.attempted;
    state.score = static_cast<int>(std::lround(100.0 * state.delivered +
        20.0 * ratio + state.nodes[0].energy +
        50.0 * state.nodes[0].reputation - 10.0 * state.selfishDecisions +
        35.0 * state.ownDelivered));
    std::string message;
    if (action == NodeAction::Relay) message = "You forwarded a neighbor packet to the terminal.";
    else if (action == NodeAction::Transmit) {
        if (delivered) message = "Your packet reached terminal 05.";
        else if (blockedBy) message = "Relay node " + std::to_string(blockedBy) +
            " refused your packet. Route failed.";
        else message = "No usable route to terminal 05. Packet lost.";
    }
    else if (action == NodeAction::Sleep) message = "Battery recovered. A packet expired while you slept.";
    else message = "You held position. A packet expired.";
    state.history.push_back({state.round, action, delivered, message, packetRoute,
        aiActions, state.nodes[0].energy - beforeEnergy,
        state.nodes[0].reputation - beforeReputation,
        state.score - beforeScore, blockedBy, surge, false});
    if (state.nodes[0].energy <= 0.0) state.status = "lost";
    else if (state.round == maxRounds)
        state.status = state.delivered >= targetPackets &&
            state.nodes[0].reputation >= 0.60 ? "won" : "lost";
    updateRoutes(state);
    state.history.back().routeChanged = beforeRoute != state.energyAware.path;
}

GameState evaluate(int seed, const std::string& profile,
                   const std::vector<NodeAction>& actions) {
    if (seed < 0 || seed > 999999) throw std::invalid_argument("seed must be 0..999999");
    if (profile != "cooperative" && profile != "mixed" && profile != "selfish")
        throw std::invalid_argument("invalid AI profile");
    if (actions.size() > static_cast<std::size_t>(maxRounds))
        throw std::invalid_argument("too many actions");
    GameState state;
    state.seed = seed;
    state.profile = profile;
    state.round = 0;
    state.status = "playing";
    state.nodes = initialNodes(seed, profile);
    state.attempted = 0;
    state.delivered = 0;
    state.ownDelivered = 0;
    state.selfishDecisions = 0;
    state.score = 0;
    updateRoutes(state);
    for (NodeAction action : actions) applyTurn(state, action);
    return state;
}
}

GameState runGame(int seed, const std::vector<NodeAction>& actions) {
    return runGame(seed, "mixed", actions);
}

GameState runGame(int seed, const std::string& profile,
                  const std::vector<NodeAction>& actions) {
    GameState state = evaluate(seed, profile, actions);
    if (state.status == "playing") {
        const NodeAction choices[] = {NodeAction::Transmit, NodeAction::Relay,
            NodeAction::Sleep, NodeAction::Idle};
        for (NodeAction action : choices) {
            const std::string reason = illegalReason(state.nodes[0], state.round, action);
            if (!reason.empty()) {
                state.previews.push_back({action, false, reason, "", false, 0, 0, {}});
                continue;
            }
            GameState next = state;
            applyTurn(next, action);
            const GameTurn& turn = next.history.back();
            state.previews.push_back({action, true, "", turn.message, turn.delivered,
                turn.energyDelta, turn.reputationDelta, turn.packetRoute});
        }
    }
    return state;
}

NodeAction parseGameAction(const std::string& text) {
    if (text == "TRANSMIT") return NodeAction::Transmit;
    if (text == "RELAY") return NodeAction::Relay;
    if (text == "SLEEP") return NodeAction::Sleep;
    if (text == "IDLE") return NodeAction::Idle;
    throw std::invalid_argument("invalid game action");
}

std::string gameToJson(const GameState& state) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2);
    out << "{\"schemaVersion\":2,\"seed\":" << state.seed
        << ",\"profile\":\"" << state.profile << "\""
        << ",\"round\":" << state.round << ",\"maxRounds\":8,\"status\":\""
        << state.status << "\",\"objective\":{\"deliver\":6,\"minimumReputation\":0.60}"
        << ",\"currentPacket\":";
    if (state.status == "playing") {
        out << "{\"source\":1,\"destination\":5,\"relayRequest\":"
            << ((state.round + 1) % 2 == 0 ? "true" : "false")
            << ",\"relaySource\":2,\"relayDestination\":3,\"surge\":"
            << ((state.seed + state.round + 1) % 4 < 2 ? "true" : "false") << "}";
    } else out << "null";
    out
        << ",\"attemptedPackets\":" << state.attempted
        << ",\"deliveredPackets\":" << state.delivered
        << ",\"ownDeliveredPackets\":" << state.ownDelivered
        << ",\"deliveryRatio\":" << (state.attempted ? 100.0 * state.delivered / state.attempted : 0.0)
        << ",\"selfishDecisions\":" << state.selfishDecisions
        << ",\"score\":" << state.score << ",\"nodes\":[";
    for (std::size_t i = 0; i < state.nodes.size(); ++i) {
        const SensorNode& node = state.nodes[i];
        if (i) out << ",";
        out << "{\"id\":" << node.id << ",\"energy\":" << node.energy
            << ",\"reputation\":" << node.reputation << ",\"strategy\":\""
            << (node.strategy == NodeStrategy::Cooperative ? "cooperative" : "selfish")
            << "\",\"suspicious\":"
            << (GameTheoryEngine().isSelfishNode(node) ? "true" : "false") << "}";
    }
    out << "],\"links\":[";
    for (std::size_t i = 0; i < state.links.size(); ++i) {
        const GameLink& link = state.links[i];
        if (i) out << ",";
        out << "{\"source\":" << link.source << ",\"target\":" << link.target
            << ",\"weight\":" << link.weight << ",\"interference\":"
            << (link.interference ? "true" : "false") << "}";
    }
    out << "],\"routes\":{\"shortest\":";
    pathJson(out, state.shortest.path);
    out << ",\"energyAware\":";
    pathJson(out, state.energyAware.path);
    out << "},\"history\":[";
    for (std::size_t i = 0; i < state.history.size(); ++i) {
        const GameTurn& turn = state.history[i];
        if (i) out << ",";
        out << "{\"round\":" << turn.round << ",\"action\":\"" << actionName(turn.playerAction)
            << "\",\"delivered\":" << (turn.delivered ? "true" : "false")
            << ",\"message\":\"" << escape(turn.message) << "\",\"route\":";
        pathJson(out, turn.packetRoute);
        out << ",\"energyDelta\":" << turn.energyDelta
            << ",\"reputationDelta\":" << turn.reputationDelta
            << ",\"scoreDelta\":" << turn.scoreDelta
            << ",\"blockedBy\":" << turn.blockedBy
            << ",\"surge\":" << (turn.surge ? "true" : "false")
            << ",\"routeChanged\":" << (turn.routeChanged ? "true" : "false")
            << ",\"aiActions\":[";
        for (std::size_t j = 0; j < turn.aiActions.size(); ++j) {
            if (j) out << ",";
            out << "\"" << actionName(turn.aiActions[j]) << "\"";
        }
        out << "]}";
    }
    out << "],\"previews\":[";
    for (std::size_t i = 0; i < state.previews.size(); ++i) {
        const GamePreview& preview = state.previews[i];
        if (i) out << ",";
        out << "{\"action\":\"" << actionName(preview.action)
            << "\",\"legal\":" << (preview.legal ? "true" : "false")
            << ",\"reason\":\"" << escape(preview.reason)
            << "\",\"outcome\":\"" << escape(preview.outcome)
            << "\",\"delivered\":" << (preview.delivered ? "true" : "false")
            << ",\"energyDelta\":" << preview.energyDelta
            << ",\"reputationDelta\":" << preview.reputationDelta << ",\"route\":";
        pathJson(out, preview.packetRoute);
        out << "}";
    }
    out << "]}";
    return out.str();
}
