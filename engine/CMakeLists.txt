cmake_minimum_required(VERSION 3.16)
project(push_to_prod_engine CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(ENGINE_SOURCES src/GameEngine.cpp)

# standalone test binary 
add_executable(engine_test ${ENGINE_SOURCES} tests/test_main.cpp)
target_include_directories(engine_test PRIVATE src)

# pybind11 shared library (.so / .pyd) 
option(BUILD_PYBIND "Build pybind11 Python extension" OFF)

if(BUILD_PYBIND)
    # locate the Python development headers on the host machine
    find_package(Python3 REQUIRED COMPONENTS Interpreter Development)
    
    # download pybind11 directly from github during config
    include(FetchContent)
    FetchContent_Declare(
        pybind11
        GIT_REPOSITORY https://github.com/pybind/pybind11.git
        GIT_TAG        v2.12.0
    )
    FetchContent_MakeAvailable(pybind11)
    
    # creates the python module target using pybind11 macro
    pybind11_add_module(gameengine
        ${ENGINE_SOURCES}
        src/pybind_bindings.cpp
    )
    target_include_directories(gameengine PRIVATE src)

    get_filename_component(
        LIB_OUT
        "${CMAKE_SOURCE_DIR}/../server/lib"
        ABSOLUTE
    )

    message(STATUS "gameengine output directory: ${LIB_OUT}")

    set_target_properties(gameengine PROPERTIES
        LIBRARY_OUTPUT_DIRECTORY          "${LIB_OUT}"
        LIBRARY_OUTPUT_DIRECTORY_RELEASE  "${LIB_OUT}"
        LIBRARY_OUTPUT_DIRECTORY_DEBUG    "${LIB_OUT}"
        RUNTIME_OUTPUT_DIRECTORY          "${LIB_OUT}"
        RUNTIME_OUTPUT_DIRECTORY_RELEASE  "${LIB_OUT}"
        RUNTIME_OUTPUT_DIRECTORY_DEBUG    "${LIB_OUT}"
    )
endif()