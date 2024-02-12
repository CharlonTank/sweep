// server.ts
import { createServer } from 'http';
import next from 'next';
import { WebSocketServer } from 'ws'; // Corrected import
import { parse } from 'url';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        // Be sure to pass true as the second argument to url.parse.
        // This tells it to parse the query portion of the URL.
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws) => {
        ws.on('message', (message: string) => {
            console.log('received: %s', message);
            // Handle incoming WebSocket messages here
        });

        ws.send('Connected to WebSocket server');
    });

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
