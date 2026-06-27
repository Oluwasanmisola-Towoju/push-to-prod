#include "GameEngine.h"
#include <algorithm>
#include <cstdlib>
#include <cmath>
#include <sstream>
#include <iomanip>

namespace ptp {
    static constexpr float PLAYER_W = 0.8f;
    static constexpr float PLAYER_H = 0.8f;
    static constexpr float OBSTACLE_H = 0.9f;
    static constexpr float MOVE_STEP = 1.0f;

    GameEngine::GameEngine(int laneCount, int gridWidth)
        : _laneCount(laneCount), _gridWidth(gridWidth)
        , _tickCount(0), _spawnTimer(0.0f), _spawnInterval(1.2f)
    {}

    bool GameEngine::addPlayer(const std::string& id, const std::string& name) {
        if (_players.count(id)) return false;
        // spawns new players safely in the middle of the starting row
        float startX = static_cast<float>(_gridWidth) / 2.0f;
        _players.emplace(id, Player(id, name, startX, 0.0f));
        return true;
    }

    bool GameEngine::removePlayer(const std::string& id) {
        return _players.erase(id) > 0;
    }

    void GameEngine::applyInput(const std::string& id, const std::string& action) {
        auto it = _players.find(id);
        if (it == _players.end()) return;
        Player& p = it->second;
        if (p.state == PlayerState::DEAD) return;

        float nx = p.x, ny = p.y;
        
        // translates strig constants from the React frontend into coordinate math
        if      (action == "MOVE_UP")    ny += MOVE_STEP;
        else if (action == "MOVE_DOWN")  ny -= MOVE_STEP;
        else if (action == "MOVE_LEFT")  nx -= MOVE_STEP;
        else if (action == "MOVE_RIGHT") nx += MOVE_STEP;
        else return;

        // clamp the player inside the visible grid boundaries
        nx = std::max(0.0f, std::min(nx, (float)(_gridWidth - 1)));
        ny = std::max(0.0f, std::min(ny, (float)(_laneCount)));
        p.x = nx;
        p.y = ny;

        //  reaching the top row grants a point and resets position (here is the scoring logic btw)
        if (ny >= (float)_laneCount) {
            p.score++;
            p.y = 0.0f;
        }
    }

    GameState GameEngine::tick(float dt) {
        _spawnTimer += dt;

        // spawn intervals get faster over time, hopefully would make someone crash out lol
        if (_spawnTimer >= _spawnInterval) {
            _spawnTimer = 0.0f;
            _spawnObstacle();
            _spawnInterval =std::max(0.4f, _spawnInterval - 0.005f);  // dynamic difficulty
        }

        // sequential physics processing
        _moveObstacles(dt);
        _checkCollisions();
        _cullObstacles();
        _tickCount++;

        // construct and return the state snapshot for the Python FastAPI server
        GameState s;
        s.tick = _tickCount;
        s.gameOver = isGameOver();
        
        for (auto& [id, p] : _players) s.players.push_back(p);
        s.obstacles = _obstacles;
        return s;
    }

    void GameEngine::_spawnObstacle() {
        std::ostringstream ss;
        ss << "obs_" << std::setw(5) << std::setfill('0') << _nextObstacleId++;
        int    lane = 1 + rand() % (_laneCount - 1);
        float  speed = 3.0f + (float)(rand() % 40) / 10.0f;

        // set upa 50% chance of spawn moving left to right or right to left 
        if (rand() % 2 == 0) speed = -speed;

        float startX = (speed > 0) ? -1.5f : (float)_gridWidth + 1.5f;
        float w      = 1.0f + (float)(rand() % 3) * 0.5f;

        auto type    = static_cast<ObstacleType>(_nextObstacleId % 4);

        _obstacles.emplace_back(ss.str(), type, lane, startX, (float)lane, w, OBSTACLE_H, speed);
    }

    void GameEngine::_moveObstacles(float dt) {
        // Delta time ensures that movement speed is independent of a server lag
        for (auto& o : _obstacles) o.bounds.x += o.velocityX * dt;
    }

    void GameEngine::_checkCollisions() {
        for (auto& [id, p] : _players) {
            if (p.state == PlayerState::DEAD) continue;

            AABB pa = _playerAABB(p);

            for (auto& o : _obstacles)
                if (pa.intersects(o.bounds)) {
                    p.state = PlayerState::DEAD;
                    break;
                }
        }
    }

    void GameEngine::_cullObstacles() {
        float lim = (float)_gridWidth + 3.0f;

        // erase remove idiom to safely delete obstacles once they sweep off-screen
        _obstacles.erase(
            std::remove_if(_obstacles.begin(), _obstacles.end(),
                [&](const Obstacle& o){
                    return o.bounds.x > lim || o.bounds.x < -3.0f;
                }),
            _obstacles.end()
        );
    }

    AABB GameEngine::_playerAABB(const Player& p) const {
        return {
            p.x - PLAYER_W/2.0f,
            p.y - PLAYER_H/2.0f,
            PLAYER_W,
            PLAYER_H
        };
    }

    int GameEngine::playerCount() const { return (int)_players.size(); }
    bool GameEngine::isGameOver() const {
        if (_players.empty()) return false;
        for (auto& [id, p] : _players)
            if (p.state != PlayerState::DEAD) return false;
        return true;    // ALL players are dead, boohoo😭
    }
}