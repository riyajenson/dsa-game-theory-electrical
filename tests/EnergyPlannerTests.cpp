#include "../src/EnergyPlanner.h"

#include <cassert>
#include <cmath>
#include <iostream>

namespace {
bool nearlyEqual(double left, double right) {
    return std::fabs(left - right) < 0.0001;
}

DecisionContext relayContext() {
    return {8.0, 3.0, 4.0, 1.2, 2.5, true, false};
}

void emptyPlanForZeroRounds() {
    EnergyPlanner planner;
    SensorNode node = {1, 18.0, 0.8, 0, 0, 0, NodeStrategy::Cooperative};

    EnergyPlan result = planner.plan(node, relayContext(), 0);

    assert(result.actions.empty());
    assert(nearlyEqual(result.totalUtility, 0.0));
    assert(nearlyEqual(result.remainingEnergy, 18.0));
}

void returnsOneActionPerRoundAndValidEnergy() {
    EnergyPlanner planner;
    SensorNode node = {1, 18.0, 0.8, 0, 0, 0, NodeStrategy::Cooperative};

    EnergyPlan result = planner.plan(node, relayContext(), 5);

    assert(result.actions.size() == 5);
    assert(result.remainingEnergy >= 0.0);
    assert(result.remainingEnergy <= 100.0);
}

void dynamicPlanDoesNotUnderperformGreedy() {
    EnergyPlanner planner;
    SensorNode node = {1, 8.0, 0.9, 0, 0, 0, NodeStrategy::Cooperative};

    EnergyPlan planned = planner.plan(node, relayContext(), 6);
    EnergyPlan greedy = planner.greedy(node, relayContext(), 6);

    assert(planned.actions.size() == 6);
    assert(greedy.actions.size() == 6);
    assert(planned.totalUtility + 0.0001 >= greedy.totalUtility);
}

void clampsRoundsAndStartingEnergy() {
    EnergyPlanner planner;
    SensorNode node = {1, 140.0, 0.9, 0, 0, 0, NodeStrategy::Cooperative};

    EnergyPlan result = planner.plan(node, relayContext(), 25);

    assert(result.actions.size() == 20);
    assert(result.remainingEnergy <= 100.0);
}

void reportedEnergyMatchesReturnedActionSequence() {
    EnergyPlanner planner;
    GameTheoryEngine engine;
    SensorNode node = {3, 73.0, 1.0, 5, 5, 0, NodeStrategy::Cooperative};
    DecisionContext context = relayContext();
    context.nodeHasOwnData = true;
    EnergyPlan result = planner.plan(node, context, 5);

    for (NodeAction action : result.actions) {
        const bool delivered =
            action == NodeAction::Relay || action == NodeAction::Transmit;
        engine.applyActionResult(node, action, delivered);
    }

    assert(nearlyEqual(result.remainingEnergy, node.energy));
}
}

int main() {
    emptyPlanForZeroRounds();
    returnsOneActionPerRoundAndValidEnergy();
    dynamicPlanDoesNotUnderperformGreedy();
    clampsRoundsAndStartingEnergy();
    reportedEnergyMatchesReturnedActionSequence();
    std::cout << "Energy planner tests passed.\n";
    return 0;
}
