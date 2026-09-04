#include "../src/SimulationMetrics.h"

#include <cassert>
#include <cmath>

namespace {
bool nearlyEqual(double left, double right) {
    return std::fabs(left - right) < 0.0001;
}

SensorNode makeNode(
    int id,
    double energy,
    NodeStrategy strategy,
    int relayRequests = 0,
    int successfulRelays = 0,
    double reputation = 0.9
) {
    return {id, energy, reputation, relayRequests, successfulRelays, 0, strategy};
}

SensorNode cooperativeNode() {
    return makeNode(1, 80.0, NodeStrategy::Cooperative);
}

SensorNode selfishNode() {
    return makeNode(2, 50.0, NodeStrategy::Selfish, 3, 0, 0.50);
}

void normalAggregation() {
    SimulationMetrics metrics;
    metrics.recordRound({1, 4, 3, {cooperativeNode(), selfishNode()}});

    SimulationMetricsResult result = metrics.getResult();
    assert(result.totalAttemptedPackets == 4);
    assert(result.totalDeliveredPackets == 3);
    assert(nearlyEqual(result.packetDeliveryRatio, 0.75));
}

void averagesResidualEnergyAcrossAllNodeObservations() {
    SimulationMetrics metrics;
    metrics.recordRound({1, 4, 3, {makeNode(1, 80.0, NodeStrategy::Cooperative),
                                    makeNode(2, 40.0, NodeStrategy::Cooperative)}});
    metrics.recordRound({2, 4, 4, {makeNode(1, 60.0, NodeStrategy::Cooperative)}});

    assert(nearlyEqual(metrics.getResult().averageResidualEnergy, 60.0));
}

void lifetimeIsSmallestRoundWithDepletedNode() {
    SimulationMetrics metrics;
    metrics.recordRound({7, 1, 1, {makeNode(1, 0.0, NodeStrategy::Cooperative)}});
    metrics.recordRound({3, 1, 1, {makeNode(2, -1.0, NodeStrategy::Selfish)}});
    metrics.recordRound({5, 1, 1, {makeNode(3, 20.0, NodeStrategy::Cooperative)}});

    assert(metrics.getResult().networkLifetimeRound == 3);
}

void countsSelfishEventsAndStrategyBuckets() {
    SimulationMetrics metrics;
    metrics.recordRound({1, 2, 2, {cooperativeNode(), selfishNode()}});

    SimulationMetricsResult result = metrics.getResult();
    assert(result.selfishEventCount == 1);
    assert(result.cooperative.nodeObservations == 1);
    assert(result.selfish.nodeObservations == 1);
    assert(result.selfish.selfishEvents == 1);
}

void emptyInputHasZeroesAndUnknownLifetime() {
    SimulationMetricsResult result = SimulationMetrics().getResult();
    assert(result.totalAttemptedPackets == 0);
    assert(result.totalDeliveredPackets == 0);
    assert(nearlyEqual(result.packetDeliveryRatio, 0.0));
    assert(nearlyEqual(result.averageResidualEnergy, 0.0));
    assert(result.networkLifetimeRound == -1);
}

void packetCountsAreNormalized() {
    SimulationMetrics metrics;
    metrics.recordRound({1, -4, 8, {cooperativeNode()}});

    SimulationMetricsResult result = metrics.getResult();
    assert(result.totalAttemptedPackets == 0);
    assert(result.totalDeliveredPackets == 0);
}

void emptyStrategyBucketHasZeroAverage() {
    StrategyMetrics bucket = {0, 0.0, 0};
    assert(nearlyEqual(bucket.averageResidualEnergy(), 0.0));
}
}

int main() {
    normalAggregation();
    averagesResidualEnergyAcrossAllNodeObservations();
    lifetimeIsSmallestRoundWithDepletedNode();
    countsSelfishEventsAndStrategyBuckets();
    emptyInputHasZeroesAndUnknownLifetime();
    packetCountsAreNormalized();
    emptyStrategyBucketHasZeroAverage();
    return 0;
}
