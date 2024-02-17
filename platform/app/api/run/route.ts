import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

interface Body {
  repo: string;
  filePath: string;
  script: string;
}

export function POST(request: NextRequest) {
  console.log('POST function called');
  return new Promise((resolve, reject) => {
    console.log('Promise created');
    request.json().then((body: Body) => {
      console.log('Request body parsed', body);
      const { repo, filePath, script } = body;
      const commands = [`cd ${repo}`, `export FILE_PATH=${filePath}`];
      if (script) {
        commands.push(script);
      }
      const shellCommand = commands.join(' && ');
      console.log('Shell command created', shellCommand);

      const child = spawn(shellCommand, { shell: true });
      console.log('Child process spawned');

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Received data on stdout', stdout);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        console.log('Received data on stderr', stderr);
      });

      child.on('error', (error) => {
        console.log('Child process error', error.message);
        resolve(NextResponse.json({
          stdout: '',
          stderr: error.message,
          code: -1,
        }));
      });

      child.on('close', (code) => {
        console.log('Child process closed with code', code);
        resolve(NextResponse.json({
          stdout,
          stderr,
          code,
        }));
      });
    }).catch((error) => {
      console.log('Error parsing request body', error.message);
      resolve(NextResponse.json({
        stdout: '',
        stderr: error.message,
        code: -1,
      }));
    });
  });
}