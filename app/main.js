const net = require("net");
const fs = require("fs");
const path = require("path");

// You can use print statements as follows for debugging, they'll be visible when running tests.
console.log("Logs from your program will appear here!");

// Uncomment this to pass the first stage
const server = net.createServer((socket) => {
    socket.on("data", (chunk) => {
        const request = chunk.toString("utf8").trim();
        const requestLines = request.split("\r\n");
        const requestLine = requestLines[0].split(" ");
        const path = requestLine[1];
        // const method = requestLine[0];
        // const protocol = requestLine[2];
        const headers = requestLines.slice(1).reduce((acc, line) => {
            const [key, value] = line.split(": ");
            acc[key] = value;
            return acc;
        }, {});

        // const body = requestLines.slice(requestLines.indexOf("") + 1).join("\r\n");

        let user_agent = headers["User-Agent"];

        if (user_agent) {
            const response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${user_agent.length}\r\n\r\n${user_agent}`;
            socket.write(response);
            return;
        }


        // if the path starts with /files/{filename} then return the file content
        //         First request
        // The first request will ask for a file that exists in the files directory:

        // $ echo -n 'Hello, World!' > /tmp/foo
        // $ curl -i http://localhost:4221/files/foo
        if (path.startsWith("/files/")) {
            const text = path.split("/")[2] || "";
            const filePath = path.join(__dirname, `/tmp/${text}`);
            // check if the file exists
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    const response = "HTTP/1.1 404 Not Found\r\n\r\n";
                    socket.write(response);
                    return;
                }

                // read the file and return the content
                fs.readFile(filePath, "utf8", (err, data) => {
                    if (err) {
                        const response = "HTTP/1.1 500 Internal Server Error\r\n\r\n";
                        socket.write(response);
                        return;
                    }

                    const response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${data.length}\r\n\r\n${data}`;
                    socket.write(response);
                });
            });
            return;
        }

        if (path === "/") {
            const response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 0\r\n\r\n";
            socket.write(response);
            return;
        }

        // get text from the path (/echo/{string}) also add a check if the path is valid
        if (!path.startsWith("/echo")) {
            const response = "HTTP/1.1 404 Not Found\r\n\r\n";
            socket.write(response);
            return;
        }

        const text = path.split("/")[2] || "";

        const response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${text.length}\r\n\r\n${text}`;
        socket.write(response);
    });

    socket.on("close", () => {
        socket.end();
    });
});

server.listen(4221, "localhost");
