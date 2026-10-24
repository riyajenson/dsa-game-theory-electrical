#include "SimulationMetrics.h"

#include <algorithm>

double StrategyMetrics::averageResidualEnergy() const {
    if (nodeObservations == 0) {
        return 0.0;
    }

    return totalResidualEnergy / nodeObservations;
}

void SimulationMetrics::recordRound(const SimulationRoundObservation& observation) {
    int attemptedPackets = std::max(0, observation.attemptedPackets);
    int deliveredPackets = std::min(
        attemptedPackets,
        std::max(0, observation.deliveredPackets)
    );

    aggregates.totalAttemptedPackets += attemptedPackets;
    aggregates.totalDeliveredPackets += deliveredPackets;

    GameTheoryEngine engine;

    for (const SensorNode& node : observation.nodes) {
        aggregates.totalResidualEnergy += node.energy;
        aggregates.nodeObservations++;

        StrategyMetrics& strategyMetrics =
            node.strategy == NodeStrategy::Cooperative
                ? aggregates.cooperative
                : aggregates.selfish;
        strategyMetrics.totalResidualEnergy += node.energy;
        strategyMetrics.nodeObservations++;

        if (engine.isSelfishNode(node)) {
            aggregates.selfishEventCount++;
            strategyMetrics.selfishEvents++;
        }

        if (node.energy <= 0.0 &&
            (aggregates.networkLifetimeRound == -1 ||
             observation.round < aggregates.networkLifetimeRound)) {
            aggregates.networkLifetimeRound = observation.round;
        }
    }
}

SimulationMetricsResult SimulationMetrics::getResult() const {
    double packetDeliveryRatio = aggregates.totalAttemptedPackets == 0
        ? 0.0
        : static_cast<double>(aggregates.totalDeliveredPackets) /
              aggregates.totalAttemptedPackets;

    double averageResidualEnergy = aggregates.nodeObservations == 0
        ? 0.0
        : aggregates.totalResidualEnergy / aggregates.nodeObservations;

    return {
        aggregates.totalAttemptedPackets,
        aggregates.totalDeliveredPackets,
        packetDeliveryRatio,
        averageResidualEnergy,
        aggregates.networkLifetimeRound,
        aggregates.selfishEventCount,
        aggregates.cooperative,
        aggregates.selfish
    };
}
