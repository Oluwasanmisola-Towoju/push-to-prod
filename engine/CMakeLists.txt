cmake_minimum_required(VERSION 3.16)
project(push_to_prod_engine CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(ENGINE_SOURCES src/GameEngine.cpp)


option(BUILD_PYBIND "Build pybind11 Python extension" OFF)
if(BUILD_PYBIND)
    # locate the Python development headers on the host machine
    find_package(Python3 REQUIRED COMPONENTS Interpreter Development)

    # download pybind11 directly from github during config
    include(FetchContent)
    FetchContent_Declare(pybind11
        GIT_REPOSITORY https://github.com/pybind/pybind11.git
        GIT_TAG v2.12.0)
    FetchContent_MakeAvailable(pybind11)

    # creates the python module target using pybind11 macro
    pybind11_add_module(gameengine ${ENGINE_SOURCES} src/pybind_bindings.cpp)
    target_include_directories(gameengine PRIVATE src)

    # reedirect the compiled .so / .pyd fileto a central lib folder for FastAPI to consume
    set_target_properties(gameengine PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../server/lib")
endif()