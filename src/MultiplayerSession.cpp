#include "MultiplayerSession.h"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace {
const int MAX_ROUNDS = 8;
const GameLink LINKS[] = {{1,2,1.0,false},{2,5,1.0,false},
    {1,3,1.7,false},{3,2,1.9,false},{3,4,1.3,false},
    {4,5,1.1,false},{2,4,2.4,false}};

std::vector<GameLink> linksFor(int seed, int round, int count) {
    std::vector<GameLink> result;
    for (const GameLink& link : LINKS) {
        if (link.source > count || (link.target > count && link.target != 5)) continue;
        result.push_back(link);
    }
    if (!result.empty()) {
        const size_t disturbed = static_cast<size_t>(seed + round) % result.size();
        result[disturbed].weight += 2.0;
        result[disturbed].interference = true;
    }
    return result;
}

std::vector<int> routeFor(const MultiplayerState& state, int source) {
    NetworkGraph graph;
    for (const MultiplayerPlayer& player : state.players)
        if (player.node.energy > 0.0) graph.addNode(player.node);
    SensorNode terminal = {5, 100, 1, 0, 0, 0, NodeStrategy::Cooperative};
    graph.addNode(terminal);
    for (const GameLink& link : state.links) graph.addUndirectedEdge(link.source,
        link.target, link.weight);
    return graph.findEnergyAwareRoute(source, 5).path;
}

void prepare(MultiplayerState& state) {
    state.links = linksFor(state.seed, state.round + 1, state.playerCount);
    state.routes.clear();
    for (int id = 1; id <= state.playerCount; ++id)
        state.routes.push_back(routeFor(state, id));
    for (MultiplayerPlayer& player : state.players) {
        player.legal = {player.node.energy >= 4.0, player.node.energy >= 3.0,
            true, true};
    }
}

void apply(MultiplayerState& state, const std::vector<NodeAction>& actions) {
    if (actions.size() != static_cast<size_t>(state.playerCount))
        throw std::invalid_argument("one action required for every player");
    if (state.status != "playing") throw std::invalid_argument("match already ended");
    const std::vector<std::vector<int> > oldRoutes = state.routes;
    MultiplayerRound turn;
    turn.number = state.round + 1;
    turn.actions = actions;
    std::vector<int> relayCounts(state.playerCount, 0);
    std::vector<double> oldEnergy, oldReputation;
    std::vector<int> oldScore;
    for (int i = 0; i < state.playerCount; ++i) {
        const MultiplayerPlayer& player = state.players[i];
        oldEnergy.push_back(player.node.energy);
        oldReputation.push_back(player.node.reputation);
        oldScore.push_back(player.score);
        const NodeAction action = actions[i];
        const int actionIndex = action == NodeAction::Transmit ? 0 :
            action == NodeAction::Relay ? 1 : action == NodeAction::Sleep ? 2 : 3;
        if (!player.legal[actionIndex]) throw std::invalid_argument("illegal action for energy");
    }
    for (int i = 0; i < state.playerCount; ++i) {
        if (actions[i] != NodeAction::Transmit) continue;
        MultiplayerPacket packet;
        packet.source = i + 1;
        packet.route = oldRoutes[i];
        packet.delivered = !packet.route.empty();
        packet.blockedBy = 0;
        packet.reason = packet.delivered ? "Packet reached terminal 05." :
            "No powered route to terminal 05.";
        for (size_t step = 1; step + 1 < packet.route.size(); ++step) {
            const int relay = packet.route[step];
            if (actions[relay - 1] != NodeAction::Relay) {
                packet.delivered = false;
                packet.blockedBy = relay;
                packet.reason = "Node " + std::to_string(relay) +
                    " did not relay this packet.";
                break;
            }
        }
        if (packet.delivered) {
            state.delivered++;
            state.players[i].ownDelivered++;
            for (size_t step = 1; step + 1 < packet.route.size(); ++step)
                relayCounts[packet.route[step] - 1]++;
        }
        turn.packets.push_back(packet);
    }
    GameTheoryEngine engine;
    for (int i = 0; i < state.playerCount; ++i) {
        MultiplayerPlayer& player = state.players[i];
        const NodeAction action = actions[i];
        const bool success = action == NodeAction::Transmit ?
            std::any_of(turn.packets.begin(), turn.packets.end(),
                [i](const MultiplayerPacket& packet) {
                    return packet.source == i + 1 && packet.delivered;
                }) : relayCounts[i] > 0;
        if (action == NodeAction::Relay && !success) {
            player.node.energy = std::max(0.0, player.node.energy - 3.0);
        } else engine.applyActionResult(player.node, action, success);
        if (action == NodeAction::Relay && success) {
            player.relayed += relayCounts[i];
            player.cooperativeRounds++;
        }
        player.score = 20 * player.ownDelivered + 12 * player.relayed +
            4 * player.cooperativeRounds +
            static_cast<int>(std::floor(10 * player.node.reputation)) +
            static_cast<int>(std::floor(player.node.energy / 5)) -
            5 * player.node.selfishDecisions;
        turn.energyDelta.push_back(player.node.energy - oldEnergy[i]);
        turn.reputationDelta.push_back(player.node.reputation - oldReputation[i]);
        turn.scoreDelta.push_back(player.score - oldScore[i]);
    }
    state.round++;
    if (state.round == MAX_ROUNDS) state.status = state.delivered >= state.target ? "won" : "lost";
    prepare(state);
    turn.routeChanged = oldRoutes != state.routes;
    state.rounds.push_back(turn);
}

void pathJson(std::ostringstream& out, const std::vector<int>& path) {
    out << '[';
    for (size_t i = 0; i < path.size(); ++i) {
        if (i) out << ',';
        out << path[i];
    }
    out << ']';
}
}

MultiplayerState runMultiplayer(int seed, int playerCount,
    const std::vector<std::vector<NodeAction> >& rounds) {
    if (seed < 0 || seed > 999999 || playerCount < 2 || playerCount > 4 ||
        rounds.size() > MAX_ROUNDS) throw std::invalid_argument("invalid match setup");
    MultiplayerState state;
    state.seed = seed;
    state.playerCount = playerCount;
    state.round = 0;
    state.delivered = 0;
    state.target = 6;
    state.status = "playing";
    for (int id = 1; id <= playerCount; ++id) {
        SensorNode node = {id, 28.0, 0.60, 0, 0, 0, NodeStrategy::Cooperative};
        state.players.push_back({node, 0, 0, 0, 0, {}});
    }
    prepare(state);
    for (const std::vector<NodeAction>& turn : rounds) apply(state, turn);
    return state;
}

std::string multiplayerToJson(const MultiplayerState& state) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2);
    out << "{\"schemaVersion\":1,\"seed\":" << state.seed << ",\"playerCount\":"
        << state.playerCount << ",\"round\":" << state.round << ",\"maxRounds\":8"
        << ",\"delivered\":" << state.delivered << ",\"target\":" << state.target
        << ",\"status\":\"" << state.status << "\",\"players\":[";
    for (size_t i = 0; i < state.players.size(); ++i) {
        const MultiplayerPlayer& player = state.players[i];
        if (i) out << ',';
        out << "{\"nodeId\":" << player.node.id << ",\"energy\":" << player.node.energy
            << ",\"reputation\":" << player.node.reputation
            << ",\"ownDelivered\":" << player.ownDelivered
            << ",\"relayed\":" << player.relayed
            << ",\"cooperativeRounds\":" << player.cooperativeRounds
            << ",\"selfishSleeps\":" << player.node.selfishDecisions
            << ",\"score\":" << player.score << ",\"legal\":{"
            << "\"TRANSMIT\":" << (player.legal[0] ? "true" : "false")
            << ",\"RELAY\":" << (player.legal[1] ? "true" : "false")
            << ",\"SLEEP\":true,\"IDLE\":true}}";
    }
    out << "],\"links\":[";
    for (size_t i = 0; i < state.links.size(); ++i) {
        const GameLink& link = state.links[i];
        if (i) out << ',';
        out << "{\"source\":" << link.source << ",\"target\":" << link.target
            << ",\"weight\":" << link.weight << ",\"interference\":"
            << (link.interference ? "true" : "false") << '}';
    }
    out << "],\"routes\":[";
    for (size_t i = 0; i < state.routes.size(); ++i) {
        if (i) out << ',';
        pathJson(out, state.routes[i]);
    }
    out << "],\"history\":[";
    for (size_t i = 0; i < state.rounds.size(); ++i) {
        const MultiplayerRound& turn = state.rounds[i];
        if (i) out << ',';
        out << "{\"round\":" << turn.number << ",\"actions\":[";
        for (size_t j = 0; j < turn.actions.size(); ++j) {
            if (j) out << ',';
            out << '"' << GameTheoryEngine().actionToString(turn.actions[j]) << '"';
        }
        out << "],\"packets\":[";
        for (size_t j = 0; j < turn.packets.size(); ++j) {
            const MultiplayerPacket& packet = turn.packets[j];
            if (j) out << ',';
            out << "{\"source\":" << packet.source << ",\"route\":";
            pathJson(out, packet.route);
            out << ",\"delivered\":" << (packet.delivered ? "true" : "false")
                << ",\"blockedBy\":" << packet.blockedBy
                << ",\"reason\":\"" << packet.reason << "\"}";
        }
        out << "],\"energyDelta\":[";
        for (size_t j = 0; j < turn.energyDelta.size(); ++j) {
            if (j) out << ','; out << turn.energyDelta[j];
        }
        out << "],\"reputationDelta\":[";
        for (size_t j = 0; j < turn.reputationDelta.size(); ++j) {
            if (j) out << ','; out << turn.reputationDelta[j];
        }
        out << "],\"scoreDelta\":[";
        for (size_t j = 0; j < turn.scoreDelta.size(); ++j) {
            if (j) out << ','; out << turn.scoreDelta[j];
        }
        out << "],\"routeChanged\":" << (turn.routeChanged ? "true" : "false") << '}';
    }
    out << "]}";
    return out.str();
}
