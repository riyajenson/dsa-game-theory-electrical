#include "NetworkGraph.h"

#include <algorithm>
#include <functional>
#include <limits>
#include <queue>
#include <utility>

using std::map;
using std::numeric_limits;
using std::pair;
using std::priority_queue;
using std::vector;

namespace {
const vector<CommunicationLink> emptyNeighbors;

struct QueueEntry {
    int nodeId;
    double cost;
};

bool operator>(const QueueEntry& left, const QueueEntry& right) {
    return left.cost > right.cost;
}
}

void NetworkGraph::addNode(const SensorNode& node) {
    nodes[node.id] = node;
    adjacencyList[node.id];
}

void NetworkGraph::addUndirectedEdge(int firstNodeId, int secondNodeId, double weight) {
    if (!hasNode(firstNodeId) || !hasNode(secondNodeId) || weight < 0.0) {
        return;
    }

    adjacencyList[firstNodeId].push_back({secondNodeId, weight});
    adjacencyList[secondNodeId].push_back({firstNodeId, weight});
}

bool NetworkGraph::hasNode(int nodeId) const {
    return nodes.find(nodeId) != nodes.end();
}

const SensorNode* NetworkGraph::getNode(int nodeId) const {
    map<int, SensorNode>::const_iterator found = nodes.find(nodeId);
    return found == nodes.end() ? 0 : &found->second;
}

const vector<CommunicationLink>& NetworkGraph::getNeighbors(int nodeId) const {
    map<int, vector<CommunicationLink> >::const_iterator found = adjacencyList.find(nodeId);
    return found == adjacencyList.end() ? emptyNeighbors : found->second;
}

vector<int> NetworkGraph::getNodeIds() const {
    vector<int> ids;

    for (map<int, SensorNode>::const_iterator it = nodes.begin(); it != nodes.end(); ++it) {
        ids.push_back(it->first);
    }

    return ids;
}

RouteResult NetworkGraph::findShortestRoute(int sourceNodeId, int destinationNodeId) const {
    return findRoute(sourceNodeId, destinationNodeId, false);
}

RouteResult NetworkGraph::findEnergyAwareRoute(int sourceNodeId, int destinationNodeId) const {
    return findRoute(sourceNodeId, destinationNodeId, true);
}

RouteResult NetworkGraph::findRoute(
    int sourceNodeId,
    int destinationNodeId,
    bool energyAware
) const {
    if (!hasNode(sourceNodeId) || !hasNode(destinationNodeId)) {
        return {false, numeric_limits<double>::infinity(), vector<int>()};
    }

    map<int, double> distances;
    map<int, int> previous;

    for (map<int, SensorNode>::const_iterator it = nodes.begin(); it != nodes.end(); ++it) {
        distances[it->first] = numeric_limits<double>::infinity();
    }

    distances[sourceNodeId] = 0.0;

    priority_queue<QueueEntry, vector<QueueEntry>, std::greater<QueueEntry> > queue;
    queue.push({sourceNodeId, 0.0});

    while (!queue.empty()) {
        QueueEntry current = queue.top();
        queue.pop();

        if (current.cost > distances[current.nodeId]) {
            continue;
        }

        if (current.nodeId == destinationNodeId) {
            break;
        }

        const vector<CommunicationLink>& neighbors = getNeighbors(current.nodeId);
        for (vector<CommunicationLink>::const_iterator it = neighbors.begin();
             it != neighbors.end();
             ++it) {
            double nextCost =
                current.cost + calculateTraversalCost(*it, destinationNodeId, energyAware);

            if (nextCost < distances[it->targetNodeId]) {
                distances[it->targetNodeId] = nextCost;
                previous[it->targetNodeId] = current.nodeId;
                queue.push({it->targetNodeId, nextCost});
            }
        }
    }

    if (distances[destinationNodeId] == numeric_limits<double>::infinity()) {
        return {false, distances[destinationNodeId], vector<int>()};
    }

    vector<int> path;
    int currentNodeId = destinationNodeId;
    path.push_back(currentNodeId);

    while (currentNodeId != sourceNodeId) {
        currentNodeId = previous[currentNodeId];
        path.push_back(currentNodeId);
    }

    std::reverse(path.begin(), path.end());
    return {true, distances[destinationNodeId], path};
}

double NetworkGraph::calculateTraversalCost(
    const CommunicationLink& link,
    int destinationNodeId,
    bool energyAware
) const {
    if (!energyAware || link.targetNodeId == destinationNodeId) {
        return link.weight;
    }

    const SensorNode* target = getNode(link.targetNodeId);
    if (target == 0) {
        return link.weight;
    }

    double lowEnergyPenalty = std::max(0.0, 50.0 - target->energy) * 0.08;
    double lowReputationPenalty = std::max(0.0, 0.70 - target->reputation) * 6.0;

    return link.weight + lowEnergyPenalty + lowReputationPenalty;
}
