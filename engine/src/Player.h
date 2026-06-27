#pragma once
#include <string>

namespace ptp {
    // Defines the possible existence states of a player
    enum class PlayerState { ALIVE, DEAD, SAFE };

    // The Player struct holds only data
    struct Player {
        std::string id;
        std::string name;
        float       x;
        float       y;
        int         score;
        PlayerState state;
        
        // constructor using initializer lists to set default values quickly upon spawning
        Player(std::string id, std::string name, float startX, float startY)
            : id(std::move(id)), name(std::move(name))
            , x(startX), y(startY), score(0), state(PlayerState::ALIVE)
        {}
    };
}