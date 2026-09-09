#ifndef SIMULATION_RUNNER_H
#define SIMULATION_RUNNER_H

#include "EnergyPlanner.h"
#include "NetworkGraph.h"
#include "SimulationMetrics.h"

#include <string>
#include <vector>

struct SimulationLink {
    int source;
    int target;
    double weight;
};

struct SimulationRoute {
    std::string label;
    bool reachable;
    double cost;
    std::vector<int> path;
};

struct SimulationRound {
    int round;
    int attemptedPackets;
    int deliveredPackets;
    double averageEnergy;
};

struct PlannerComparison {
    EnergyPlan planned;
    EnergyPlan greedy;
    std::string recommendation;
};

struct SimulationResult {
    int schemaVersion;
    int rounds;
    std::string strategy;
    std::vector<SensorNode> nodes;
    std::vector<SimulationLink> links;
    std::vector<SimulationRoute> routes;
    std::vector<SimulationRound> history;
    SimulationMetricsResult metrics;
    PlannerComparison planner;
};

SimulationResult runSimulation(int rounds, const std::string& strategy);
std::string simulationToJson(const SimulationResult& result);

#endif
