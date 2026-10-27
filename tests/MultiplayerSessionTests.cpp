#include "../src/MultiplayerSession.h"
#include <cassert>
#include <iostream>
#include <stdexcept>

int main() {
    MultiplayerState first = runMultiplayer(17, 2, {});
    assert(first.round == 0 && first.players.size() == 2);
    assert(first.players[0].node.id == 1 && first.players[1].node.id == 2);
    assert(first.players[0].legal[0] && first.players[1].legal[1]);

    MultiplayerState conflict = runMultiplayer(17, 2, {{NodeAction::Transmit, NodeAction::Transmit}});
    assert(conflict.rounds[0].packets.size() == 2);
    assert(!conflict.rounds[0].packets[0].delivered);
    assert(conflict.rounds[0].packets[0].blockedBy == 2);
    assert(conflict.rounds[0].packets[1].delivered);

    MultiplayerState cooperation = runMultiplayer(17, 2, {{NodeAction::Transmit, NodeAction::Relay}});
    assert(cooperation.delivered == 1);
    assert(cooperation.rounds[0].packets[0].delivered);
    assert(cooperation.players[1].relayed == 1);
    assert(cooperation.players[1].node.reputation > first.players[1].node.reputation);
    assert(multiplayerToJson(cooperation) == multiplayerToJson(runMultiplayer(17, 2,
        {{NodeAction::Transmit, NodeAction::Relay}})));
    assert(multiplayerToJson(cooperation).find("\"blockedBy\":0") != std::string::npos);

    std::vector<std::vector<NodeAction> > draining(7,
        {NodeAction::Transmit, NodeAction::Relay});
    MultiplayerState exhausted = runMultiplayer(17, 2, draining);
    assert(!exhausted.players[0].legal[0]);
    bool cannotTransmit = false;
    draining.push_back({NodeAction::Transmit, NodeAction::Idle});
    try { runMultiplayer(17, 2, draining); }
    catch (const std::invalid_argument&) { cannotTransmit = true; }
    assert(cannotTransmit);

    std::vector<std::vector<NodeAction> > quiet(7,
        {NodeAction::Idle, NodeAction::Idle});
    MultiplayerState lastPlayable = runMultiplayer(17, 2, quiet);
    quiet.push_back({NodeAction::Idle, NodeAction::Idle});
    MultiplayerState finished = runMultiplayer(17, 2, quiet);
    assert(finished.status == "lost");
    assert(finished.links[0].interference == lastPlayable.links[0].interference);
    assert(finished.links[1].interference == lastPlayable.links[1].interference);

    bool invalid = false;
    try { runMultiplayer(17, 2, {{NodeAction::Transmit}}); }
    catch (const std::invalid_argument&) { invalid = true; }
    assert(invalid);
    std::cout << "Multiplayer session tests passed.\n";
}
