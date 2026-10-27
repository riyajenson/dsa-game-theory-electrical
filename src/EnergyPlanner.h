#ifndef ENERGY_PLANNER_H
#define ENERGY_PLANNER_H

#include "GameTheoryEngine.h"

#include <vector>

struct EnergyPlan {
    std::vector<NodeAction> actions;
    double totalUtility;
    double remainingEnergy;
};

class EnergyPlanner {
public:
    EnergyPlan plan(
        const SensorNode& node,
        const DecisionContext& context,
        int rounds
    ) const;

    EnergyPlan greedy(
        const SensorNode& node,
        const DecisionContext& context,
        int rounds
    ) const;
};

#endif
