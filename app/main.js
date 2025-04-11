const net = require("net");

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
        // const headers = requestLines.slice(1).reduce((acc, line) => {
        //     const [key, value] = line.split(": ");
        //     acc[key] = value;
        //     return acc;
        // }, {});
        // const body = requestLines.slice(requestLines.indexOf("") + 1).join("\r\n");
        if (path === "/") {
            socket.write("HTTP/1.1 200 OK\r\n\r\n");
        } else {
            socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        }
    });

    socket.on("close", () => {
        socket.end();
    });
});

server.listen(4221, "localhost");
