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

    bool invalid = false;
    try { runMultiplayer(17, 2, {{NodeAction::Transmit}}); }
    catch (const std::invalid_argument&) { invalid = true; }
    assert(invalid);
    std::cout << "Multiplayer session tests passed.\n";
}
