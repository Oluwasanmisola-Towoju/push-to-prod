#pragma once
#include <string>

namespace ptp {
    enum class PlayerState { ALIVE, DEAD, SAFE };

    struct Player {
        std::string id;
        std::string name;
        float       x;
        float       y;
        int         score;
        PlayerState state;
        
        Player(std::string id, std::string name, float startX, float startY)
            : id(std::move(id)), name(std::move(name))
            , x(startX), y(startY), score(0), state(PlayerState::ALIVE)
        {}
    };
}