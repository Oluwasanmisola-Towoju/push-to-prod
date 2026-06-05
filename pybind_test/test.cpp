#include <pybind11/pybind11.h>


namespace py = pybind11;

int add(int a, int b) {
    return a + b;
}

// create the Python module
PYBIND11_MODULE(pybind_test, m) {
    m.doc() = "pybind11 test plugin"; // optional module docstring
    m.def("add", &add, "A function that adds two numbers");
}
