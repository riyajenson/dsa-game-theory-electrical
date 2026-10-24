#ifndef NETWORK_GRAPH_H
#define NETWORK_GRAPH_H

#include "GameTheoryEngine.h"

#include <map>
#include <vector>

struct CommunicationLink {
    int targetNodeId;
    double weight;
};

struct RouteResult {
    bool reachable;
    double totalCost;
    std::vector<int> path;
};

class NetworkGraph {
public:
    void addNode(const SensorNode& node);
    void addUndirectedEdge(int firstNodeId, int secondNodeId, double weight);

    bool hasNode(int nodeId) const;
    const SensorNode* getNode(int nodeId) const;
    const std::vector<CommunicationLink>& getNeighbors(int nodeId) const;
    std::vector<int> getNodeIds() const;

    RouteResult findShortestRoute(int sourceNodeId, int destinationNodeId) const;
    RouteResult findEnergyAwareRoute(int sourceNodeId, int destinationNodeId) const;

private:
    std::map<int, SensorNode> nodes;
    std::map<int, std::vector<CommunicationLink> > adjacencyList;

    RouteResult findRoute(int sourceNodeId, int destinationNodeId, bool energyAware) const;
    double calculateTraversalCost(
        const CommunicationLink& link,
        int destinationNodeId,
        bool energyAware
    ) const;
};

#endif
