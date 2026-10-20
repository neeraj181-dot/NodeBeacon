"""Opt-in diagnostics for the compiled application; never installs a service."""
from io import StringIO
from pathlib import Path
import unittest


def run(report_path):
    import test_agent
    stream = StringIO()
    result = unittest.TextTestRunner(stream=stream, verbosity=2).run(
        unittest.defaultTestLoader.loadTestsFromModule(test_agent))
    Path(report_path).write_text(stream.getvalue(), encoding='utf-8')
    return 0 if result.wasSuccessful() else 1
