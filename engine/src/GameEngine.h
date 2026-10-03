#pragma once 
#include <vector>
#include <unordered_map>
#include <string>
#include <random>

// import both Player and Obstacle definition
#include "Player.h"  
#include "Obstacle.h"

namespace ptp {
    // the payload that pybind11 should eventually convert into JSON
    // so the FastAPI server can broadcast to the React Host screen.
    struct GameState {
        int                    tick;
        std::vector<Player>    players;
        std::vector<Obstacle>  obstacles;
        bool                   gameOver;
    };

    class GameEngine {
        public:
            // explicit prevents accidental implicit type conversions
            explicit GameEngine(int laneCount = 10, int gridWidth = 12,
                                unsigned seed = 0xC0FFEE);

            // public API method exposed to python
            bool addPlayer    (const std::string& playerId, const std::string& name);
            bool removePlayer (const std::string& playerId);
            void applyInput   (const std::string& playerId, const std::string& action);

            // main heartbeat runs at ~20 times a sec
            GameState tick(float deltaTime);

            int playerCount() const;
            bool isGameOver() const;
        
        private: 
            int   _laneCount, _gridWidth, _tickCount;
            std::mt19937 _rng;
            float _spawnTimer, _spawnInterval, _elapsed, _nextEspressoAt;
            int   _nextObstacleId = 0;

            // the master state held in server RAM
            std::unordered_map<std::string, Player> _players;
            std::vector<Obstacle>                   _obstacles;

            // internal physics and memory managemnet steps called within tick()
            void _spawnObstacle();
            void _moveObstacles(float dt);
            void _checkCollisions();  // uses the AABB::intersects() logic
            void _cullObstacles();    // deletes obstacles that have moved off screen to free memory
            AABB _playerAABB(const Player& p) const;   // helper function to generate hitbox for a specific player

            friend struct EngineTestAccess;
    };
}