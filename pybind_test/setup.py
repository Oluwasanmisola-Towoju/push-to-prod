from setuptools import setup
from pybind11.setup_helpers import Pybind11Extension, build_ext

ext_modules = [
    Pybind11Extension(
        "pybind_test",
        ["test.cpp"],  # Links to your test.cpp file
    ),
]

setup(
    name="pybind_test",
    ext_modules=ext_modules,
    cmdclass={"build_ext": build_ext},
)