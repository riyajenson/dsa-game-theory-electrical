#include "../src/GameSession.h"

#include <cassert>
#include <iostream>
#include <stdexcept>

int main() {
    const GameState start = runGame(17, {});
    assert(start.round == 0 && start.status == "playing");
    assert(start.previews.size() == 4);
    assert(gameToJson(start).find("\"currentPacket\":") != std::string::npos);
    assert(start.previews[0].legal);
    assert(!start.previews[1].legal);
    assert(start.previews[1].reason.find("even") != std::string::npos);
    assert(start.nodes[0].energy == 28.0);
    assert(start.previews[0].delivered ==
        runGame(17, {NodeAction::Transmit}).history[0].delivered);
    assert(runGame(17, {NodeAction::Transmit}).delivered == 1);
    assert(runGame(1, {NodeAction::Transmit}).delivered == 0);
    assert(runGame(0, {}).nodes[2].strategy == NodeStrategy::Selfish);
    assert(runGame(17, {}).nodes[2].strategy == NodeStrategy::Cooperative);

    const GameState relay = runGame(17, {NodeAction::Idle, NodeAction::Relay});
    assert(relay.round == 2);
    assert(relay.delivered == 1);
    assert(relay.nodes[0].energy == 24.7);
    assert(relay.nodes[0].reputation > start.nodes[0].reputation);
    assert(relay.history[1].playerAction == NodeAction::Relay);
    assert(relay.history[1].aiActions.size() == 4);
    assert(gameToJson(relay) == gameToJson(runGame(17, {NodeAction::Idle, NodeAction::Relay})));

    const GameState sleep = runGame(17, {NodeAction::Sleep});
    assert(sleep.nodes[0].energy == 29.5);
    assert(sleep.nodes[0].reputation == 0.55);
    assert(sleep.selfishDecisions == 1);
    assert(sleep.delivered == 0);

    const GameState win = runGame(17, {NodeAction::Transmit, NodeAction::Relay,
        NodeAction::Idle, NodeAction::Relay, NodeAction::Idle,
        NodeAction::Relay, NodeAction::Idle, NodeAction::Relay});
    assert(win.status == "won");
    assert(win.round == 8 && win.delivered == 5);
    assert(win.score > 0);
    assert(win.attempted == 8 && win.selfishDecisions == 0);

    const GameState lowEnergy = runGame(17, {NodeAction::Transmit,
        NodeAction::Transmit, NodeAction::Transmit, NodeAction::Transmit,
        NodeAction::Transmit, NodeAction::Transmit, NodeAction::Idle});
    assert(lowEnergy.status == "playing");
    assert(!lowEnergy.previews[0].legal);
    assert(lowEnergy.previews[0].reason.find("4 energy") != std::string::npos);
    assert(lowEnergy.previews[1].legal);

    const GameState loss = runGame(17, std::vector<NodeAction>(8, NodeAction::Idle));
    assert(loss.status == "lost" && loss.delivered == 0);

    bool rejected = false;
    try { runGame(17, std::vector<NodeAction>(9, NodeAction::Idle)); }
    catch (const std::invalid_argument&) { rejected = true; }
    assert(rejected);

    std::cout << "Game session tests passed.\n";
}
