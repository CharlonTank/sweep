import logging
import subprocess

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TerminalExecutor:
    @staticmethod
    def execute_command(command: str) -> str:
        try:
            result = subprocess.run(command, shell=True, capture_output=True, text=True, check=True)
            return result.stdout
        except subprocess.CalledProcessError as e:
            logger.error(f"Command '{command}' failed with return code {e.returncode}: {e.output}")
        except Exception as e:
            logger.error(f"An error occurred while executing command '{command}': {e}")
        return None
