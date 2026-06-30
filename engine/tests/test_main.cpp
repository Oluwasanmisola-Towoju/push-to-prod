#include <cassert>
#include <iostream>
#include "../src/GameEngine.h"

using namespace ptp;

void test_add_remove() {
    GameEngine e(10, 12);
    assert(e.addPlayer("p1", "Alice") == true);
    assert(e.addPlayer("p1", "Alice") == false);  // duplicate
    assert(e.playerCount() == 1);
    assert(e.removePlayer("p1") == true);
    assert(e.playerCount() == 0);
    std::cout << "[PASS] add_and_remove_players\n";
}

void test_movement() {
    GameEngine e(10, 12);
    e.addPlayer("p1", "Bob");
    e.applyInput("p1", "MOVE_UP");
    GameState s = e.tick(0.016f);
    for (auto& p : s.players)
        if (p.id == "p1") assert(p.y == 1.0f);
    std::cout << "[PASS] player_movement\n";
}

void test_collision_stable() {
    GameEngine e(4, 12);
    e.addPlayer("p1", "Carol");
    for (int i = 0; i < 500; i++) e.tick(0.016f);
    std::cout << "[PASS] collision_loop_stable\n";
}

void test_game_over_no_crash() {
    GameEngine e(2, 4);
    e.addPlayer("p1", "Dave");
    for (int i = 0; i < 2000; i++) e.tick(0.016f);
    std::cout << "[PASS] game_over_no_crash\n";
}

int main() {
    test_add_remove();
    test_movement();
    test_collision_stable();
    test_game_over_no_crash();
    std::cout << "\nAll engine tests passed.\n";
    return 0;
}