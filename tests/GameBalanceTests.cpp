#include "../src/GameSession.h"

#include <cassert>
#include <iostream>
#include <string>
#include <vector>

int main() {
    const std::string profiles[] = {"cooperative", "mixed", "selfish"};
    int winningPlans[3] = {0, 0, 0};
    for (int seed = 0; seed < 100; ++seed) {
        for (int profileIndex = 0; profileIndex < 3; ++profileIndex) {
            int winsForStart = 0;
            // Four relay requests plus any two of the four odd-round transmit slots.
            for (int first = 0; first < 4; ++first) {
                for (int second = first + 1; second < 4; ++second) {
                    std::vector<NodeAction> actions(8, NodeAction::Idle);
                    for (int round = 1; round < 8; round += 2)
                        actions[round] = NodeAction::Relay;
                    actions[first * 2] = NodeAction::Transmit;
                    actions[second * 2] = NodeAction::Transmit;
                    const GameState result = runGame(seed, profiles[profileIndex], actions);
                    if (result.status == "won") ++winsForStart;
                }
            }
            assert(winsForStart > 0);
            winningPlans[profileIndex] += winsForStart;
        }
    }
    assert(winningPlans[0] >= winningPlans[1]);
    assert(winningPlans[1] >= winningPlans[2]);
    std::cout << "Balance sweep: 100 seeds x 3 profiles x 6 plans; winning plans "
              << winningPlans[0] << "/" << winningPlans[1] << "/"
              << winningPlans[2] << ".\n";
}
