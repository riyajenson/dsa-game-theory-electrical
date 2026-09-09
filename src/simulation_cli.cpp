#include "SimulationRunner.h"

#include <cstdlib>
#include <exception>
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    int rounds = 5;
    std::string strategy = "mixed";

    for (int index = 1; index < argc; ++index) {
        const std::string argument = argv[index];
        if (argument == "--rounds" && index + 1 < argc) {
            rounds = std::atoi(argv[++index]);
        } else if (argument == "--strategy" && index + 1 < argc) {
            strategy = argv[++index];
        } else {
            std::cerr << "Usage: simulation_cli.exe --rounds 1-20 "
                      << "--strategy cooperative|selfish|mixed\n";
            return 2;
        }
    }

    try {
        std::cout << simulationToJson(runSimulation(rounds, strategy)) << "\n";
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << "\n";
        return 2;
    }
}
