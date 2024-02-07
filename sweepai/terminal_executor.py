import subprocess
from shlex import quote


class TerminalExecutor:
    def __init__(self):
        pass

    def _sanitize_input(self, input_string):
        return quote(input_string)

    def _execute_command(self, command, flags, working_directory):
        sanitized_command = self._sanitize_input(command)
        sanitized_flags = [self._sanitize_input(flag) for flag in flags]
        sanitized_working_directory = self._sanitize_input(working_directory)
        full_command = [sanitized_command] + sanitized_flags
        return subprocess.run(full_command, cwd=sanitized_working_directory, check=True, text=True, capture_output=True)

    def run_migration(self, command, flags, working_directory):
        return self._execute_command(command, flags, working_directory)

    def execute_formatter_or_linter(self, command, flags, working_directory):
        return self._execute_command(command, flags, working_directory)

    def run_test_suite(self, command, flags, working_directory):
        return self._execute_command(command, flags, working_directory)
