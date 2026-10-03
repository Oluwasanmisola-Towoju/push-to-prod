#include "GameEngine.h"
#include <algorithm>
#include <cmath>
#include <sstream>
#include <iomanip>

namespace ptp {
    static constexpr float PLAYER_W = 0.8f;
    static constexpr float PLAYER_H = 0.8f;
    static constexpr float OBSTACLE_H = 0.9f;
    static constexpr float MOVE_STEP = 1.0f;
    static constexpr float MAX_DT = 0.1f;
    static constexpr int HAZARD_TYPE_COUNT = 4;

    GameEngine::GameEngine(int laneCount, int gridWidth, unsigned seed)
        : _laneCount(laneCount), _gridWidth(gridWidth)
        , _tickCount(0), _rng(seed), _spawnTimer(0.0f), _spawnInterval(1.2f)
        , _elapsed(0.0f), _nextEspressoAt(0.0f)
    {
        _nextEspressoAt = 4.0f + static_cast<float>(
            std::uniform_int_distribution<int>(0, 5)(_rng));
    }

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
        dt = std::min(dt, MAX_DT);
        _spawnTimer += dt;
        _elapsed += dt;

        // spawn intervals get faster over time, hopefully would make someone crash out lol
        if (_spawnTimer >= _spawnInterval) {
            _spawnTimer = 0.0f;
            _spawnObstacle();
            _spawnInterval =std::max(0.4f, _spawnInterval - 0.005f);  // dynamic difficulty
        }

        if (_elapsed >= _nextEspressoAt) {
            const int seq = _nextObstacleId++;
            std::uniform_int_distribution<int> laneDistribution(1, _laneCount - 1);
            const float speed = std::uniform_int_distribution<int>(0, 1)(_rng) == 0
                ? -2.0f : 2.0f;
            const float startX = (speed > 0) ? -1.5f : static_cast<float>(_gridWidth) + 1.5f;
            const int lane = laneDistribution(_rng);
            std::ostringstream ss;
            ss << "obs_" << std::setw(5) << std::setfill('0') << seq;
            _obstacles.emplace_back(ss.str(), ObstacleType::ESPRESSO_SHOT,
                                    lane, startX, static_cast<float>(lane),
                                    0.8f, OBSTACLE_H, speed);
            _nextEspressoAt = _elapsed + 20.0f;
        }

        for (auto& [id, p] : _players) {
            p.invulnerableTimer = std::max(0.0f, p.invulnerableTimer - dt);
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
        const int seq = _nextObstacleId++;
        std::ostringstream ss;
        ss << "obs_" << std::setw(5) << std::setfill('0') << seq;
        std::uniform_int_distribution<int> laneDistribution(1, _laneCount - 1);
        std::uniform_int_distribution<int> speedDistribution(30, 69);
        int    lane = laneDistribution(_rng);
        float  speed = static_cast<float>(speedDistribution(_rng)) / 10.0f;

        // set upa 50% chance of spawn moving left to right or right to left 
        if (std::uniform_int_distribution<int>(0, 1)(_rng) == 0) speed = -speed;

        float startX = (speed > 0) ? -1.5f : (float)_gridWidth + 1.5f;
        float w      = 1.0f + static_cast<float>(
            std::uniform_int_distribution<int>(0, 2)(_rng)) * 0.5f;

        auto type    = static_cast<ObstacleType>(seq % HAZARD_TYPE_COUNT);

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

            for (auto& o : _obstacles) {
                if (o.type == ObstacleType::ESPRESSO_SHOT && !o.consumed
                    && pa.intersects(o.bounds)) {
                    o.consumed = true;
                    p.stamina += 50;
                    p.invulnerableTimer = 10.0f;
                }
            }

            for (auto& o : _obstacles)
                if (o.type != ObstacleType::ESPRESSO_SHOT && !o.consumed
                    && pa.intersects(o.bounds) && p.invulnerableTimer <= 0.0f) {
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
                    return o.consumed || o.bounds.x > lim || o.bounds.x < -3.0f;
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