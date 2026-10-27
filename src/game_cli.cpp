#include "GameSession.h"

#include <cstdlib>
#include <exception>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

int main(int argc, char* argv[]) {
    if (argc != 7 || std::string(argv[1]) != "--seed" ||
        std::string(argv[3]) != "--profile" ||
        std::string(argv[5]) != "--actions") {
        std::cerr << "Usage: game_cli.exe --seed 0..999999 --profile cooperative|mixed|selfish --actions CSV\n";
        return 2;
    }
    try {
        const std::string seedText(argv[2]);
        if (seedText.empty() || seedText.find_first_not_of("0123456789") != std::string::npos)
            throw std::invalid_argument("invalid seed");
        const int seed = std::stoi(seedText);
        std::vector<NodeAction> actions;
        std::stringstream stream(argv[6]);
        std::string token;
        while (std::getline(stream, token, ',')) actions.push_back(parseGameAction(token));
        if (!std::string(argv[6]).empty() && std::string(argv[6]).back() == ',')
            throw std::invalid_argument("invalid game action");
        std::cout << gameToJson(runGame(seed, argv[4], actions)) << "\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 2;
    }
}
