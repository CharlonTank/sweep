from subprocess import CompletedProcess
from unittest.mock import patch

import pytest

from sweepai.terminal_executor import TerminalExecutor


@pytest.fixture
def terminal_executor():
    return TerminalExecutor()

@pytest.fixture
def mock_subprocess_run(monkeypatch):
    def mock_run(*args, **kwargs):
        return CompletedProcess(args, 0, stdout="Command executed successfully", stderr="")
    monkeypatch.setattr("subprocess.run", mock_run)

def test_sanitize_input(terminal_executor):
    assert terminal_executor._sanitize_input("normal") == "normal"
    assert terminal_executor._sanitize_input("with space") == "'with space'"
    assert terminal_executor._sanitize_input("special&char") == "'special&char'"

def test_execute_command_success(terminal_executor, mock_subprocess_run):
    result = terminal_executor._execute_command("echo", ["Hello, World!"], "/tmp")
    assert result.returncode == 0
    assert result.stdout == "Command executed successfully"

def test_execute_command_failure(terminal_executor, mock_subprocess_run):
    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = Exception("Command failed")
        with pytest.raises(Exception) as excinfo:
            terminal_executor._execute_command("false", [], "/tmp")
        assert "Command failed" in str(excinfo.value)

def test_run_migration(terminal_executor, mock_subprocess_run):
    result = terminal_executor.run_migration("migrate", [], "/project")
    assert result.stdout == "Command executed successfully"

def test_execute_formatter_or_linter(terminal_executor, mock_subprocess_run):
    result = terminal_executor.execute_formatter_or_linter("lint", ["--fix"], "/project")
    assert result.stdout == "Command executed successfully"

def test_run_test_suite(terminal_executor, mock_subprocess_run):
    result = terminal_executor.run_test_suite("test", ["--verbose"], "/project")
    assert result.stdout == "Command executed successfully"
