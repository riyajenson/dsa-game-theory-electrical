#ifndef SIMULATION_METRICS_H
#define SIMULATION_METRICS_H

#include "GameTheoryEngine.h"

#include <vector>

struct SimulationRoundObservation {
    int round;
    int attemptedPackets;
    int deliveredPackets;
    std::vector<SensorNode> nodes;
};

struct StrategyMetrics {
    int nodeObservations;
    double totalResidualEnergy;
    int selfishEvents;

    double averageResidualEnergy() const;
};

struct SimulationMetricsResult {
    int totalAttemptedPackets;
    int totalDeliveredPackets;
    double packetDeliveryRatio;
    double averageResidualEnergy;
    int networkLifetimeRound;
    int selfishEventCount;
    StrategyMetrics cooperative;
    StrategyMetrics selfish;
};

class SimulationMetrics {
public:
    void recordRound(const SimulationRoundObservation& observation);
    SimulationMetricsResult getResult() const;

private:
    struct Aggregates {
        int totalAttemptedPackets;
        int totalDeliveredPackets;
        double totalResidualEnergy;
        int nodeObservations;
        int networkLifetimeRound;
        int selfishEventCount;
        StrategyMetrics cooperative;
        StrategyMetrics selfish;

        Aggregates()
            : totalAttemptedPackets(0),
              totalDeliveredPackets(0),
              totalResidualEnergy(0.0),
              nodeObservations(0),
              networkLifetimeRound(-1),
              selfishEventCount(0),
              cooperative{0, 0.0, 0},
              selfish{0, 0.0, 0} {}
    };

    Aggregates aggregates;
};

#endif
