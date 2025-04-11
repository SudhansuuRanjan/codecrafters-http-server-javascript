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

        // get text from the path (/echo/{string}) also add a check if the path is valid
        if (!path.startsWith("/echo")) {
            const response = "HTTP/1.1 404 Not Found\r\n\r\n";
            socket.write(response);
            return;
        }
        const text = path.split("/")[2] || "";

        // check if the text is empty

        const response = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${text.length}\r\n\r\n${text}`;
        socket.write(response);
    });

    socket.on("close", () => {
        socket.end();
    });
});

server.listen(4221, "localhost");
