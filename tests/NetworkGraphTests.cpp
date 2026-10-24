#include "../src/NetworkGraph.h"

#include <cassert>
#include <cmath>
#include <vector>

namespace {
bool nearlyEqual(double left, double right) {
    return std::fabs(left - right) < 0.0001;
}

SensorNode makeNode(int id, double energy, double reputation) {
    return {id, energy, reputation, 0, 0, 0, NodeStrategy::Cooperative};
}

void shortestPathUsesLowestTotalLinkCost() {
    NetworkGraph graph;
    graph.addNode(makeNode(1, 90.0, 0.90));
    graph.addNode(makeNode(2, 90.0, 0.90));
    graph.addNode(makeNode(3, 90.0, 0.90));
    graph.addNode(makeNode(4, 90.0, 0.90));

    graph.addUndirectedEdge(1, 2, 2.0);
    graph.addUndirectedEdge(2, 4, 2.0);
    graph.addUndirectedEdge(1, 3, 1.0);
    graph.addUndirectedEdge(3, 4, 8.0);

    RouteResult route = graph.findShortestRoute(1, 4);

    assert(route.reachable);
    assert((route.path == std::vector<int>{1, 2, 4}));
    assert(nearlyEqual(route.totalCost, 4.0));
}

void energyAwarePathAvoidsLowEnergyRelayWhenAlternativeExists() {
    NetworkGraph graph;
    graph.addNode(makeNode(1, 95.0, 0.95));
    graph.addNode(makeNode(2, 12.0, 0.35));
    graph.addNode(makeNode(3, 90.0, 0.90));
    graph.addNode(makeNode(4, 88.0, 0.85));

    graph.addUndirectedEdge(1, 2, 1.0);
    graph.addUndirectedEdge(2, 4, 1.0);
    graph.addUndirectedEdge(1, 3, 2.0);
    graph.addUndirectedEdge(3, 4, 2.0);

    RouteResult shortestRoute = graph.findShortestRoute(1, 4);
    RouteResult energyAwareRoute = graph.findEnergyAwareRoute(1, 4);

    assert(shortestRoute.reachable);
    assert(energyAwareRoute.reachable);
    assert((shortestRoute.path == std::vector<int>{1, 2, 4}));
    assert((energyAwareRoute.path == std::vector<int>{1, 3, 4}));
    assert(shortestRoute.totalCost < energyAwareRoute.totalCost);
}

void missingDestinationIsUnreachable() {
    NetworkGraph graph;
    graph.addNode(makeNode(1, 90.0, 0.90));

    RouteResult route = graph.findShortestRoute(1, 99);

    assert(!route.reachable);
    assert(route.path.empty());
}

void energyAwareCostDoesNotPenalizeDestinationNode() {
    NetworkGraph graph;
    graph.addNode(makeNode(1, 90.0, 0.90));
    graph.addNode(makeNode(2, 10.0, 0.20));

    graph.addUndirectedEdge(1, 2, 1.5);

    RouteResult route = graph.findEnergyAwareRoute(1, 2);

    assert(route.reachable);
    assert((route.path == std::vector<int>{1, 2}));
    assert(nearlyEqual(route.totalCost, 1.5));
}
}

int main() {
    shortestPathUsesLowestTotalLinkCost();
    energyAwarePathAvoidsLowEnergyRelayWhenAlternativeExists();
    missingDestinationIsUnreachable();
    energyAwareCostDoesNotPenalizeDestinationNode();
    return 0;
}
