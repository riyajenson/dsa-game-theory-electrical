#include "MultiplayerSession.h"
#include <iostream>
#include <sstream>
#include <stdexcept>

int main(int argc, char* argv[]) {
    try {
        if (argc != 7 || std::string(argv[1]) != "--seed" ||
            std::string(argv[3]) != "--players" || std::string(argv[5]) != "--rounds")
            throw std::invalid_argument("usage: multiplayer_cli --seed N --players 2..4 --rounds TR,SI");
        const std::string seedText(argv[2]), playersText(argv[4]);
        if (seedText.empty() || playersText.empty() ||
            seedText.find_first_not_of("0123456789") != std::string::npos ||
            playersText.find_first_not_of("0123456789") != std::string::npos)
            throw std::invalid_argument("invalid numeric argument");
        const int seed = std::stoi(seedText), count = std::stoi(playersText);
        std::vector<std::vector<NodeAction> > rounds;
        const std::string record(argv[6]);
        if (!record.empty()) {
            std::stringstream stream(record);
            std::string row;
            while (std::getline(stream, row, ',')) {
                if (row.size() != static_cast<size_t>(count))
                    throw std::invalid_argument("invalid round width");
                std::vector<NodeAction> actions;
                for (char c : row) {
                    if (c == 'T') actions.push_back(NodeAction::Transmit);
                    else if (c == 'R') actions.push_back(NodeAction::Relay);
                    else if (c == 'S') actions.push_back(NodeAction::Sleep);
                    else if (c == 'I') actions.push_back(NodeAction::Idle);
                    else throw std::invalid_argument("invalid action code");
                }
                rounds.push_back(actions);
            }
            if (record.back() == ',') throw std::invalid_argument("trailing separator");
        }
        std::cout << multiplayerToJson(runMultiplayer(seed, count, rounds)) << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 2;
    }
}
