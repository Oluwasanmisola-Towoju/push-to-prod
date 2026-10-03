#include <cstdlib>
#include <cmath>
#include <iostream>
#include <string>

#include "../src/GameEngine.h"

#define CHECK(cond)                                                          \
    do {                                                                     \
        if (!(cond)) {                                                       \
            std::cerr << "[FAIL] " #cond "  (" << __FILE__ << ":" << __LINE__ \
                      << ")\n";                                              \
            std::exit(1);                                                    \
        }                                                                    \
    } while (0)

namespace ptp {
struct EngineTestAccess {
    static Player& player(GameEngine& engine, const std::string& id) {
        return engine._players.at(id);
    }

    static std::vector<Obstacle>& obstacles(GameEngine& engine) {
        return engine._obstacles;
    }

    static void spawnObstacle(GameEngine& engine) {
        engine._spawnObstacle();
    }
};
}

using namespace ptp;

static const Player& snapshotPlayer(const GameState& state, const std::string& id) {
    for (const auto& player : state.players) {
        if (player.id == id) return player;
    }
    std::exit(1);
}

static Obstacle makeObstacle(ObstacleType type, float x, float y, float vx = 0.0f) {
    return Obstacle("test_obstacle", type, 1, x, y, 1.0f, 0.9f, vx);
}

void test_add_remove() {
    GameEngine e(10, 12, 1);
    CHECK(e.addPlayer("p1", "Alice") == true);
    CHECK(e.addPlayer("p1", "Alice") == false);
    CHECK(e.playerCount() == 1);
    CHECK(e.removePlayer("p1") == true);
    CHECK(e.playerCount() == 0);
    std::cout << "[PASS] add_and_remove_players\n";
}

void test_movement() {
    GameEngine e(10, 12, 1);
    e.addPlayer("p1", "Bob");
    e.applyInput("p1", "MOVE_UP");
    GameState s = e.tick(0.016f);
    CHECK(snapshotPlayer(s, "p1").y == 1.0f);
    std::cout << "[PASS] player_movement\n";
}

void test_collision_stable() {
    GameEngine e(4, 12, 2);
    e.addPlayer("p1", "Carol");
    for (int i = 0; i < 500; i++) e.tick(0.016f);
    CHECK(e.playerCount() == 1);
    std::cout << "[PASS] collision_loop_stable\n";
}

void test_game_over_no_crash() {
    GameEngine e(2, 4, 3);
    e.addPlayer("p1", "Dave");
    for (int i = 0; i < 2000; i++) e.tick(0.016f);
    CHECK(e.playerCount() == 1);
    std::cout << "[PASS] game_over_no_crash\n";
}

void test_obstacle_sequence_and_types() {
    GameEngine e(10, 12, 4);
    for (int i = 0; i < 8; ++i) {
        EngineTestAccess::spawnObstacle(e);
        const auto& obstacle = EngineTestAccess::obstacles(e).back();
        CHECK(obstacle.id == "obs_0000" + std::to_string(i));
        CHECK(static_cast<int>(obstacle.type) == i % 4);
    }
    std::cout << "[PASS] obstacle_sequence_and_types\n";
}

void test_pickup_appears_within_ten_seconds() {
    GameEngine e(10, 12, 5);
    e.addPlayer("p1", "Pickup Hunter");
    bool found = false;
    for (int i = 0; i < 200; ++i) {
        GameState state = e.tick(0.05f);
        for (const auto& obstacle : state.obstacles) {
            if (obstacle.type == ObstacleType::ESPRESSO_SHOT) found = true;
        }
    }
    CHECK(found);
    std::cout << "[PASS] pickup_appears_within_ten_seconds\n";
}

void test_collecting_pickup_grants_stamina_and_timer() {
    GameEngine e(10, 12, 6);
    e.addPlayer("p1", "Runner");
    auto& player = EngineTestAccess::player(e, "p1");
    EngineTestAccess::obstacles(e).push_back(
        makeObstacle(ObstacleType::ESPRESSO_SHOT, player.x - 0.4f, player.y - 0.4f));

    GameState state = e.tick(0.05f);
    const auto& result = snapshotPlayer(state, "p1");
    CHECK(result.stamina == 150);
    CHECK(std::fabs(result.invulnerableTimer - 10.0f) <= 0.05f);
    CHECK(state.obstacles.empty());
    std::cout << "[PASS] collecting_pickup_grants_stamina_and_timer\n";
}

void test_invulnerable_player_survives_and_normal_player_dies() {
    GameEngine e(10, 12, 7);
    e.addPlayer("shielded", "Shielded");
    e.addPlayer("normal", "Normal");
    auto& shielded = EngineTestAccess::player(e, "shielded");
    auto& normal = EngineTestAccess::player(e, "normal");
    shielded.invulnerableTimer = 1.0f;
    normal.x = shielded.x;
    normal.y = shielded.y;
    EngineTestAccess::obstacles(e).push_back(
        makeObstacle(ObstacleType::BUG, shielded.x - 0.4f, shielded.y - 0.4f));

    GameState state = e.tick(0.05f);
    CHECK(snapshotPlayer(state, "shielded").state == PlayerState::ALIVE);
    CHECK(snapshotPlayer(state, "normal").state == PlayerState::DEAD);
    std::cout << "[PASS] invulnerable_player_survives_and_normal_player_dies\n";
}

void test_pickup_alone_never_kills() {
    GameEngine e(10, 12, 8);
    e.addPlayer("p1", "Collector");
    auto& player = EngineTestAccess::player(e, "p1");
    EngineTestAccess::obstacles(e).push_back(
        makeObstacle(ObstacleType::ESPRESSO_SHOT, player.x - 0.4f, player.y - 0.4f));
    GameState state = e.tick(0.05f);
    CHECK(snapshotPlayer(state, "p1").state == PlayerState::ALIVE);
    std::cout << "[PASS] pickup_alone_never_kills\n";
}

void test_timer_expires_and_obstacle_kills() {
    GameEngine e(10, 12, 9);
    e.addPlayer("p1", "Timed");
    auto& player = EngineTestAccess::player(e, "p1");
    player.invulnerableTimer = 0.05f;
    EngineTestAccess::obstacles(e).push_back(
        makeObstacle(ObstacleType::BUG, player.x - 0.4f, player.y - 0.4f));

    GameState state = e.tick(0.1f);
    const auto& result = snapshotPlayer(state, "p1");
    CHECK(result.invulnerableTimer == 0.0f);
    CHECK(result.state == PlayerState::DEAD);
    state = e.tick(0.1f);
    CHECK(snapshotPlayer(state, "p1").invulnerableTimer == 0.0f);
    std::cout << "[PASS] timer_expires_and_obstacle_kills\n";
}

void test_dt_is_clamped() {
    GameEngine largeDt(10, 12, 10);
    GameEngine clampedDt(10, 12, 10);
    largeDt.addPlayer("p1", "Large");
    clampedDt.addPlayer("p1", "Clamped");
    EngineTestAccess::obstacles(largeDt).push_back(
        makeObstacle(ObstacleType::BUG, 0.0f, 1.0f, 7.0f));
    EngineTestAccess::obstacles(clampedDt).push_back(
        makeObstacle(ObstacleType::BUG, 0.0f, 1.0f, 7.0f));

    GameState largeState = largeDt.tick(5.0f);
    GameState clampedState = clampedDt.tick(0.1f);
    CHECK(std::fabs(largeState.obstacles.front().bounds.x
                    - clampedState.obstacles.front().bounds.x) < 0.0001f);
    CHECK(largeState.obstacles.front().bounds.x <= 0.7f);
    std::cout << "[PASS] delta_time_is_clamped\n";
}

void test_deterministic_replay() {
    GameEngine a(10, 12, 42);
    GameEngine b(10, 12, 42);
    a.addPlayer("p", "x");
    b.addPlayer("p", "x");
    GameState sa;
    GameState sb;
    for (int i = 0; i < 400; ++i) {
        sa = a.tick(0.05f);
        sb = b.tick(0.05f);
    }
    CHECK(sa.obstacles.size() == sb.obstacles.size());
    for (size_t i = 0; i < sa.obstacles.size(); ++i) {
        CHECK(sa.obstacles[i].bounds.x == sb.obstacles[i].bounds.x);
        CHECK(sa.obstacles[i].type == sb.obstacles[i].type);
    }
    std::cout << "[PASS] deterministic_replay\n";
}

int main() {
    test_add_remove();
    test_movement();
    test_collision_stable();
    test_game_over_no_crash();
    test_obstacle_sequence_and_types();
    test_pickup_appears_within_ten_seconds();
    test_collecting_pickup_grants_stamina_and_timer();
    test_invulnerable_player_survives_and_normal_player_dies();
    test_pickup_alone_never_kills();
    test_timer_expires_and_obstacle_kills();
    test_dt_is_clamped();
    test_deterministic_replay();
    std::cout << "\nAll engine tests passed.\n";
    return 0;
}
