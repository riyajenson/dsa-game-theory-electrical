#include "../src/SimulationRunner.h"

#include <cassert>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {
void rejectsInvalidInput() {
    bool rejectedRounds = false;
    bool rejectedStrategy = false;
    try {
        runSimulation(0, "mixed");
    } catch (const std::invalid_argument&) {
        rejectedRounds = true;
    }
    try {
        runSimulation(3, "unknown");
    } catch (const std::invalid_argument&) {
        rejectedStrategy = true;
    }
    assert(rejectedRounds);
    assert(rejectedStrategy);
}

void producesCompleteRoundAndNetworkData() {
    SimulationResult result = runSimulation(3, "mixed");
    assert(result.schemaVersion == 1);
    assert(result.rounds == 3);
    assert(result.strategy == "mixed");
    assert(result.nodes.size() == 5);
    assert(result.links.size() == 6);
    assert(result.routes.size() == 2);
    assert(result.routes[0].reachable);
    assert(result.routes[1].reachable);
    assert(result.history.size() == 3);
    assert(result.metrics.totalAttemptedPackets >= result.metrics.totalDeliveredPackets);
    assert(result.planner.planned.actions.size() == 3);
    assert(result.planner.greedy.actions.size() == 3);
}

void serializesTheVersionedDashboardContract() {
    const std::string json = simulationToJson(runSimulation(2, "cooperative"));
    assert(json.find("\"schemaVersion\":1") != std::string::npos);
    assert(json.find("\"metrics\":{") != std::string::npos);
    assert(json.find("\"nodes\":[") != std::string::npos);
    assert(json.find("\"links\":[") != std::string::npos);
    assert(json.find("\"routes\":[") != std::string::npos);
    assert(json.find("\"history\":[") != std::string::npos);
    assert(json.find("\"plannerComparison\":{") != std::string::npos);
}
}

int main() {
    rejectsInvalidInput();
    producesCompleteRoundAndNetworkData();
    serializesTheVersionedDashboardContract();
    std::cout << "Simulation runner tests passed.\n";
    return 0;
}
