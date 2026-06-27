#include <pybind11/pybind11.h>
#include <pybind11/stl.h>            // allows python to natively read C++ std::vectors
#include "GameEngine.h"

namespace py = pybind11;
using namespace ptp;

PYBIND11_MODULE(gameengine, m) {
    m.doc() = "Push to Prod C++ game engine";

    py::enum_<PlayerState>(m, "PlayerState")
        .value("ALIVE", PlayerState::ALIVE)
        .value("DEAD",  PlayerState::DEAD)
        .value("SAFE",  PlayerState::SAFE)
        .export_values();

    py::class_<Player>(m, "Player")
        .def_readonly("id",    &Player::id)
        .def_readonly("name",  &Player::name)
        .def_readonly("x",     &Player::x)
        .def_readonly("y",     &Player::y)
        .def_readonly("score", &Player::score)
        .def_readonly("state", &Player::state);

    py::class_<AABB>(m, "AABB")
        .def_readonly("x", &AABB::x).def_readonly("y", &AABB::y)
        .def_readonly("w", &AABB::w).def_readonly("h", &AABB::h);

    py::class_<Obstacle>(m, "Obstacle")
        .def_readonly("id",        &Obstacle::id)
        .def_readonly("bounds",    &Obstacle::bounds)
        .def_readonly("velocityX", &Obstacle::velocityX)
        .def_readonly("lane",      &Obstacle::lane);

    py::class_<GameState>(m, "GameState")
        .def_readonly("tick",      &GameState::tick)
        .def_readonly("players",   &GameState::players)
        .def_readonly("obstacles", &GameState::obstacles)
        .def_readonly("game_over", &GameState::gameOver);

    py::class_<GameEngine>(m, "GameEngine")
        .def(py::init<int, int>(),
             py::arg("lane_count") = 10, py::arg("grid_width") = 12)
        .def("add_player",    &GameEngine::addPlayer)
        .def("remove_player", &GameEngine::removePlayer)
        .def("apply_input",   &GameEngine::applyInput)
        .def("tick",          &GameEngine::tick)
        .def("player_count",  &GameEngine::playerCount)
        .def("is_game_over",  &GameEngine::isGameOver);
}