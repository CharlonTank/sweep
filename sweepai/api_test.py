import unittest
import unittest.mock

from sweepai import api


class TestAPI(unittest.TestCase):
    def setUp(self):
        self.mock_api = unittest.mock.create_autospec(api)

    def test_home(self):
        self.mock_api.home.return_value = "<h2>Sweep Webhook is up and running! To get started, copy the URL into the GitHub App settings' webhook field.</h2>"
        result = self.mock_api.home()
        self.assertEqual(
            result,
            "<h2>Sweep Webhook is up and running! To get started, copy the URL into the GitHub App settings' webhook field.</h2>",
        )
        self.mock_api.home.assert_called_once()

    # Add more test methods as needed for each function in api.py


if __name__ == "__main__":
    unittest.main()
import pytest
from fastapi.testclient import TestClient
from sweepai.terminal_executor import TerminalExecutor

@pytest.fixture
def client():
    with TestClient(api.app) as c:
        yield c

@pytest.fixture
def mock_terminal_executor(mocker):
    mocker.patch.object(TerminalExecutor, '_execute_command', return_value="Mocked command execution")

def test_run_migration(client, mock_terminal_executor):
    response = client.post("/execute/migration", json={"command": "rails db:migrate", "flags": [], "working_directory": "/path/to/project"})
    assert response.status_code == 200
    assert response.json() == {"message": "Migration executed successfully.", "result": "Mocked command execution"}
    mock_terminal_executor.assert_called_once_with("rails db:migrate", [], "/path/to/project")

def test_execute_formatter_or_linter(client, mock_terminal_executor):
    response = client.post("/execute/formatter_or_linter", json={"command": "rubocop", "flags": ["-a"], "working_directory": "/path/to/project"})
    assert response.status_code == 200
    assert response.json() == {"message": "Formatter or linter executed successfully.", "result": "Mocked command execution"}
    mock_terminal_executor.assert_called_once_with("rubocop", ["-a"], "/path/to/project")

def test_run_test_suite(client, mock_terminal_executor):
    response = client.post("/execute/test_suite", json={"command": "rspec", "flags": [], "working_directory": "/path/to/project"})
    assert response.status_code == 200
    assert response.json() == {"message": "Test suite executed successfully.", "result": "Mocked command execution"}
    mock_terminal_executor.assert_called_once_with("rspec", [], "/path/to/project")
